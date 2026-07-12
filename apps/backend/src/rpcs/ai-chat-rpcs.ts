import {
  AiChatService,
  PaywallService,
  PaywallWorkspaceService,
  type AiChatType,
} from "@voidhash/core/services";
import {
  AiChatRpcsDef,
  RpcActionForbiddenError,
  RpcAiChatAttachmentValidationError,
  RpcAiChatNotFoundError,
  RpcAiChatServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const AiChatRpcsLive = AiChatRpcsDef.toLayer(
  Effect.gen(function* AiChatRpcsLive() {
    const aiChatService = yield* AiChatService;
    const workspace = yield* PaywallWorkspaceService;
    const paywallService = yield* PaywallService;
    return {
      SaveAiChat: ({
        id,
        organizationId,
        projectId,
        surface,
        chatType,
        paywallId,
        title,
        messages,
      }) =>
        aiChatService
          .save({
            id,
            organizationId,
            projectId,
            surface,
            // Any non-"persistent" value is treated as single-use (stored, unlisted).
            chatType: (chatType === "persistent"
              ? "persistent"
              : "single_use") satisfies AiChatType,
            paywallId,
            title,
            messages,
          })
          .pipe(
            Effect.catchTags({
              AiChatForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              AiChatServiceError: (error) =>
                Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            }),
          ),
      ListAiChats: ({ organizationId, projectId, surface, paywallId }) =>
        aiChatService.list({ organizationId, projectId, surface, paywallId }).pipe(
          Effect.catchTags({
            AiChatForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AiChatServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
          }),
        ),
      GetAiChat: ({ chatId }) =>
        aiChatService.get({ chatId }).pipe(
          Effect.catchTags({
            AiChatForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AiChatNotFoundError: (error) =>
              Effect.fail(new RpcAiChatNotFoundError({ chatId: error.chatId })),
            AiChatServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
          }),
        ),
      DeleteAiChat: ({ chatId }) =>
        aiChatService.delete({ chatId }).pipe(
          Effect.catchTags({
            AiChatForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AiChatNotFoundError: (error) =>
              Effect.fail(new RpcAiChatNotFoundError({ chatId: error.chatId })),
            AiChatServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
          }),
        ),
      UploadAiChatAttachment: ({ chatId, organizationId, name, contentType, dataBase64 }) =>
        aiChatService
          .uploadAttachment({ chatId, organizationId, name, contentType, dataBase64 })
          .pipe(
            Effect.catchTags({
              AiChatForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              AiChatAttachmentValidationError: (error) =>
                Effect.fail(new RpcAiChatAttachmentValidationError({ message: error.message })),
              AiChatServiceError: (error) =>
                Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            }),
          ),
      /**
       * Revert the chat's most recent AI turn: load that turn's captured
       * pre-images (one per touched document) and reconcile each document back to
       * its pre-turn tree through the workspace revert (submitted as a normal
       * transaction, fanned out to any open designer over WS). Independent
       * per-document transactions — no cross-document atomicity (§8 open q. 4).
       */
      RevertAiChatCheckpoint: ({ chatId }) =>
        aiChatService.getLastTurnCheckpoints({ chatId }).pipe(
          Effect.flatMap((preImages) =>
            Effect.forEach(
              preImages,
              (preImage) => workspace.revertDocument(preImage.paywallId, preImage.tree),
              { discard: true },
            ).pipe(Effect.as({ revertedDocuments: preImages.length })),
          ),
          Effect.catchTags({
            AiChatForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AiChatNotFoundError: (error) =>
              Effect.fail(new RpcAiChatNotFoundError({ chatId: error.chatId })),
            AiChatServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.cause })),
            PaywallWorkspaceServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            WorkspaceWriteRejectedError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            WorkspaceWriteConflictError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
          }),
        ),
      /**
       * Capture the CURRENT document tree of `paywallId` as the pre-turn image for
       * `(chatId, turnId)`. The document-first client calls this at the START of an
       * AI turn that will mutate the paywall (before the first `edit_document` op),
       * so a later {@link RevertAiChatCheckpoint} can restore the pre-turn state.
       *
       * Scoping (anti-cross-project): `get` asserts the caller is a member of the
       * chat's project; `getPaywallById` asserts project permission on the
       * paywall; and the paywall must belong to the SAME project as the chat (an
       * org member cannot checkpoint a paywall from another of the org's projects
       * into this chat). Then the live tree is read and captured first-write-wins —
       * `captured: false` when a checkpoint already existed for the turn, so
       * retries/reconnects are cheap idempotent no-ops.
       */
      CaptureAiCheckpoint: ({ chatId, turnId, paywallId }) =>
        Effect.gen(function* () {
          const chat = yield* aiChatService.get({ chatId });
          const paywall = yield* paywallService.getPaywallById(paywallId);
          if (paywall.projectId !== chat.projectId) {
            return yield* Effect.fail(
              new RpcActionForbiddenError({
                message: `Paywall ${paywallId} does not belong to chat ${chatId}'s project.`,
              }),
            );
          }
          const document = yield* workspace.readDocumentTree(paywallId);
          return yield* aiChatService.captureCheckpointReporting({
            chatId,
            turnId,
            paywallId,
            tree: document.tree,
          });
        }).pipe(
          Effect.catchTags({
            AiChatForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AiChatNotFoundError: (error) =>
              Effect.fail(new RpcAiChatNotFoundError({ chatId: error.chatId })),
            AiChatServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.cause })),
            PaywallWorkspaceServiceError: (error) =>
              Effect.fail(new RpcAiChatServiceError({ message: error.message })),
          }),
        ),
    };
  }),
);
