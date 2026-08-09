import { constant } from "@voidhash/lib/lang";
import { Cause, Context, Effect, Layer, Schema } from "effect";

import { Db, desc, eq, paywallAsset } from "@voidhash/db";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  derivePaywallAssetKey,
  isOwnedPaywallAssetUrl,
  paywallAssetKeyFromUrl,
  paywallAssetSha256Hex,
  validateAndDecodePaywallAsset,
} from "../../domain/paywallAssetImage.ts";
import { generateId } from "../../utils/generate-id.ts";
import { isSessionOrganizationMember } from "../../utils/permissions.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";

/** Catch-all error raised by {@link PaywallAssetService} public methods. */
export class PaywallAssetServiceError extends Schema.TaggedErrorClass<PaywallAssetServiceError>(
  "PaywallAssetServiceError",
)("PaywallAssetServiceError", { message: Schema.String }) {}

/** Raised when the caller is not a member of the target asset's organization. */
export class PaywallAssetForbiddenError extends Schema.TaggedErrorClass<PaywallAssetForbiddenError>(
  "PaywallAssetForbiddenError",
)("PaywallAssetForbiddenError", { message: Schema.String }) {}

/** Raised when the referenced asset row does not exist. */
export class PaywallAssetNotFoundError extends Schema.TaggedErrorClass<PaywallAssetNotFoundError>(
  "PaywallAssetNotFoundError",
)("PaywallAssetNotFoundError", { assetId: Schema.String }) {}

/** One stored paywall asset row as returned by the service. */
export interface PaywallAssetRow {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly url: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly createdAt: Date;
}

/**
 * `PaywallAssetService` owns the organization-scoped image asset library backing
 * paywall backgrounds. Callers upload images (validated + content-addressed),
 * list/rename/delete them; stored public URLs are reused as paywall background
 * images.
 *
 * Authorization is a plain org-membership check derived from the authenticated
 * {@link AuthSession} — every member of an organization may manage its assets.
 * `Db` and `PublicFileStore` are provided by the application root; both are
 * abstract ports, so the service stays infra-pure.
 */
export class PaywallAssetService extends Context.Service<PaywallAssetService>()(
  "PaywallAssetService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const publicFileStore = yield* PublicFileStore;

      /** Assert the session is a member of `organizationId`, else fail forbidden. */
      const assertMember = (organizationId: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          if (!isSessionOrganizationMember(session, organizationId)) {
            return yield* Effect.fail(
              new PaywallAssetForbiddenError({
                message: `Not a member of organization ${organizationId}.`,
              }),
            );
          }
        });

      const rowToAsset = (row: typeof paywallAsset.$inferSelect): PaywallAssetRow => ({
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        url: row.url,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        createdAt: row.createdAt,
      });

      const upload = Effect.fn("uploadPaywallAsset")(
        function* (input: {
          readonly organizationId: string;
          readonly name: string;
          readonly contentType: string;
          readonly imageBase64: string;
          readonly width?: number | null;
          readonly height?: number | null;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          yield* assertMember(input.organizationId);

          const { bytes, ext } = yield* validateAndDecodePaywallAsset(input);
          const sha256 = yield* paywallAssetSha256Hex(bytes);
          const key = derivePaywallAssetKey(input.organizationId, sha256, ext);

          // Content-addressed dedup: an identical image already uploaded to this
          // org resolves to the same key. Return the existing row instead of
          // re-uploading (the object is already stored).
          const existing = yield* db
            .select()
            .from(paywallAsset)
            .where(eq(paywallAsset.key, key))
            .limit(1);
          if (existing[0]) {
            return rowToAsset(existing[0]);
          }

          yield* publicFileStore.putObject({ key, body: bytes, contentType: input.contentType });
          const url = publicFileStore.publicUrl(key);

          const id = generateId("paywallAsset");
          const inserted = yield* db
            .insert(paywallAsset)
            .values({
              id,
              organizationId: input.organizationId,
              name: input.name.slice(0, 255),
              key,
              url,
              contentType: input.contentType,
              sizeBytes: bytes.length,
              width: input.width ?? null,
              height: input.height ?? null,
            })
            .returning();

          return rowToAsset(inserted[0]!);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallAssetServiceError({ message: String(error.cause) })),
              PublicFileStoreError: (error) =>
                Effect.fail(new PaywallAssetServiceError({ message: error.cause })),
            }),
          ),
      );

      const list = Effect.fn("listPaywallAssets")(
        function* (input: { readonly organizationId: string }) {
          yield* assertMember(input.organizationId);
          const rows = yield* db
            .select()
            .from(paywallAsset)
            .where(eq(paywallAsset.organizationId, input.organizationId))
            .orderBy(desc(paywallAsset.createdAt), desc(paywallAsset.id));
          return rows.map(rowToAsset);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallAssetServiceError({ message: String(error.cause) })),
            }),
          ),
      );

      /** Load a row by id or fail not-found. */
      const findRow = (assetId: string) =>
        Effect.gen(function* () {
          const rows = yield* db
            .select()
            .from(paywallAsset)
            .where(eq(paywallAsset.id, assetId))
            .limit(1);
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(new PaywallAssetNotFoundError({ assetId }));
          }
          return row;
        });

      const rename = Effect.fn("renamePaywallAsset")(
        function* (input: { readonly assetId: string; readonly name: string }) {
          const row = yield* findRow(input.assetId);
          yield* assertMember(row.organizationId);
          const updated = yield* db
            .update(paywallAsset)
            .set({ name: input.name.slice(0, 255) })
            .where(eq(paywallAsset.id, input.assetId))
            .returning();
          return rowToAsset(updated[0]!);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallAssetServiceError({ message: String(error.cause) })),
            }),
          ),
      );

      const remove = Effect.fn("deletePaywallAsset")(
        function* (input: { readonly assetId: string }) {
          const row = yield* findRow(input.assetId);
          yield* assertMember(row.organizationId);

          yield* db.delete(paywallAsset).where(eq(paywallAsset.id, input.assetId));

          // Best-effort object cleanup, scoped to keys we own for this org (the
          // `key` unique index guarantees no other row references this object).
          if (isOwnedPaywallAssetUrl(row.url, row.organizationId, publicFileStore.publicBaseUrl)) {
            const key = paywallAssetKeyFromUrl(
              row.url,
              row.organizationId,
              publicFileStore.publicBaseUrl,
            );
            if (key !== null) {
              yield* publicFileStore
                .deleteObject(key)
                .pipe(
                  Effect.catchCause((cause) =>
                    Effect.logWarning(
                      `Failed to delete paywall asset object ${key}: ${Cause.pretty(cause)}`,
                    ),
                  ),
                );
            }
          }
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallAssetServiceError({ message: String(error.cause) })),
            }),
          ),
      );

      return constant({ upload, list, rename, delete: remove });
    }),
  },
) {
  static layer = Layer.effect(PaywallAssetService)(PaywallAssetService.make);
}
