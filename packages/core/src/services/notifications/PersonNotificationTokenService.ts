import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import {
  and,
  Db,
  type DbTransaction,
  eq,
  inArray,
  isNull,
  ne,
  pushPersonDeviceTokens,
  sql,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";

/** Catch-all service error. Wraps `EffectDrizzleQueryError` at the boundary. */
export class PersonNotificationTokenServiceError extends Schema.TaggedErrorClass<PersonNotificationTokenServiceError>(
  "PersonNotificationTokenServiceError",
)("PersonNotificationTokenServiceError", { cause: Schema.String }) {}

/** A send-time device resolved through the person→device link table. */
export interface ActivePushDevice {
  readonly personId: string;
  readonly pushDeviceTokenId: string;
  readonly platform: string;
  readonly provider: string;
  readonly platformToken: string;
  readonly bundleId: string | null;
  readonly environment: string | null;
}

/** Shared empty result for a send that targets no canonical person. */
const NO_ACTIVE_DEVICES: ReadonlyArray<ActivePushDevice> = [];

/**
 * Answers "which devices belong to a person right now?" — owns the
 * person⟷device link queries, the revoke path, and the merge re-point hook. It
 * does NOT mint UUIDs or resolve distinctIds; `NotificationTokenService.register`
 * is the single writer of link creation/transfer. The tx-scoped mutation
 * helpers take a `DbTransaction` so they commit/roll back with the caller's
 * transaction (matching the `IdentityMutationService` convention); the
 * send-time loader uses the captured request-scoped `db`.
 */
export class PersonNotificationTokenService extends Context.Service<PersonNotificationTokenService>()(
  "PersonNotificationTokenService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      /** Idempotent on `(personId, pushDeviceTokenId)`; REVIVES a soft-deleted link. */
      const link = (
        tx: DbTransaction,
        input: {
          readonly projectId: string;
          readonly personId: string;
          readonly pushDeviceTokenId: string;
        },
      ) =>
        Effect.gen(function* () {
          const existing = yield* tx.query.pushPersonDeviceTokens.findFirst({
            where: { personId: input.personId, pushDeviceTokenId: input.pushDeviceTokenId },
          });
          if (existing) {
            yield* tx
              .update(pushPersonDeviceTokens)
              .set({ deletedAt: null, updatedAt: yield* DateTime.nowAsDate })
              .where(eq(pushPersonDeviceTokens.id, existing.id));
            return;
          }
          yield* tx.insert(pushPersonDeviceTokens).values({
            id: generateId("personPushDeviceToken"),
            projectId: input.projectId,
            personId: input.personId,
            pushDeviceTokenId: input.pushDeviceTokenId,
          });
        });

      /** Soft-delete the caller's link (unregister / opt-out). */
      const unlink = (
        tx: DbTransaction,
        input: {
          readonly projectId: string;
          readonly personId: string;
          readonly pushDeviceTokenId: string;
        },
      ) =>
        Effect.gen(function* () {
          const now = yield* DateTime.nowAsDate;
          return yield* tx
            .update(pushPersonDeviceTokens)
            .set({ deletedAt: now, updatedAt: now })
            .where(
              and(
                eq(pushPersonDeviceTokens.projectId, input.projectId),
                eq(pushPersonDeviceTokens.personId, input.personId),
                eq(pushPersonDeviceTokens.pushDeviceTokenId, input.pushDeviceTokenId),
              ),
            );
        });

      /**
       * Ownership TRANSFER (last-registration-wins): soft-delete every ACTIVE
       * link to this device that belongs to a DIFFERENT person, preventing
       * cross-user notification leak.
       */
      const unlinkOtherOwners = (
        tx: DbTransaction,
        input: {
          readonly projectId: string;
          readonly pushDeviceTokenId: string;
          readonly keepPersonId: string;
        },
      ) =>
        Effect.gen(function* () {
          const now = yield* DateTime.nowAsDate;
          return yield* tx
            .update(pushPersonDeviceTokens)
            .set({ deletedAt: now, updatedAt: now })
            .where(
              and(
                eq(pushPersonDeviceTokens.projectId, input.projectId),
                eq(pushPersonDeviceTokens.pushDeviceTokenId, input.pushDeviceTokenId),
                ne(pushPersonDeviceTokens.personId, input.keepPersonId),
                isNull(pushPersonDeviceTokens.deletedAt),
              ),
            );
        });

      /** Active-link lookup for ownership assertion (refresh / unregister). */
      const findActiveLink = (
        tx: DbTransaction,
        input: {
          readonly projectId: string;
          readonly personId: string;
          readonly pushDeviceTokenId: string;
        },
      ) =>
        tx.query.pushPersonDeviceTokens.findFirst({
          where: {
            projectId: input.projectId,
            personId: input.personId,
            pushDeviceTokenId: input.pushDeviceTokenId,
            deletedAt: { isNull: true },
          },
        });

      /** Count ACTIVE owners of a device (unregister decides device soft-delete). */
      const countActiveOwners = (
        tx: DbTransaction,
        input: { readonly projectId: string; readonly pushDeviceTokenId: string },
      ) =>
        tx.query.pushPersonDeviceTokens
          .findMany({
            where: {
              projectId: input.projectId,
              pushDeviceTokenId: input.pushDeviceTokenId,
              deletedAt: { isNull: true },
            },
          })
          .pipe(Effect.map((rows) => rows.length));

      /**
       * Send-time loader. Expands each canonical id to its merged-loser set
       * (belt), joins active links × devices, drops invalidated devices, and
       * dedupes by `(personId, platformToken)` (suspenders) so a person's
       * multiple devices — and any briefly-live pre/post-reinstall UUID pair —
       * never double-deliver.
       */
      const getActiveTokensForPersonIds = Effect.fn("getActiveTokensForPersonIds")(
        function* (projectId: string, canonicalPersonIds: ReadonlyArray<string>) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.push.canonical_person_count",
            canonicalPersonIds.length,
          );
          if (canonicalPersonIds.length === 0) {
            return NO_ACTIVE_DEVICES;
          }

          // Belt: every loser whose merge chain lands on a requested canonical id.
          const loserRows = yield* db.query.persons.findMany({
            where: { projectId, mergedIntoPersonId: { in: [...canonicalPersonIds] } },
          });
          const personIds = [
            ...new Set([...canonicalPersonIds, ...loserRows.map((person) => person.id)]),
          ];

          const rows = yield* db.query.pushPersonDeviceTokens.findMany({
            where: { projectId, personId: { in: personIds }, deletedAt: { isNull: true } },
            with: { deviceToken: true },
          });

          // Suspenders: drop invalidated devices, dedupe by (personId, platformToken).
          const deduped = new Map<string, ActivePushDevice>();
          for (const row of rows) {
            const device = row.deviceToken;
            if (!device || device.deletedAt || device.invalidatedAt) {
              continue;
            }
            deduped.set(`${row.personId}:${device.platformToken}`, {
              personId: row.personId,
              pushDeviceTokenId: device.id,
              platform: device.platform,
              provider: device.provider,
              platformToken: device.platformToken,
              bundleId: device.bundleId,
              environment: device.environment,
            });
          }
          yield* Effect.annotateCurrentSpan("voidhash.push.device_count", deduped.size);
          const devices: ReadonlyArray<ActivePushDevice> = [...deduped.values()];
          return devices;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PersonNotificationTokenServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      /**
       * The merge hook. Re-points `push_person_device_token.personId` to the
       * survivor — runs INSIDE the caller's merge / projection-rebuild
       * transaction, exactly like `personIdentities.personId` is re-pointed.
       * The send-time loader ALSO expands the loser set (belt-and-suspenders).
       */
      const repointLinksToSurvivor = (
        tx: DbTransaction,
        input: {
          readonly projectId: string;
          readonly loserPersonIds: ReadonlyArray<string>;
          readonly survivorPersonId: string;
        },
      ) =>
        Effect.gen(function* () {
          if (input.loserPersonIds.length === 0) {
            return;
          }
          // NOT EXISTS skips devices the survivor already owns: the
          // (person_id, push_device_token_id) unique index is global (ignores
          // deleted_at), so a bare re-point would raise a unique violation. A
          // skipped colliding loser link stays reachable via the send-time
          // merged-loser expansion (belt-and-suspenders).
          yield* tx
            .update(pushPersonDeviceTokens)
            .set({ personId: input.survivorPersonId, updatedAt: yield* DateTime.nowAsDate })
            .where(
              and(
                eq(pushPersonDeviceTokens.projectId, input.projectId),
                inArray(pushPersonDeviceTokens.personId, [...input.loserPersonIds]),
                sql`not exists (select 1 from push_person_device_token s where s.person_id = ${input.survivorPersonId} and s.push_device_token_id = push_person_device_token.push_device_token_id)`,
              ),
            );
        });

      return constant({
        countActiveOwners,
        findActiveLink,
        getActiveTokensForPersonIds,
        link,
        repointLinksToSurvivor,
        unlink,
        unlinkOtherOwners,
      });
    }),
  },
) {
  static layer = Layer.effect(PersonNotificationTokenService)(PersonNotificationTokenService.make);
}
