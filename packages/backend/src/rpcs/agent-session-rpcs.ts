import {
  AgentAttachmentService,
  AgentSessionIndexService,
  PaywallEditSessionService,
} from "@voidhash/core/services";
import {
  AgentSessionRpcsDef,
  RpcActionForbiddenError,
  RpcAgentAttachmentValidationError,
  RpcAgentSessionNotFoundError,
  RpcAgentSessionServiceError,
} from "@voidhash/rpc";
import { causeMessage, constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

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

const revertErrorRecord = (error: unknown): RevertErrorLike | undefined => {
  if (typeof error === "object" && error !== null) return error;
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
          .list({ organizationId, projectId, surface, paywallId })
          .pipe(Effect.catchTags(mapSessionErrors)),
      GetAgentSession: ({ sessionId }) =>
        sessions.get({ sessionId }).pipe(
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
