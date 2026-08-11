// oxlint-disable-next-line effect/noNodeBuiltinImport -- Node platform adapter: it upgrades connections on the real http.Server created by the standalone entrypoint, so it needs that module's own types.
import type { IncomingMessage, Server } from "node:http";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- the WebSocket upgrade handler receives a node:stream Duplex from the Node HTTP server; Stream/Channel cannot type that handshake argument.
import type { Duplex } from "node:stream";

import {
  AGENT_SESSION_ENTITY_TYPE,
  AgentSessionCore,
  getCatalogModel,
  type AgentSessionConnection,
  type EffectRunner,
  type Model,
} from "@voidhash/agent";
import { makeAgentSessionIndex } from "@voidhash/backend/ai/AgentSessionIndexAdapter";
import {
  makeWorkspaceAgentSessionFactory,
  type WorkspaceAgentDeps,
} from "@voidhash/backend/ai/WorkspaceAgentSessionFactory";
import { resolveUserSession } from "@voidhash/backend/AuthSessionResolver";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import {
  AgentSessionIndexService,
  IdentityProvider,
  LocalUserSessionService,
} from "@voidhash/core/services";
import type { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { Db } from "@voidhash/db";
import type { DurableEntityHostShape } from "@voidhash/platform/DurableEntity";
import { makeNodeDurableEntitySession } from "@voidhash/platform-node/NodeDurableEntitySession";
import { Context, Effect, Redacted } from "effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { WebSocketServer, type RawData } from "ws";

import type { SelfhostAgentConfig } from "../config.ts";
import type { DurableEntityAlarmHandler } from "../DurableEntityAlarms.ts";

type AgentNodeServices =
  | Exclude<WorkspaceAgentDeps, AuthSession>
  | AgentSessionIndexService
  | Db
  | IdentityProvider
  | LocalUserSessionService;

interface AgentConnectionData {
  readonly authSession: Effect.Success<ReturnType<typeof resolveUserSession>>;
}

interface AgentRoute {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: "designer";
  readonly paywallId?: string;
}

/** Handles and alarm registration returned by the Node agent WebSocket host. */
export interface AgentNodeWebSocketServer {
  readonly alarmHandlers: Readonly<Record<string, DurableEntityAlarmHandler>>;
  readonly close: () => void;
}

export type AgentNodeRouteResult =
  | { readonly _tag: "Other" }
  | { readonly _tag: "Invalid" }
  | { readonly _tag: "Route"; readonly route: AgentRoute };

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Percent-decodes one path segment, yielding `undefined` for malformed input.
 *
 * `decodeURIComponent` throws on broken escape sequences, so the throw is
 * captured by `Effect.try` and run synchronously to keep this parser pure.
 */
const decodeSegment = (segment: string): string | undefined =>
  Effect.runSync(
    Effect.try({
      try: () => decodeURIComponent(segment),
      catch: (cause) => cause,
    }).pipe(Effect.catch(() => Effect.succeed(undefined))),
  );

/** Parses and validates the self-host agent upgrade target. */
export const parseAgentNodeRoute = (
  request: Pick<IncomingMessage, "url">,
): AgentNodeRouteResult => {
  const url = new URL(request.url ?? "/", "http://selfhost.local");
  if (!url.pathname.startsWith("/api/agent/sessions/")) return { _tag: "Other" };
  const match = /^\/api\/agent\/sessions\/([^/]+)\/ws$/.exec(url.pathname);
  if (match?.[1] === undefined) return { _tag: "Invalid" };
  const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  const surface = url.searchParams.get("surface")?.trim() ?? "";
  const sessionId = decodeSegment(match[1]);
  if (sessionId === undefined) return { _tag: "Invalid" };
  if (
    !organizationId ||
    !projectId ||
    surface !== "designer" ||
    !SESSION_ID_PATTERN.test(sessionId)
  ) {
    return { _tag: "Invalid" };
  }
  const paywallId = url.searchParams.get("paywallId")?.trim() || undefined;
  const route: AgentRoute = { sessionId, organizationId, projectId, surface };
  if (paywallId === undefined) return { _tag: "Route", route };
  return { _tag: "Route", route: { ...route, paywallId } };
};

const rejectUpgrade = (socket: Duplex, status: number, reason: string): void => {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

const headerEntries = (request: IncomingMessage): Array<readonly [string, string]> => {
  const entries: Array<readonly [string, string]> = [];
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      entries.push([name, value.join(", ")]);
      continue;
    }
    entries.push([name, value]);
  }
  return entries;
};

const headersOf = (request: IncomingMessage): HttpHeaders.Headers =>
  HttpHeaders.fromInput(Object.fromEntries(headerEntries(request)));

const frameOf = (data: RawData, isBinary: boolean): string | Uint8Array => {
  // `ws` hands text frames over as a Buffer, an ArrayBuffer or a Buffer[]
  // depending on `binaryType`; only the Buffer case decodes correctly on its
  // own, so the other two are normalized before being read as text.
  if (!isBinary) {
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
    if (Array.isArray(data)) return Buffer.concat(data).toString();
    return data.toString();
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  return new Uint8Array(data);
};

const withOpenaiBaseUrl = (
  model: Model<string>,
  provider: string,
  openaiBaseUrl: string | undefined,
): Model<string> => {
  if (provider === "openai" && openaiBaseUrl !== undefined) {
    return { ...model, baseUrl: openaiBaseUrl };
  }
  return model;
};

const configuredModel = (
  provider: string,
  modelId: string,
  openaiBaseUrl: string | undefined,
): Model<string> => {
  const model = getCatalogModel(provider, modelId);
  // Startup misconfiguration: there is no usable server without a known model.
  if (model === undefined) {
    return Effect.runSync(Effect.die(new Error(`Unknown agent model: ${provider}/${modelId}`)));
  }
  return withOpenaiBaseUrl(model, provider, openaiBaseUrl);
};

const resolveConfiguredModel = (
  provider: string,
  modelId: string,
  openaiBaseUrl: string | undefined,
): Model<string> | undefined => {
  const model = getCatalogModel(provider, modelId);
  if (model === undefined) return undefined;
  return withOpenaiBaseUrl(model, provider, openaiBaseUrl);
};

/** Installs authenticated durable Pi sessions on the self-host HTTP server. */
export const installAgentNodeWebSocketServer = (
  server: Server,
  entities: DurableEntityHostShape,
  services: Context.Context<AgentNodeServices>,
  authTokenVerifier: AuthTokenVerifier["Service"],
  config: SelfhostAgentConfig,
): AgentNodeWebSocketServer => {
  const webSockets = new WebSocketServer({ noServer: true });
  const defaultModel = configuredModel(config.provider, config.modelId, config.openaiBaseUrl);
  const visionModel = configuredModel(
    config.visionProvider,
    config.visionModelId,
    config.openaiBaseUrl,
  );
  const contextFor = (
    data: AgentConnectionData,
  ): Context.Context<WorkspaceAgentDeps | AgentSessionIndexService | AuthSession> =>
    Context.add(services, AuthSession, data.authSession);
  const runOptions = (signal: AbortSignal | undefined) => {
    if (signal === undefined) return undefined;
    return { signal };
  };
  const runAgentEffect: EffectRunner<
    AgentConnectionData,
    WorkspaceAgentDeps | AgentSessionIndexService | AuthSession
  > = (data, effect, signal) =>
    Effect.runPromise(effect.pipe(Effect.provide(contextFor(data))), runOptions(signal));
  const factory = makeWorkspaceAgentSessionFactory<AgentConnectionData>({
    defaultModel,
    visionModel,
    runEffect: (data, effect, signal) => runAgentEffect(data, effect, signal),
    getApiKey: (provider) => {
      if (provider === "openai" && config.openaiApiKey !== undefined) {
        return Redacted.value(config.openaiApiKey);
      }
      if (provider === "anthropic" && config.anthropicApiKey !== undefined) {
        return Redacted.value(config.anthropicApiKey);
      }
      return undefined;
    },
    resolveModel: (provider, modelId) =>
      resolveConfiguredModel(provider, modelId, config.openaiBaseUrl),
  });
  const core = new AgentSessionCore<AgentConnectionData>({
    host: entities,
    factory,
    index: makeAgentSessionIndex((data, effect, signal) => runAgentEffect(data, effect, signal)),
  });

  const run = (effect: Effect.Effect<void, unknown>): void => {
    Effect.runFork(
      effect.pipe(
        Effect.catchCause((cause) => Effect.logError("agent Node WebSocket handler failed", cause)),
      ),
    );
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const parsed = parseAgentNodeRoute(request);
    if (parsed._tag === "Other") return;
    if (parsed._tag === "Invalid") {
      rejectUpgrade(socket, 400, "Bad Request");
      return;
    }
    const route = parsed.route;
    void Effect.runPromise(
      resolveUserSession(headersOf(request), authTokenVerifier).pipe(Effect.provide(services)),
    )
      .then((session) => {
        if (session.method !== "user" || session.user === null) {
          rejectUpgrade(socket, 403, "Forbidden");
          return;
        }
        const project = session.projects.find(
          (candidate) =>
            candidate.id === route.projectId && candidate.organizationId === route.organizationId,
        );
        if (project === undefined) {
          rejectUpgrade(socket, 403, "Forbidden");
          return;
        }
        webSockets.handleUpgrade(request, socket, head, (webSocket) => {
          const durableSession = makeNodeDurableEntitySession(globalThis.crypto.randomUUID(), {
            send: (message) => webSocket.send(message),
            close: (code, reason) => webSocket.close(code, reason),
          });
          const connection: AgentSessionConnection<AgentConnectionData> = {
            sessionId: route.sessionId,
            owner: {
              organizationId: route.organizationId,
              projectId: route.projectId,
              userId: session.user.id,
            },
            metadata: {
              surface: route.surface,
              paywallId: route.paywallId ?? null,
            },
            session: durableSession,
            data: { authSession: session },
          };
          const connected = Effect.runPromise(core.connect(connection));
          webSocket.on("message", (data, isBinary) => {
            run(
              Effect.promise(() => connected).pipe(
                Effect.flatMap((authorized) => {
                  if (authorized) return core.handleMessage(connection, frameOf(data, isBinary));
                  return Effect.sync(() => webSocket.close(1008, "Session access denied"));
                }),
              ),
            );
          });
          webSocket.once("close", () => {
            run(
              Effect.promise(() => connected).pipe(
                Effect.andThen(core.disconnect(route.sessionId, durableSession.id)),
              ),
            );
          });
          void connected
            .then((authorized) => {
              if (!authorized) webSocket.close(1008, "Session access denied");
            })
            .catch(() => webSocket.close(1011, "Session initialization failed"));
        });
      })
      .catch(() => rejectUpgrade(socket, 401, "Unauthorized"));
  };

  server.on("upgrade", onUpgrade);
  return {
    alarmHandlers: {
      [AGENT_SESSION_ENTITY_TYPE]: (address) => core.onAlarm(address.id).pipe(Effect.asVoid),
    },
    close: () => {
      server.off("upgrade", onUpgrade);
      for (const client of webSockets.clients) client.close(1001, "Server shutting down");
      webSockets.close();
    },
  };
};
