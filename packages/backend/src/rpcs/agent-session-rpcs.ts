import {
  AgentAttachmentService,
  AgentSessionIndexService,
  PaywallEditSessionService,
  type AgentSessionSummary,
} from "@voidhash/core/services";
import {
  AgentSessionRpcsDef,
  RpcActionForbiddenError,
  RpcAgentAttachmentValidationError,
  RpcAgentSessionNotFoundError,
  RpcAgentSessionServiceError,
} from "@voidhash/rpc";
import { causeMessage, constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

type RevertRpcError =
  | RpcActionForbiddenError
  | RpcAgentSessionNotFoundError
  | RpcAgentSessionServiceError;

/** Structural view of the service errors the revert handler re-maps. */
interface RevertErrorLike {
  readonly _tag?: unknown;
  readonly message?: unknown;
  readonly sessionId?: unknown;
}

const revertErrorRecord = (error: unknown): RevertErrorLike | typeof Schema.Undefined.Type => {
  if (P.isObject(error) && error !== null) return error;
  return undefined;
};

const revertErrorMessage = (message: unknown): string => {
  if (message === undefined) return "Could not revert changes.";
  return causeMessage(message);
};

const mapRevertError = (error: unknown): Effect.Effect<never, RevertRpcError> => {
  const record = revertErrorRecord(error);
  if (record?._tag === "AgentSessionForbiddenError" || record?._tag === "ActionForbiddenError") {
    return Effect.fail(new RpcActionForbiddenError({ message: String(record.message) }));
  }
  if (record?._tag === "AgentSessionNotFoundError") {
    return Effect.fail(new RpcAgentSessionNotFoundError({ sessionId: String(record.sessionId) }));
  }
  return Effect.fail(
    new RpcAgentSessionServiceError({
      message: revertErrorMessage(record?.message),
    }),
  );
};

const toRpcSession = (session: AgentSessionSummary) => ({
  ...session,
  paywallId: Option.getOrNull(session.paywallId),
});

/** RPC handlers for durable session history and prompt attachments. */
export const AgentSessionRpcsLive = AgentSessionRpcsDef.toLayer(
  Effect.gen(function* AgentSessionRpcsLive() {
    const sessions = yield* AgentSessionIndexService;
    const attachments = yield* AgentAttachmentService;
    const editSessions = yield* PaywallEditSessionService;
    const mapSessionErrors = constant({
      AgentSessionForbiddenError: (error: { readonly message: string }) =>
        Effect.fail(new RpcActionForbiddenError({ message: error.message })),
      AgentSessionIndexServiceError: (error: { readonly message: string }) =>
        Effect.fail(new RpcAgentSessionServiceError({ message: error.message })),
    });
    return {
      ListAgentSessions: ({ organizationId, projectId, surface, paywallId }) =>
        sessions
          .list({
            organizationId,
            projectId,
            surface,
            paywallId: Option.map(Option.fromNullishOr(paywallId), Option.some),
          })
          .pipe(
            Effect.map((items) => items.map(toRpcSession)),
            Effect.catchTags(mapSessionErrors),
          ),
      GetAgentSession: ({ sessionId }) =>
        sessions.get({ sessionId }).pipe(
          Effect.map(toRpcSession),
          Effect.catchTags({
            ...mapSessionErrors,
            AgentSessionNotFoundError: (error) =>
              Effect.fail(new RpcAgentSessionNotFoundError({ sessionId: error.sessionId })),
          }),
        ),
      DeleteAgentSession: ({ sessionId }) =>
        sessions.delete({ sessionId }).pipe(
          Effect.catchTags({
            ...mapSessionErrors,
            AgentSessionNotFoundError: (error) =>
              Effect.fail(new RpcAgentSessionNotFoundError({ sessionId: error.sessionId })),
          }),
        ),
      RevertAgentEditSession: ({ sessionId, editSessionId }) =>
        sessions.get({ sessionId }).pipe(
          Effect.flatMap((session) =>
            editSessions.revertForAgentSession(session.projectId, editSessionId, session.id),
          ),
          Effect.catch(mapRevertError),
          Effect.asVoid,
        ),
      UploadAgentAttachment: ({ sessionId, organizationId, name, contentType, dataBase64 }) =>
        attachments.upload({ sessionId, organizationId, name, contentType, dataBase64 }).pipe(
          Effect.catchTags({
            AgentAttachmentForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AgentAttachmentValidationError: (error) =>
              Effect.fail(new RpcAgentAttachmentValidationError({ message: error.message })),
            AgentAttachmentServiceError: (error) =>
              Effect.fail(new RpcAgentSessionServiceError({ message: error.message })),
          }),
        ),
    };
  }),
);
