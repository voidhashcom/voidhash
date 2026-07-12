/**
 * Model Context Protocol endpoint — `POST /api/mcp` (streamable HTTP, STATELESS).
 *
 * Exposes the paywall workspace to MCP clients (Claude Code, the voidhash CLI)
 * as JSON-RPC 2.0 `tools/*`: the stateless, document-first workspace tools
 * (`list_paywalls`, `get_paywall`, `get_components`, `read_component`,
 * `edit_paywall`, `write_component`, `rename_component`, `delete_component`)
 * from the shared tool core (`ai/workspace-tools.ts`).
 *
 * **Auth (v1 API keys → service authz).** The endpoint authenticates with
 * `Authorization: Bearer <secret key>`, validated by the SAME
 * {@link ApiKeyService.validateSecretKey} the v1 API's `x-secret-key` path uses.
 * A voidhash secret key is already PROJECT-scoped, so the key alone determines
 * the workspace scope — MCP tools take no `projectId` argument. From the
 * validated `{ project }` we construct the exact {@link SecretKeySession} the v1
 * middleware builds for a secret key (a real {@link AuthSession} with that one
 * project), and provide it for the request. {@link PaywallWorkspaceService} then
 * runs its normal `PaywallService.getPaywalls(projectId)` project-membership
 * check against that session — no fake super-session, no authz bypass; the same
 * seam every v1 secret-key handler already uses.
 *
 * **Stateless transport.** Each POST is answered with a single JSON response (or
 * 202 for a notification). No SSE stream, no session ids, no server-initiated
 * messages — spec-compliant for a stateless streamable-HTTP server and what
 * Claude Code's client accepts. `GET`/`DELETE` on the endpoint → 405 (there is
 * no stream to open and no session to terminate). Malformed JSON → 400; missing
 * or invalid bearer → 401 with a `WWW-Authenticate` header.
 *
 * Resources are not offered this increment (tools cover the workflow) — see the
 * architecture doc §3.6 follow-ups.
 */
import { ApiKeyService, PaywallWorkspaceService } from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import type { SecretKeySession } from "@voidhash/rpc";
import { Cause, Effect, Layer, Result } from "effect";
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

/** `WWW-Authenticate` challenge returned on any 401 (bearer scheme). */
const WWW_AUTHENTICATE = 'Bearer realm="voidhash-mcp"';

/** A bare JSON-RPC error response (used for pre-dispatch failures with a null id). */
const jsonRpcErrorResponse = (status: number, code: number, message: string) =>
  HttpServerResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });

/** Extract a `Bearer <token>` credential from the `authorization` header. */
const bearerToken = (headers: HttpHeaders.Headers): string | undefined => {
  const raw = HttpHeaders.get(headers, "authorization");
  const value = raw._tag === "Some" ? raw.value : undefined;
  if (value === undefined) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : undefined;
};

/**
 * Construct the {@link SecretKeySession} for a validated project — byte-for-byte
 * the shape the v1 `authenticateSecretKey` middleware builds — so the workspace
 * service's project-membership authz sees a genuine single-project secret-key
 * session.
 */
const secretKeySessionForProject = (project: {
  id: string;
  name: string;
  organizationId: string;
  slug: string;
}): SecretKeySession => ({
  cookie: null,
  method: "secret-key",
  name: `${project.name} API Key`,
  organizations: [],
  person: null,
  projects: [
    {
      id: project.id,
      logo: null,
      name: project.name,
      organizationId: project.organizationId,
      permissions: ["project:all"],
      slug: project.slug,
    },
  ],
  user: null,
});

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

/** Handle a single stateless `POST /api/mcp` JSON-RPC message. */
const handlePost = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;

  // 1. Auth: require a Bearer secret key, validate it via the shared service.
  const token = bearerToken(request.headers);
  if (token === undefined) {
    return HttpServerResponse.setHeader(
      yield* jsonRpcErrorResponse(
        401,
        JsonRpcErrorCode.InvalidRequest,
        "Missing bearer token",
      ),
      "www-authenticate",
      WWW_AUTHENTICATE,
    );
  }

  const apiKeys = yield* ApiKeyService;
  const validated = yield* Effect.result(apiKeys.validateSecretKey(token));
  if (Result.isFailure(validated)) {
    return HttpServerResponse.setHeader(
      yield* jsonRpcErrorResponse(
        401,
        JsonRpcErrorCode.InvalidRequest,
        "Invalid or expired API key",
      ),
      "www-authenticate",
      WWW_AUTHENTICATE,
    );
  }
  const record = validated.success;
  const session = secretKeySessionForProject({
    id: record.project.id,
    name: record.project.name,
    organizationId: record.project.organizationId,
    slug: record.project.slug,
  });
  // MCP is stateless and document-first — every tool reads/edits the LIVE
  // document directly, so the scope is just the authenticated project.
  const scope: WorkspaceToolScope = { projectId: record.project.id };

  // 2. Parse the JSON body → JSON-RPC message.
  const rawBody = yield* request.text;
  const parsedJson = yield* Effect.result(
    Effect.try({
      try: () => JSON.parse(rawBody) as unknown,
      catch: () => new Error("Invalid JSON"),
    }),
  );
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
  //    effects are AuthSession-bound; provide the constructed secret-key session.
  const response: JsonRpcResponse | null = yield* handleMcpMessage(
    parsed.message,
    makeCallTool(scope),
  ).pipe(Effect.provideService(AuthSession, session));

  // A notification (no response) is answered with 202 + empty body.
  if (response === null) {
    return HttpServerResponse.empty({ status: 202 });
  }
  return yield* HttpServerResponse.json(response);
});

/** `GET`/`DELETE` on the stateless endpoint: no stream, no session → 405. */
const methodNotAllowed = HttpServerResponse.json(
  { jsonrpc: "2.0", id: null, error: { code: JsonRpcErrorCode.InvalidRequest, message: "Method Not Allowed" } },
  { status: 405, headers: { allow: "POST" } },
);

const registerMcpRoute = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;
  yield* router.add(
    "POST",
    "/api/mcp",
    handlePost.pipe(
      Effect.catchCause((cause) =>
        Effect.gen(function* () {
          yield* Effect.logError(`MCP request error: ${Cause.pretty(cause)}`);
          return yield* jsonRpcErrorResponse(
            500,
            JsonRpcErrorCode.InternalError,
            "Internal error",
          );
        }),
      ),
    ),
  );
  yield* router.add("GET", "/api/mcp", methodNotAllowed);
  yield* router.add("DELETE", "/api/mcp", methodNotAllowed);
});

/**
 * Registers `POST /api/mcp` (+ 405 on GET/DELETE). The request-scoped
 * requirements — {@link ApiKeyService}, {@link PaywallWorkspaceService}, `Db`
 * (for key validation) — are satisfied via `HttpRouter.provideRequest` by the
 * caller (`BackendApp`), mirroring the AI chat and webhook routes. `AuthSession`
 * is provided in-handler from the validated secret key.
 */
export const McpRouteLayer = Layer.effectDiscard(registerMcpRoute);
