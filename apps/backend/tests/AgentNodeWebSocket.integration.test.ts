// oxlint-disable-next-line effect/noNodeBuiltinImport -- integration test boots the real Node HTTP server the agent WebSocket adapter attaches to.
import { createServer, type Server } from "node:http";

import {
  AgentSessionIndexService,
  IdentityProvider,
  LocalUserSessionService,
  PaywallService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { Db } from "@voidhash/db";
import { causeMessage, constant } from "@voidhash/lib/lang";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-node/MemoryDurableEntity";
import { Context, Data, DateTime, Effect, Latch, Redacted, Schema } from "effect";
import { WebSocket } from "ws";
import { describe, expect, it } from "vite-plus/test";

import { installAgentNodeWebSocketServer } from "../src/agent/AgentNodeWebSocket.ts";

class AgentNodeTestError extends Data.TaggedError("AgentNodeTestError")<{
  readonly message: string;
}> {}

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);
const decodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);

/** Decodes a server frame, keeping the loose shape the assertions below read. */
const decodeFrame = (raw: string): Record<string, any> => {
  const frame: any = decodeJson(raw);
  return frame;
};

/**
 * Builds a partial service stub. Members that are not listed read as
 * `undefined`, exactly like the object literals this replaces, but the value
 * types as the full service so no call site needs an assertion.
 */
const serviceStub = <A>(members: object): A => {
  const stub: any = { ...members };
  return stub;
};

/**
 * Listens on an ephemeral loopback port and reports it, closing the server when
 * the surrounding scope ends.
 */
const listen = (server: Server) =>
  Effect.acquireRelease(
    Effect.callback<number, AgentNodeTestError>((resume) => {
      const onError = (error: Error) =>
        resume(Effect.fail(new AgentNodeTestError({ message: causeMessage(error) })));
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        const address = server.address();
        if (address === null || typeof address === "string") {
          resume(
            Effect.fail(
              new AgentNodeTestError({ message: "HTTP server did not expose a TCP port" }),
            ),
          );
          return;
        }
        resume(Effect.succeed(address.port));
      });
    }),
    () =>
      Effect.callback<void>((resume) => {
        server.close(() => resume(Effect.void));
      }),
  );

const waitFor = (predicate: () => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (predicate()) return;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(
      new AgentNodeTestError({ message: "Timed out waiting for the Node agent WebSocket" }),
    );
  });

const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));

const authSession = {
  cookie: null,
  method: constant("user"),
  name: "Probe user",
  person: null,
  organizations: [
    {
      id: "org_1",
      logo: null,
      name: "Organization",
      permissions: ["organization:all"],
      slug: "organization",
      workosOrganizationId: "workos_org_1",
    },
  ],
  projects: [
    {
      id: "project_1",
      logo: null,
      name: "Project",
      organizationId: "org_1",
      permissions: ["project:all"],
      slug: "project",
    },
  ],
  user: {
    id: "user_1",
    createdAt: epoch,
    updatedAt: epoch,
    email: "user@example.com",
    emailVerified: true,
    image: null,
    name: "Probe user",
    role: null,
    workosUserId: "workos_user_1",
  },
};

const identity = {
  email: "user@example.com",
  emailVerified: true,
  externalId: "user_1",
  firstName: "Probe",
  id: "workos_user_1",
  lastName: "user",
  profilePictureUrl: null,
};

const makeServices = () => {
  const withDb = Context.make(Db, serviceStub({}));
  const withLocalUserSession = Context.add(
    withDb,
    LocalUserSessionService,
    serviceStub({
      resolveLocalUser: () => Effect.succeed(authSession.user),
      loadUserAccess: () =>
        Effect.succeed({
          organizations: authSession.organizations,
          projects: authSession.projects,
        }),
      toUserSession: () => authSession,
    }),
  );
  const withIdentityProvider = Context.add(
    withLocalUserSession,
    IdentityProvider,
    serviceStub({
      cookieName: "voidhash-session",
      authenticateSessionCookie: () => Effect.succeed(null),
      resolveIdentity: () => Effect.succeed(identity),
      resolveIdentityById: () => Effect.succeed(identity),
      linkExternalId: () => Effect.void,
    }),
  );
  const withSessionIndex = Context.add(
    withIdentityProvider,
    AgentSessionIndexService,
    serviceStub({ touch: () => Effect.succeed(undefined) }),
  );
  const withPaywalls = Context.add(
    withSessionIndex,
    PaywallService,
    serviceStub({ getPaywalls: () => Effect.succeed([]) }),
  );
  const services: Context.Context<any> = Context.add(
    withPaywalls,
    PaywallWorkspaceService,
    serviceStub({}),
  );
  return services;
};

const collectUserText = (entries: unknown): string[] => {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry.type === "message" && entry.message?.role === "user")
    .flatMap((entry) => {
      const content = entry.message.content;
      if (typeof content === "string") return [content];
      if (!Array.isArray(content)) return [];
      return content.filter((part) => part.type === "text").map((part) => part.text);
    });
};

describe("installAgentNodeWebSocketServer", () => {
  it("authenticates, streams, and accepts steering through a real Node WebSocket", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const firstProviderGate = yield* Latch.make(false);
          let providerRequests = 0;
          const provider = createServer((request, response) => {
            if (request.url !== "/v1/responses") {
              response.writeHead(404).end();
              return;
            }
            providerRequests += 1;
            response.writeHead(200, {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
            });
            response.write(
              `data: ${encodeJson({
                type: "response.created",
                response: { id: `response_${providerRequests}`, status: "in_progress", output: [] },
              })}\n\n`,
            );
            const finishResponse = () => {
              const events = [
                {
                  type: "response.output_item.added",
                  output_index: 0,
                  item: {
                    id: "message_1",
                    type: "message",
                    role: "assistant",
                    status: "in_progress",
                    content: [],
                  },
                },
                { type: "response.output_text.delta", output_index: 0, delta: "node-host-ok" },
                {
                  type: "response.output_item.done",
                  output_index: 0,
                  item: {
                    id: "message_1",
                    type: "message",
                    role: "assistant",
                    status: "completed",
                    content: [{ type: "output_text", text: "node-host-ok", annotations: [] }],
                  },
                },
                {
                  type: "response.completed",
                  response: {
                    id: "response_1",
                    status: "completed",
                    output: [],
                    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
                  },
                },
              ];
              for (const event of events) response.write(`data: ${encodeJson(event)}\n\n`);
              response.end("data: [DONE]\n\n");
            };
            if (providerRequests === 1) {
              Effect.runFork(
                firstProviderGate.await.pipe(Effect.flatMap(() => Effect.sync(finishResponse))),
              );
            } else {
              finishResponse();
            }
          });
          const providerPort = yield* listen(provider);

          const server = createServer((_request, response) => response.writeHead(404).end());
          const host = installAgentNodeWebSocketServer(
            server,
            makeMemoryDurableEntityHost(),
            makeServices(),
            {
              validateToken: () =>
                Effect.succeed({
                  payload: { sub: "workos_user_1", email: "user@example.com" },
                  provider: constant("workos"),
                }),
            },
            {
              provider: "openai",
              modelId: "gpt-5.4",
              visionProvider: "openai",
              visionModelId: "gpt-5.4",
              openaiApiKey: Redacted.make("probe-key"),
              openaiBaseUrl: `http://127.0.0.1:${providerPort}/v1`,
            },
          );
          const port = yield* listen(server);
          const frames: Array<Record<string, any>> = [];
          const socket = new WebSocket(
            `ws://127.0.0.1:${port}/api/agent/sessions/agent_1/ws?organizationId=org_1&projectId=project_1&surface=designer`,
            { headers: { authorization: "Bearer probe-token" } },
          );
          // oxlint-disable-next-line typescript/no-base-to-string -- `data` is the ws RawData union (Buffer | ArrayBuffer | Buffer[]); every frame this server sends is UTF-8 JSON, and Buffer.toString() is the documented way to read it.
          socket.on("message", (data) => frames.push(decodeFrame(data.toString())));
          yield* Effect.callback<void, AgentNodeTestError>((resume) => {
            socket.once("open", () => resume(Effect.void));
            socket.once("error", (error) =>
              resume(Effect.fail(new AgentNodeTestError({ message: causeMessage(error) }))),
            );
          });
          socket.send(encodeJson({ v: 1, type: "prompt", requestId: "prompt_1", text: "hello" }));
          yield* waitFor(
            () =>
              providerRequests === 1 &&
              frames.some((frame) => frame.type === "event" && frame.event?.type === "agent_start"),
          );
          socket.send(encodeJson({ v: 1, type: "get_state", requestId: "streaming_state" }));
          yield* waitFor(() =>
            frames.some(
              (frame) =>
                frame.type === "state" &&
                frame.requestId === "streaming_state" &&
                frame.state?.isStreaming === true,
            ),
          );
          socket.send(
            encodeJson({ v: 1, type: "steer", requestId: "steer_1", text: "change direction" }),
          );
          yield* waitFor(() =>
            frames.some(
              (frame) =>
                frame.type === "ack" && frame.requestId === "steer_1" && frame.command === "steer",
            ),
          );
          yield* firstProviderGate.open;
          yield* waitFor(() =>
            frames.some((frame) => frame.type === "event" && frame.event?.type === "agent_end"),
          );

          const text = frames
            .filter((frame) => frame.type === "event" && frame.event?.type === "message_end")
            .flatMap((frame) => frame.event.message?.content ?? [])
            .find((content) => content.type === "text")?.text;
          expect(text).toBe("node-host-ok");
          expect(providerRequests).toBeGreaterThanOrEqual(2);

          socket.send(encodeJson({ v: 1, type: "get_entries", requestId: "entries_1" }));
          yield* waitFor(() =>
            frames.some((frame) => frame.type === "entries" && frame.requestId === "entries_1"),
          );
          const entries = frames.find(
            (frame) => frame.type === "entries" && frame.requestId === "entries_1",
          )?.entries;
          expect(collectUserText(entries)).toContain("change direction");

          socket.close();
          host.close();
        }),
      ),
    ));
});
