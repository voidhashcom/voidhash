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
import { Effect } from "effect";

type RevertRpcError =
  | RpcActionForbiddenError
  | RpcAgentSessionNotFoundError
  | RpcAgentSessionServiceError;

const mapRevertError = (error: unknown): Effect.Effect<never, RevertRpcError> => {
  const record =
    typeof error === "object" && error !== null
      ? (error as {
          readonly _tag?: unknown;
          readonly message?: unknown;
          readonly sessionId?: unknown;
        })
      : undefined;
  if (record?._tag === "AgentSessionForbiddenError" || record?._tag === "ActionForbiddenError") {
    return Effect.fail(new RpcActionForbiddenError({ message: String(record.message) }));
  }
  if (record?._tag === "AgentSessionNotFoundError") {
    return Effect.fail(new RpcAgentSessionNotFoundError({ sessionId: String(record.sessionId) }));
  }
  return Effect.fail(
    new RpcAgentSessionServiceError({
      message: record?.message === undefined ? "Could not revert changes." : String(record.message),
    }),
  );
};

/** RPC handlers for durable session history and prompt attachments. */
export const AgentSessionRpcsLive = AgentSessionRpcsDef.toLayer(
  Effect.gen(function* AgentSessionRpcsLive() {
    const sessions = yield* AgentSessionIndexService;
    const attachments = yield* AgentAttachmentService;
    const editSessions = yield* PaywallEditSessionService;
    const mapSessionErrors = {
      AgentSessionForbiddenError: (error: { readonly message: string }) =>
        Effect.fail(new RpcActionForbiddenError({ message: error.message })),
      AgentSessionIndexServiceError: (error: { readonly message: string }) =>
        Effect.fail(new RpcAgentSessionServiceError({ message: error.message })),
    } as const;
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
