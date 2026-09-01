import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  PaywallAssetValidationError,
  validateAndDecodePaywallAsset,
} from "../../domain/paywallAssetImage.ts";
import { generateId } from "../../utils/generate-id.ts";
import { isSessionOrganizationMember } from "../../utils/permissions.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { AgentSessionIndexService } from "./AgentSessionIndexService.ts";

/** Stable failure raised when durable-session attachment storage fails. */
export class AgentAttachmentServiceError extends Schema.TaggedErrorClass<AgentAttachmentServiceError>(
  "AgentAttachmentServiceError",
)("AgentAttachmentServiceError", { message: Schema.String }) {}

/** Authorization failure for a durable-session attachment operation. */
export class AgentAttachmentForbiddenError extends Schema.TaggedErrorClass<AgentAttachmentForbiddenError>(
  "AgentAttachmentForbiddenError",
)("AgentAttachmentForbiddenError", { message: Schema.String }) {}

/** Validation failure for a durable-session attachment payload. */
export class AgentAttachmentValidationError extends Schema.TaggedErrorClass<AgentAttachmentValidationError>(
  "AgentAttachmentValidationError",
)("AgentAttachmentValidationError", { message: Schema.String }) {}

export interface AgentAttachment {
  readonly url: string;
  readonly name: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface AgentAttachmentUploadInput {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly contentType: string;
  readonly dataBase64: string;
}

/** Validates and stores image attachments for durable agent prompts. */
export class AgentAttachmentService extends Context.Service<AgentAttachmentService>()(
  "AgentAttachmentService",
  {
    make: Effect.gen(function* () {
      const sessions = yield* AgentSessionIndexService;
      const publicFiles = yield* PublicFileStore;

      const assertScope = Effect.fn("AgentAttachmentService.assertScope")(function* (
        input: AgentAttachmentUploadInput,
      ) {
          const indexed = yield* Effect.result(sessions.get({ sessionId: input.sessionId }));
          if (Result.isSuccess(indexed)) {
            if (indexed.success.organizationId !== input.organizationId) {
              return yield* Effect.fail(
                new AgentAttachmentForbiddenError({
                  message: `Session ${input.sessionId} belongs to another organization.`,
                }),
              );
            }
            return;
          }
          if (indexed.failure._tag === "AgentSessionForbiddenError") {
            return yield* Effect.fail(
              new AgentAttachmentForbiddenError({ message: indexed.failure.message }),
            );
          }
          if (indexed.failure._tag === "AgentSessionIndexServiceError") {
            return yield* Effect.fail(
              new AgentAttachmentServiceError({ message: indexed.failure.message }),
            );
          }
          const auth = yield* AuthSession;
          if (!isSessionOrganizationMember(auth, input.organizationId)) {
            return yield* Effect.fail(
              new AgentAttachmentForbiddenError({
                message: `Not a member of organization ${input.organizationId}.`,
              }),
            );
          }
        });

      const upload = Effect.fn("uploadAgentAttachment")(
        function* (input: AgentAttachmentUploadInput) {
          yield* assertScope(input);
          const { bytes, ext } = yield* validateAndDecodePaywallAsset({
            imageBase64: input.dataBase64,
            contentType: input.contentType,
          });
          const attachmentId = generateId("agentAttachment");
          const key = `agent-sessions/${input.sessionId}/attachments/${attachmentId}.${ext}`;
          yield* publicFiles.putObject({
            key,
            body: bytes,
            contentType: Option.some(input.contentType),
          });
          return {
            url: publicFiles.publicUrl(key),
            name: input.name.slice(0, 255),
            contentType: input.contentType,
            sizeBytes: bytes.length,
          } satisfies AgentAttachment;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              PublicFileStoreError: (error) =>
                Effect.fail(new AgentAttachmentServiceError({ message: error.cause })),
              PaywallAssetValidationError: (error: PaywallAssetValidationError) =>
                Effect.fail(new AgentAttachmentValidationError({ message: error.message })),
            }),
          ),
      );

      return constant({ upload });
    }),
  },
) {
  static readonly layer = Layer.effect(AgentAttachmentService)(AgentAttachmentService.make);
}
