import { and, desc, Db, eq, voidhashAiChat, voidhashAiCheckpoint } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  PaywallAssetValidationError,
  validateAndDecodePaywallAsset,
} from "../../domain/paywallAssetImage.ts";
import { generateId } from "../../utils/generate-id.ts";
import { isSessionOrganizationMember, isSessionProjectMember } from "../../utils/permissions.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";

/** Catch-all error raised by {@link AiChatService} public methods. */
export class AiChatServiceError extends Schema.TaggedErrorClass<AiChatServiceError>(
  "AiChatServiceError",
)("AiChatServiceError", { message: Schema.String }) {}

/** Raised when the caller is not a member of the target chat's organization/project. */
export class AiChatForbiddenError extends Schema.TaggedErrorClass<AiChatForbiddenError>(
  "AiChatForbiddenError",
)("AiChatForbiddenError", { message: Schema.String }) {}

/** Raised when the referenced chat row does not exist. */
export class AiChatNotFoundError extends Schema.TaggedErrorClass<AiChatNotFoundError>(
  "AiChatNotFoundError",
)("AiChatNotFoundError", { chatId: Schema.String }) {}

/** Raised when an uploaded chat attachment fails image validation. */
export class AiChatAttachmentValidationError extends Schema.TaggedErrorClass<AiChatAttachmentValidationError>(
  "AiChatAttachmentValidationError",
)("AiChatAttachmentValidationError", { message: Schema.String }) {}

/** Studio surface a chat belongs to. Kept as a plain string at the DB boundary. */
export type AiChatType = "persistent" | "single_use";

/** Metadata for one chat as returned by {@link AiChatServiceShape.list} (no messages). */
export interface AiChatSummary {
  readonly id: string;
  readonly title: string;
  readonly chatType: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** One full chat row (including its serialized messages) as returned by `get`. */
export interface AiChatRow extends AiChatSummary {
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: string;
  readonly paywallId: string | null;
  /** JSON-encoded AI SDK `UIMessage[]`. */
  readonly messages: string;
}

/** One stored chat attachment as returned by {@link AiChatServiceShape.uploadAttachment}. */
export interface AiChatAttachment {
  readonly url: string;
  readonly name: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface AiChatSaveInput {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: string;
  readonly chatType: AiChatType;
  readonly paywallId?: string | null;
  readonly title: string;
  /** JSON-encoded AI SDK `UIMessage[]`. */
  readonly messages: string;
}

export interface AiChatListInput {
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: string;
  /** When set, limits the list to persistent chats scoped to this paywall. */
  readonly paywallId?: string | null;
}

export interface AiChatAttachmentUploadInput {
  readonly chatId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly contentType: string;
  readonly dataBase64: string;
}

/** A captured per-turn checkpoint pre-image: which document + its pre-write tree. */
export interface AiCheckpointPreImage {
  readonly paywallId: string;
  /** The document's pre-write RAW encoded tree (mimic `TreeValue`). */
  readonly tree: unknown;
}

/** Public {@link AiChatService} surface. */
export interface AiChatServiceShape {
  /** Upsert a chat by its (client-minted) id — inserts on first save, replaces messages/title after. */
  readonly save: (
    input: AiChatSaveInput,
  ) => Effect.Effect<AiChatSummary, AiChatServiceError | AiChatForbiddenError>;
  /** List a paywall/surface's **persistent** chats (metadata only), newest first. */
  readonly list: (
    input: AiChatListInput,
  ) => Effect.Effect<ReadonlyArray<AiChatSummary>, AiChatServiceError | AiChatForbiddenError>;
  /** Load one full chat (with messages), or fail not-found. */
  readonly get: (input: {
    readonly chatId: string;
  }) => Effect.Effect<AiChatRow, AiChatServiceError | AiChatForbiddenError | AiChatNotFoundError>;
  /** Delete one chat. */
  readonly delete: (input: {
    readonly chatId: string;
  }) => Effect.Effect<void, AiChatServiceError | AiChatForbiddenError | AiChatNotFoundError>;
  /** Upload an image attachment to R2 under this chat and return its public URL. */
  readonly uploadAttachment: (
    input: AiChatAttachmentUploadInput,
  ) => Effect.Effect<
    AiChatAttachment,
    AiChatServiceError | AiChatForbiddenError | AiChatAttachmentValidationError
  >;
  /**
   * Record a document's pre-turn image for one (chat, turn) — the tree as it was
   * BEFORE the turn's first write, captured when that first write is ACCEPTED
   * (never on a rejected-only or no-op turn). First-write-wins per (chatId,
   * turnId, paywallId): only the first accepted write to a document in a turn
   * captures; later accepted writes to the same document are idempotent no-ops.
   * Server-authoritative: no membership check (the caller is the trusted AI turn
   * loop; the chat row it scopes was already project-authorized).
   */
  readonly captureCheckpoint: (input: {
    readonly chatId: string;
    readonly turnId: string;
    readonly paywallId: string;
    readonly tree: unknown;
  }) => Effect.Effect<void, AiChatServiceError>;
  /**
   * Like {@link captureCheckpoint}, but reports whether this call actually took
   * the checkpoint (`captured: true`) or a checkpoint already existed for the
   * `(chatId, turnId, paywallId)` triple (`captured: false`, a first-write-wins
   * no-op). Backs the client-driven `CaptureAiCheckpoint` RPC in the
   * document-first authoring model, where the browser captures the pre-turn image
   * BEFORE the first mutating tool call of a turn and wants to know if it was the
   * one that took it (so retries/reconnects are cheap, idempotent no-ops).
   * Server-authoritative: same trust model as {@link captureCheckpoint}.
   */
  readonly captureCheckpointReporting: (input: {
    readonly chatId: string;
    readonly turnId: string;
    readonly paywallId: string;
    readonly tree: unknown;
  }) => Effect.Effect<{ readonly captured: boolean }, AiChatServiceError>;
  /**
   * Load the pre-images of a chat's MOST RECENT turn (the turn of its newest
   * checkpoint row), or an empty list when the chat has no checkpoints. Requires
   * org membership on the owning chat (revert is a user-facing action).
   */
  readonly getLastTurnCheckpoints: (input: {
    readonly chatId: string;
  }) => Effect.Effect<
    ReadonlyArray<AiCheckpointPreImage>,
    AiChatServiceError | AiChatForbiddenError | AiChatNotFoundError
  >;
}

/**
 * `AiChatService` persists Voidhash AI chats and their image attachments. The
 * chat id is minted client-side so an attachment can be stored under the chat
 * before its first turn is saved; `save` therefore upserts by id.
 *
 * Authorization mirrors {@link PaywallAssetService}: a plain membership check on
 * the authenticated {@link AuthSession}. Reads/deletes require org membership;
 * writes additionally require the caller to have access to the target project
 * under that org (anti-spoof, never trusting the project from the body alone).
 * `Db` and `PublicFileStore` are provided by the application root.
 */
export class AiChatService extends Context.Service<AiChatService>()("AiChatService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const publicFileStore = yield* PublicFileStore;

    const assertOrgMember = (organizationId: string) =>
      Effect.gen(function* () {
        const session = yield* AuthSession;
        if (!isSessionOrganizationMember(session, organizationId)) {
          return yield* Effect.fail(
            new AiChatForbiddenError({
              message: `Not a member of organization ${organizationId}.`,
            }),
          );
        }
      });

    const assertProjectMember = (projectId: string, organizationId: string) =>
      Effect.gen(function* () {
        const session = yield* AuthSession;
        if (!isSessionProjectMember(session, projectId, organizationId)) {
          return yield* Effect.fail(
            new AiChatForbiddenError({
              message: `No access to project ${projectId}.`,
            }),
          );
        }
      });

    const currentUserId = Effect.gen(function* () {
      const session = yield* AuthSession;
      return session.user?.id ?? null;
    });

    const rowToSummary = (row: typeof voidhashAiChat.$inferSelect): AiChatSummary => ({
      id: row.id,
      title: row.title,
      chatType: row.chatType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });

    const rowToChat = (row: typeof voidhashAiChat.$inferSelect): AiChatRow => ({
      ...rowToSummary(row),
      organizationId: row.organizationId,
      projectId: row.projectId,
      surface: row.surface,
      paywallId: row.paywallId,
      messages: row.messages,
    });

    /** Load a row by id or fail not-found. */
    const findRow = (chatId: string) =>
      Effect.gen(function* () {
        const rows = yield* db
          .select()
          .from(voidhashAiChat)
          .where(eq(voidhashAiChat.id, chatId))
          .limit(1);
        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(new AiChatNotFoundError({ chatId }));
        }
        return row;
      });

    const save = Effect.fn("saveAiChat")(
      function* (input: AiChatSaveInput) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
        yield* assertProjectMember(input.projectId, input.organizationId);
        const userId = yield* currentUserId;

        const title = input.title.slice(0, 255);
        const now = new Date();
        const inserted = yield* db
          .insert(voidhashAiChat)
          .values({
            id: input.id,
            organizationId: input.organizationId,
            projectId: input.projectId,
            surface: input.surface,
            chatType: input.chatType,
            paywallId: input.paywallId ?? null,
            userId,
            title,
            messages: input.messages,
          })
          .onConflictDoUpdate({
            target: voidhashAiChat.id,
            // Only mutable fields — never reassign org/project/owner on replace.
            set: { title, messages: input.messages, updatedAt: now },
          })
          .returning();

        return rowToSummary(inserted[0]!);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    const list = Effect.fn("listAiChats")(
      function* (input: AiChatListInput) {
        yield* assertProjectMember(input.projectId, input.organizationId);
        const scope = [
          eq(voidhashAiChat.projectId, input.projectId),
          eq(voidhashAiChat.surface, input.surface),
          eq(voidhashAiChat.chatType, "persistent"),
          input.paywallId ? eq(voidhashAiChat.paywallId, input.paywallId) : undefined,
        ];
        const rows = yield* db
          .select()
          .from(voidhashAiChat)
          .where(and(...scope))
          .orderBy(desc(voidhashAiChat.updatedAt), desc(voidhashAiChat.id));
        return rows.map(rowToSummary);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    const get = Effect.fn("getAiChat")(
      function* (input: { readonly chatId: string }) {
        const row = yield* findRow(input.chatId);
        yield* assertOrgMember(row.organizationId);
        return rowToChat(row);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    const remove = Effect.fn("deleteAiChat")(
      function* (input: { readonly chatId: string }) {
        const row = yield* findRow(input.chatId);
        yield* assertOrgMember(row.organizationId);
        yield* db.delete(voidhashAiChat).where(eq(voidhashAiChat.id, input.chatId));
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    const uploadAttachment = Effect.fn("uploadAiChatAttachment")(
      function* (input: AiChatAttachmentUploadInput) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
        yield* assertOrgMember(input.organizationId);

        const { bytes, ext } = yield* validateAndDecodePaywallAsset({
          imageBase64: input.dataBase64,
          contentType: input.contentType,
        });

        // Chat attachments live under a dedicated prefix, separate from the org
        // asset library: ai-chats/<chatId>/attachments/<attachmentId>.<ext>.
        const attachmentId = generateId("aiChatAttachment");
        const key = `ai-chats/${input.chatId}/attachments/${attachmentId}.${ext}`;
        yield* publicFileStore.putObject({ key, body: bytes, contentType: input.contentType });

        return {
          url: publicFileStore.publicUrl(key),
          name: input.name.slice(0, 255),
          contentType: input.contentType,
          sizeBytes: bytes.length,
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            PublicFileStoreError: (error) =>
              Effect.fail(new AiChatServiceError({ message: error.cause })),
            PaywallAssetValidationError: (error: PaywallAssetValidationError) =>
              Effect.fail(new AiChatAttachmentValidationError({ message: error.message })),
          }),
        ),
    );

    const captureCheckpointReporting = Effect.fn("captureAiCheckpoint")(
      function* (input: {
        readonly chatId: string;
        readonly turnId: string;
        readonly paywallId: string;
        readonly tree: unknown;
      }) {
        // First-write-wins per (chat, turn, document): only the FIRST accepted
        // write to a document in a turn captures the pre-turn image. A later write
        // to the same document in the same turn is a no-op insert (nothing set on
        // conflict), preserving the pre-turn baseline. `.returning()` yields the
        // inserted row on a real insert and an EMPTY array on the conflict no-op,
        // so `inserted.length > 0` is exactly "this call took the checkpoint".
        const inserted = yield* db
          .insert(voidhashAiCheckpoint)
          .values({
            id: generateId("aiCheckpoint"),
            chatId: input.chatId,
            turnId: input.turnId,
            paywallId: input.paywallId,
            tree: input.tree,
          })
          .onConflictDoNothing({
            target: [
              voidhashAiCheckpoint.chatId,
              voidhashAiCheckpoint.turnId,
              voidhashAiCheckpoint.paywallId,
            ],
          })
          .returning({ id: voidhashAiCheckpoint.id });
        return { captured: inserted.length > 0 };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    /** Void-returning capture for callers that don't need the taken/no-op signal. */
    const captureCheckpoint = (input: {
      readonly chatId: string;
      readonly turnId: string;
      readonly paywallId: string;
      readonly tree: unknown;
    }) => captureCheckpointReporting(input).pipe(Effect.asVoid);

    const getLastTurnCheckpoints = Effect.fn("getLastTurnAiCheckpoints")(
      function* (input: { readonly chatId: string }) {
        const chat = yield* findRow(input.chatId);
        // Reverting mutates this chat's project-scoped paywall documents, so
        // require project membership (not just org membership) — an org member
        // outside the chat's project must not be able to revert its paywalls.
        yield* assertProjectMember(chat.projectId, chat.organizationId);

        // The chat's newest checkpoint identifies the last turn; return all of
        // that turn's pre-images (one per touched document).
        const newest = yield* db
          .select({ turnId: voidhashAiCheckpoint.turnId })
          .from(voidhashAiCheckpoint)
          .where(eq(voidhashAiCheckpoint.chatId, input.chatId))
          .orderBy(desc(voidhashAiCheckpoint.createdAt), desc(voidhashAiCheckpoint.id))
          .limit(1);
        const turnId = newest[0]?.turnId;
        if (turnId === undefined) {
          return [];
        }
        const rows = yield* db
          .select({
            paywallId: voidhashAiCheckpoint.paywallId,
            tree: voidhashAiCheckpoint.tree,
          })
          .from(voidhashAiCheckpoint)
          .where(
            and(
              eq(voidhashAiCheckpoint.chatId, input.chatId),
              eq(voidhashAiCheckpoint.turnId, turnId),
            ),
          );
        return rows.map(
          (row): AiCheckpointPreImage => ({ paywallId: row.paywallId, tree: row.tree }),
        );
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new AiChatServiceError({ message: String(error.cause) })),
          }),
        ),
    );

    return {
      save,
      list,
      get,
      delete: remove,
      uploadAttachment,
      captureCheckpoint,
      captureCheckpointReporting,
      getLastTurnCheckpoints,
    } as const;
  }),
}) {
  static layer = Layer.effect(AiChatService)(AiChatService.make);
}
