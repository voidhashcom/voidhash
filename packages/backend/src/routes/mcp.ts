import { unsafeDefined } from "../runtime-boundary.ts";
/**
 * Model Context Protocol endpoint — `POST /api/mcp` (streamable HTTP, STATELESS).
 *
 * Exposes the paywall workspace to MCP clients as JSON-RPC 2.0 tools, resources,
 * and prompts. The tools use the stateless, document-first implementation in
 * `ai/workspace-tools.ts`; the authoring resource and prompt teach clients the
 * same schema-derived workflow.
 *
 * **Auth.** AuthKit is the OAuth authorization server. Its access token carries
 * the WorkOS user, selected organization, and MCP resource audience. Project-
 * scoped secret keys and CLI user keys remain accepted for backwards
 * compatibility. Every path constructs a normal {@link AuthSession}, so
 * workspace authorization is still enforced by the domain services.
 *
 * **Stateless transport.** Each POST is answered with a single JSON response (or
 * 202 for a notification). No SSE stream, no session ids, no server-initiated
 * messages — spec-compliant for a stateless streamable-HTTP server and what
 * Claude Code's client accepts. `GET`/`DELETE` on the endpoint → 405 (there is
 * no stream to open and no session to terminate). Malformed JSON → 400; missing
 * or invalid bearer → 401 with a `WWW-Authenticate` header.
 *
 */
import { ApiKeyService, IdentityProvider, LocalUserSessionService } from "@voidhash/core/services";
import {
  AuthSession,
  makeInternalProjectAuthSession,
  type AnyAuthSession,
} from "@voidhash/core/domain/auth/Auth";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import * as HttpHeaders from "effect/unstable/http/Headers";

import {
  handleMcpMessage,
  parseJsonRpcMessage,
  JsonRpcErrorCode,
  type CallTool,
  type JsonRpcResponse,
} from "../mcp/protocol.ts";
import { findMcpTool } from "../mcp/tool-manifest.ts";
import type { WorkspaceToolScope } from "../ai/workspace-tools.ts";
import { McpOAuth } from "../McpOAuth.ts";
import * as Str from "effect/String";
import * as Arr from "effect/Array";
import { recoverAll } from "../runtime-boundary.ts";

const forwardedOrigin = (request: HttpServerRequest.HttpServerRequest): string => {
  const host = request.headers.host ?? "localhost";
  const protocol = request.headers["x-forwarded-proto"] ?? "http";
  return `${protocol}://${host}`;
};

const requestOrigin = (request: HttpServerRequest.HttpServerRequest): Effect.Effect<string> =>
  Effect.try({
    try: () => new URL(request.originalUrl).origin,
    catch: (cause) => cause,
  }).pipe(recoverAll(() => forwardedOrigin(request)));

/** AuthKit discovery challenge returned by the protected MCP resource. */
export const mcpBearerChallenge = (origin: string): string =>
  [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`,
  ].join(", ");

/** A bare JSON-RPC error response (used for pre-dispatch failures with a null id). */
const jsonRpcErrorResponse = (status: number, code: number, message: string) =>
  HttpServerResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });

/** Extract a `Bearer <token>` credential from the `authorization` header. */
const bearerToken = (headers: HttpHeaders.Headers): string | typeof Schema.Undefined.Type => {
  const value = Option.getOrUndefined(HttpHeaders.get(headers, "authorization"));
  if (value === undefined) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (match === null) {
    return undefined;
  }
  return match[1].trim();
};

const headerValue = (
  headers: HttpHeaders.Headers,
  name: string,
): string | typeof Schema.Undefined.Type => {
  const value = Option.getOrUndefined(HttpHeaders.get(headers, name));
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (Str.isEmpty(trimmed)) {
    return undefined;
  }
  return trimmed;
};

/** Selects an authorized MCP project without allowing a user key to widen its session. */
export const selectMcpProject = <Project extends { readonly id: string; readonly slug: string }>(
  projects: ReadonlyArray<Project>,
  selector: string | typeof Schema.Undefined.Type,
):
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly status: 400 | 403; readonly message: string } => {
  if (selector !== undefined) {
    const project = projects.find(
      (candidate) => candidate.id === selector || candidate.slug === selector,
    );
    if (project === undefined) {
      return {
        ok: false,
        status: 403,
        message: `The authenticated user cannot access project "${selector}".`,
      };
    }
    return { ok: true, project };
  }
  if (projects.length === 1) {
    return { ok: true, project: unsafeDefined(projects[0]) };
  }
  if (Arr.isReadonlyArrayEmpty(projects)) {
    return {
      ok: false,
      status: 403,
      message: "The authenticated user has no accessible projects.",
    };
  }
  return {
    ok: false,
    status: 400,
    message:
      "The authenticated user has multiple projects. Set the X-Voidhash-Project header to a project id or slug.",
  };
};

/** Maps an AuthKit access-token rejection to its HTTP status and client message. */
const accessTokenRejection = (
  kind: "invalid_token" | "misconfigured" | "upstream",
): { readonly status: 503 | 401; readonly message: string } => {
  if (kind === "misconfigured") {
    return { status: 503, message: "MCP OAuth is not configured" };
  }
  return { status: 401, message: "Invalid or expired AuthKit access token" };
};

/**
 * The dispatcher passed to {@link handleMcpMessage}: look up the tool by name,
 * run it against the authenticated `scope` — an unknown tool folds to an
 * `isError` tool result (MCP maps a bad tool name to a tool error, not a
 * JSON-RPC error, so a client retry loop can recover).
 */
const makeCallTool =
  (scope: WorkspaceToolScope): CallTool =>
  (name, args) => {
    const tool = findMcpTool(name);
    if (tool === undefined) {
      return Effect.succeed({ output: `Unknown tool: ${name}`, isError: true });
    }
    return tool.dispatch(scope, args);
  };

/** Decodes the raw request body as JSON text; a parse failure is a typed error. */
const decodeJsonBody = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

/** Handle a single stateless `POST /api/mcp` JSON-RPC message. */
const handlePost = Effect.fn("handlePost")(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const origin = yield* requestOrigin(request);
  const challenge = mcpBearerChallenge(origin);
  const resource = `${origin}/api/mcp`;

  // 1. Auth: prefer a resource-bound OAuth access token; retain API keys for
  // existing clients during migration.
  const token = bearerToken(request.headers);
  if (token === undefined) {
    return HttpServerResponse.setHeader(
      yield* jsonRpcErrorResponse(401, JsonRpcErrorCode.InvalidRequest, "Missing bearer token"),
      "www-authenticate",
      challenge,
    );
  }

  let session: AnyAuthSession;
  let scope: WorkspaceToolScope;
  if (token.split(".").length === 3) {
    const mcpOAuth = yield* McpOAuth;
    const validatedToken = yield* Effect.result(mcpOAuth.verifyAccessToken(token, resource));
    if (Result.isFailure(validatedToken)) {
      const rejection = accessTokenRejection(validatedToken.failure.kind);
      return HttpServerResponse.setHeader(
        yield* jsonRpcErrorResponse(
          rejection.status,
          JsonRpcErrorCode.InvalidRequest,
          rejection.message,
        ),
        "www-authenticate",
        challenge,
      );
    }

    const claims = validatedToken.success;
    const localUserSessions = yield* LocalUserSessionService;
    const identityProvider = yield* IdentityProvider;
    const identity = yield* identityProvider.resolveIdentityById(claims.subject);
    const localUser = yield* localUserSessions.resolveLocalUser(identity);
    const access = yield* localUserSessions.loadUserAccess(localUser.id);
    const organization = access.organizations.find(
      (candidate) => candidate.workosOrganizationId === claims.organizationId,
    );
    if (organization === undefined) {
      return yield* jsonRpcErrorResponse(
        403,
        JsonRpcErrorCode.InvalidRequest,
        "The AuthKit grant no longer has access to its selected organization",
      );
    }
    const organizationProjects = access.projects.filter(
      (candidate) => candidate.organizationId === organization.id,
    );
    const selection = selectMcpProject(
      organizationProjects,
      headerValue(request.headers, "x-voidhash-project"),
    );
    if (!selection.ok) {
      return yield* jsonRpcErrorResponse(
        selection.status,
        JsonRpcErrorCode.InvalidRequest,
        selection.message,
      );
    }
    const userSession = localUserSessions.toUserSession(
      localUser,
      { organizations: [organization], projects: [selection.project] },
      Option.none(),
      Option.some(identity.id),
    );
    session = userSession;
    scope = { projectId: selection.project.id };
  } else {
    const apiKeys = yield* ApiKeyService;
    const validatedSecret = yield* Effect.result(apiKeys.validateSecretKey(token));
    if (Result.isSuccess(validatedSecret)) {
      const record = validatedSecret.success;
      session = makeInternalProjectAuthSession({
        id: record.project.id,
        name: record.project.name,
        organizationId: record.project.organizationId,
        slug: record.project.slug,
      });
      scope = { projectId: record.project.id };
    } else {
      const validatedUser = yield* Effect.result(apiKeys.validateUserApiKey(token));
      if (Result.isFailure(validatedUser)) {
        return HttpServerResponse.setHeader(
          yield* jsonRpcErrorResponse(
            401,
            JsonRpcErrorCode.InvalidRequest,
            "Invalid or expired API key",
          ),
          "www-authenticate",
          challenge,
        );
      }
      const localUserSessions = yield* LocalUserSessionService;
      const access = yield* localUserSessions.loadUserAccess(validatedUser.success.user.id);
      const selection = selectMcpProject(
        access.projects,
        headerValue(request.headers, "x-voidhash-project"),
      );
      if (!selection.ok) {
        return yield* jsonRpcErrorResponse(
          selection.status,
          JsonRpcErrorCode.InvalidRequest,
          selection.message,
        );
      }
      const userSession = localUserSessions.toUserSession(
        validatedUser.success.user,
        access,
        Option.none(),
        Option.none(),
      );
      session = {
        ...userSession,
        projects: userSession.projects.filter((project) => project.id === selection.project.id),
      };
      scope = { projectId: selection.project.id };
    }
  }

  // 2. Parse the JSON body → JSON-RPC message.
  const rawBody = yield* request.text;
  const parsedJson = yield* Effect.result(decodeJsonBody(rawBody));
  if (Result.isFailure(parsedJson)) {
    return yield* jsonRpcErrorResponse(
      400,
      JsonRpcErrorCode.ParseError,
      "Parse error: request body is not valid JSON",
    );
  }

  const parsed = parseJsonRpcMessage(parsedJson.success);
  if (!parsed.ok) {
    return yield* jsonRpcErrorResponse(400, JsonRpcErrorCode.InvalidRequest, parsed.reason);
  }

  // 3. Dispatch the message against the authenticated project scope. The tool
  //    effects are AuthSession-bound; provide the constructed scoped session.
  const response: JsonRpcResponse | typeof Schema.Null.Type = yield* handleMcpMessage(
    parsed.message,
    makeCallTool(scope),
  ).pipe(Effect.provideService(AuthSession, session));

  // A notification (no response) is answered with 202 + empty body.
  if (response === null) {
    return HttpServerResponse.empty({ status: 202 });
  }
  return yield* HttpServerResponse.json(response);
})();

/** `GET`/`DELETE` on the stateless endpoint: no stream, no session → 405. */
const methodNotAllowed = HttpServerResponse.json(
  {
    jsonrpc: "2.0",
    id: null,
    error: { code: JsonRpcErrorCode.InvalidRequest, message: "Method Not Allowed" },
  },
  { status: 405, headers: { allow: "POST" } },
);

const registerMcpRoute = Effect.fn("registerMcpRoute")(function* () {
  const router = yield* HttpRouter.HttpRouter;
  yield* router.add(
    "POST",
    "/api/mcp",
    handlePost.pipe(
      Effect.catchCause((cause) =>
        Effect.fn("registerMcpRoute")(function* () {
          yield* Effect.logError(`MCP request error: ${Cause.pretty(cause)}`);
          return yield* jsonRpcErrorResponse(500, JsonRpcErrorCode.InternalError, "Internal error");
        })(),
      ),
    ),
  );
  yield* router.add("GET", "/api/mcp", methodNotAllowed);
  yield* router.add("DELETE", "/api/mcp", methodNotAllowed);
})();

/**
 * Registers `POST /api/mcp` (+ 405 on GET/DELETE). The request-scoped
 * requirements — OAuth/API-key auth, workspace services, and `Db` — are
 * satisfied via `HttpRouter.provideRequest` by the caller
 * (`BackendApp`), mirroring the agent-session and webhook routes. `AuthSession` is
 * provided in-handler from the validated project or user key.
 */
export const McpRouteLayer = Layer.effectDiscard(registerMcpRoute);
