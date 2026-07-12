/**
 * Voidhash AI streaming chat endpoint — `POST /api/ai/chat`.
 *
 * The studio surfaces (currently only the paywall designer) POST the running
 * UI-message history plus the surface + project scope. The handler authenticates
 * the WorkOS session, verifies the caller is a member of the target project
 * (anti-spoof: the project must appear in the session, never trusted from the
 * body alone), then streams the model's UI-message response straight back to the
 * client via {@link VoidhashAiService}. Tool calls are executed on the server
 * (the tools read and write the paywall workspace directly); the client only
 * renders the streamed results.
 *
 * - Unparseable / non-designer body → 400.
 * - Unauthenticated → 401.
 * - Caller not a member of `projectId` → 403.
 */
import { type ChatRequestBody, chatRequestBodySchema } from "@voidhash/ai-shared";
import { Db } from "@voidhash/db";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import type { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { Workos } from "@voidhash/core/services/auth/Workos";
import { Cause, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { resolveWorkosSession } from "../../AuthSessionResolver.ts";
import { VoidhashAiService } from "../../ai/VoidhashAiService.ts";

/**
 * Decodes the parsed JSON body against the shared {@link chatRequestBodySchema}
 * wire contract (the same schema the studio transport builds its body to satisfy),
 * or returns null. Anti-spoof authz is enforced separately by the caller AFTER
 * decoding — this only validates shape.
 */
const parseChatBody = (value: unknown): ChatRequestBody | null => {
  const result = chatRequestBodySchema.safeParse(value);
  return result.success ? result.data : null;
};

const handleChat = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Effect.gen(function* () {
    const ai = yield* VoidhashAiService;
    const request = yield* HttpServerRequest.HttpServerRequest;

    const rawBody = yield* request.text;
    const parsed = yield* Effect.try({
      catch: () => new Error("Invalid JSON body"),
      try: () => JSON.parse(rawBody) as unknown,
    }).pipe(Effect.catch(() => Effect.succeed(null)));

    const body = parseChatBody(parsed);
    if (!body) {
      return yield* HttpServerResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const sessionResult = yield* Effect.result(
      resolveWorkosSession(request.headers, authTokenVerifier),
    );
    if (sessionResult._tag === "Failure") {
      return yield* HttpServerResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const session = sessionResult.success;

    // Anti-spoof: the project must be one the authenticated user actually has
    // access to (present in the session), never trusted from the body alone,
    // and the claimed organization must be the project's owning organization.
    const project = session.projects.find((p) => p.id === body.projectId);
    if (!project || project.organizationId !== body.organizationId) {
      return yield* HttpServerResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // The server now executes the agent's tools over the workspace/chat services,
    // which are AuthSession-bound (project-membership authz, chat ownership). The
    // route resolved the session manually, so provide it as `AuthSession` for the
    // duration of the streamed turn (the workspace/chat service layers are already
    // in scope via the route's provideRequest).
    const response = yield* ai
      .chat({
        messages: body.messages,
        surface: body.surface,
        projectId: body.projectId,
        organizationId: body.organizationId,
        paywallId: body.paywallId,
        chatId: body.chatId,
        selectedNodeIds: body.selectedNodeIds,
      })
      .pipe(Effect.provideService(AuthSession, session));
    return HttpServerResponse.fromWeb(response);
  });

const registerAiChatRoute = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    yield* router.add(
      "POST",
      "/api/ai/chat",
      handleChat(authTokenVerifier).pipe(
        Effect.catchCause((cause) =>
          Effect.gen(function* () {
            yield* Effect.logError(`AI chat error: ${Cause.pretty(cause)}`);
            return yield* HttpServerResponse.json(
              { error: "AI chat request failed" },
              { status: 500 },
            );
          }),
        ),
      ),
    );
  });

/**
 * Registers `POST /api/ai/chat`. The route resolves `VoidhashAiService`, `Db`,
 * `Workos` and `LocalUserSessionService` at request time (satisfied via
 * `HttpRouter.provideRequest` by the caller); token verification is injected as
 * a provider-neutral capability at build time, mirroring the RPC middlewares.
 */
export const AiChatRouteLayer = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Layer.effectDiscard(registerAiChatRoute(authTokenVerifier));
