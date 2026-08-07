import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";

import {
  InvalidPushMessageError,
  PushDeviceTokenNotFoundError,
} from "../../domain/notifications/PushDeviceToken.ts";
import {
  and,
  AuditLogAction,
  AuditLogEntityType,
  Db,
  eq,
  isNull,
  pushDeviceTokens,
  pushPersonDeviceTokens,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { PersonNotificationTokenService } from "./PersonNotificationTokenService.ts";
import type {
  DevicePlatform,
  PushDeliveryProviderKind,
  PushEnvironment,
} from "./push-delivery-provider.ts";

/** Catch-all service error. Wraps `EffectDrizzleQueryError` at the boundary. */
export class NotificationTokenServiceError extends Schema.TaggedErrorClass<NotificationTokenServiceError>(
  "NotificationTokenServiceError",
)("NotificationTokenServiceError", { cause: Schema.String }) {}

const DevicePlatformSchema = Schema.Literals(["ios", "android"]);
const PushDeliveryProviderKindSchema = Schema.Literals(["fcm", "apns"]);
const PushEnvironmentSchema = Schema.Literals(["sandbox", "production"]);

/**
 * Decodes a free-form `varchar` column into the union type the rest of the
 * system speaks. The columns are plain strings in Postgres, so a corrupt row
 * surfaces as a service error rather than an invalid value flowing to an
 * adapter.
 */
const decodeColumn = <A>(
  schema: Schema.Codec<A, string>,
  column: string,
  value: string,
): Effect.Effect<A, NotificationTokenServiceError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      () =>
        new NotificationTokenServiceError({
          cause: `unexpected ${column} value on push device token: ${value}`,
        }),
    ),
  );

/** Nullable `environment` column -> the optional APNs environment. */
const decodeEnvironment = (
  environment: string | null,
): Effect.Effect<"sandbox" | "production" | undefined, NotificationTokenServiceError> => {
  if (environment === null) return Effect.succeed(undefined);
  return decodeColumn(PushEnvironmentSchema, "environment", environment);
};

/**
 * Builds the relational filter for the `environment` half of the dedup key.
 * `environment` is either null (fcm) or a value (apns), never `''`, so an exact
 * match mirrors the unique index.
 */
const environmentFilter = (environment: string | null) => {
  if (environment === null) return constant({ environment: { isNull: true } });
  return { environment };
};

/**
 * The UUID seam: the ONLY component that mints, stores, and dereferences
 * platform credentials. Above this boundary the system speaks only the
 * `push_tok_` UUID plus a `(platform, provider)` discriminator — the analog of
 * how core never touches raw payment creds behind the `PaymentProvider` tags,
 * and of Expo's `ExpoPushToken`. Owns minting, the two-way exchange, and
 * freshness-gated invalidation; `PersonNotificationTokenService` owns the link
 * queries and the merge re-point.
 */
export class NotificationTokenService extends Context.Service<NotificationTokenService>()(
  "NotificationTokenService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const links = yield* PersonNotificationTokenService;
      const auditLog = yield* AuditLogPort;

      /**
       * Exchange a platform credential for OUR `push_tok_` UUID. Idempotent on
       * the dedup key (incl. coalesced environment): REVIVES
       * `invalidatedAt`/`deletedAt` on conflict and returns the EXISTING UUID,
       * and TRANSFERS ownership (soft-deletes any active link to a different
       * person) — last-registration-wins.
       */
      const register = Effect.fn("registerPushDevice")(
        function* (input: {
          readonly projectId: string;
          readonly platform: DevicePlatform;
          readonly provider: PushDeliveryProviderKind;
          readonly platformToken: string;
          readonly bundleId?: string;
          readonly environment?: PushEnvironment;
          readonly callerPersonId: string;
          readonly previousPushDeviceTokenId?: string;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.push.provider", input.provider);
          yield* Effect.annotateCurrentSpan("voidhash.push.platform", input.platform);

          if (input.platformToken.length === 0) {
            return yield* Effect.fail(
              new InvalidPushMessageError({ message: "platformToken must not be empty" }),
            );
          }
          if (input.provider === "apns" && (!input.bundleId || !input.environment)) {
            return yield* Effect.fail(
              new InvalidPushMessageError({
                message: "apns registration requires bundleId and environment",
              }),
            );
          }

          const environment = input.environment ?? null;
          const bundleId = input.bundleId ?? null;

          const pushDeviceTokenId = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const now = yield* DateTime.nowAsDate;
              // Match the dedup key (projectId, provider, platformToken,
              // coalesce(environment,'')).
              const existing = yield* tx.query.pushDeviceTokens.findFirst({
                where: {
                  projectId: input.projectId,
                  provider: input.provider,
                  platformToken: input.platformToken,
                  ...environmentFilter(environment),
                },
              });

              let deviceId: string;
              if (existing) {
                deviceId = existing.id;
                yield* tx
                  .update(pushDeviceTokens)
                  .set({
                    platform: input.platform,
                    bundleId,
                    invalidatedAt: null,
                    invalidationReason: null,
                    deletedAt: null,
                    updatedAt: now,
                  })
                  .where(eq(pushDeviceTokens.id, existing.id));
              } else {
                deviceId = generateId("pushDeviceToken");
                yield* tx.insert(pushDeviceTokens).values({
                  id: deviceId,
                  projectId: input.projectId,
                  platform: input.platform,
                  provider: input.provider,
                  platformToken: input.platformToken,
                  bundleId,
                  environment,
                });
              }

              // Link the caller, then transfer ownership away from any prior
              // person (last-registration-wins) to prevent cross-user leak.
              yield* links.link(tx, {
                projectId: input.projectId,
                personId: input.callerPersonId,
                pushDeviceTokenId: deviceId,
              });
              yield* links.unlinkOtherOwners(tx, {
                projectId: input.projectId,
                pushDeviceTokenId: deviceId,
                keepPersonId: input.callerPersonId,
              });

              // Optional eager orphan reap of a stale UUID from a prior install.
              if (input.previousPushDeviceTokenId && input.previousPushDeviceTokenId !== deviceId) {
                yield* tx
                  .update(pushDeviceTokens)
                  .set({
                    invalidatedAt: now,
                    invalidationReason: "orphan-reaped",
                    deletedAt: now,
                    updatedAt: now,
                  })
                  .where(
                    and(
                      eq(pushDeviceTokens.id, input.previousPushDeviceTokenId),
                      eq(pushDeviceTokens.projectId, input.projectId),
                    ),
                  );
                yield* links.unlink(tx, {
                  projectId: input.projectId,
                  personId: input.callerPersonId,
                  pushDeviceTokenId: input.previousPushDeviceTokenId,
                });
              }

              return deviceId;
            }),
          );

          yield* Effect.annotateCurrentSpan("voidhash.push.device_token_id", pushDeviceTokenId);
          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.PushDeviceToken,
              entityId: pushDeviceTokenId,
              action: AuditLogAction.Created,
              changes: { provider: input.provider, platform: input.platform },
            })
            .pipe(Effect.ignore);
          return { pushDeviceTokenId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /** Same-install rotation under the SAME UUID; asserts ownership else NotFound. */
      const refresh = Effect.fn("refreshPushDevice")(
        function* (input: {
          readonly projectId: string;
          readonly callerPersonId: string;
          readonly pushDeviceTokenId: string;
          readonly newPlatformToken: string;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.push.device_token_id",
            input.pushDeviceTokenId,
          );

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ownership = yield* links.findActiveLink(tx, {
                projectId: input.projectId,
                personId: input.callerPersonId,
                pushDeviceTokenId: input.pushDeviceTokenId,
              });
              if (!ownership) {
                // Uniform NotFound: no existence oracle (not-found OR not-owned).
                return yield* Effect.fail(
                  new PushDeviceTokenNotFoundError({ message: "device token not found" }),
                );
              }
              const now = yield* DateTime.nowAsDate;
              yield* tx
                .update(pushDeviceTokens)
                .set({ platformToken: input.newPlatformToken, updatedAt: now })
                .where(
                  and(
                    eq(pushDeviceTokens.id, input.pushDeviceTokenId),
                    eq(pushDeviceTokens.projectId, input.projectId),
                  ),
                );
            }),
          );
          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.PushDeviceToken,
              entityId: input.pushDeviceTokenId,
              action: AuditLogAction.Updated,
            })
            .pipe(Effect.ignore);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /** Soft-delete the caller's link (and the device if no other owners remain). */
      const unregister = Effect.fn("unregisterPushDevice")(
        function* (input: {
          readonly projectId: string;
          readonly callerPersonId: string;
          readonly pushDeviceTokenId: string;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.push.device_token_id",
            input.pushDeviceTokenId,
          );

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ownership = yield* links.findActiveLink(tx, {
                projectId: input.projectId,
                personId: input.callerPersonId,
                pushDeviceTokenId: input.pushDeviceTokenId,
              });
              if (!ownership) {
                return yield* Effect.fail(
                  new PushDeviceTokenNotFoundError({ message: "device token not found" }),
                );
              }
              yield* links.unlink(tx, {
                projectId: input.projectId,
                personId: input.callerPersonId,
                pushDeviceTokenId: input.pushDeviceTokenId,
              });
              const remaining = yield* links.countActiveOwners(tx, {
                projectId: input.projectId,
                pushDeviceTokenId: input.pushDeviceTokenId,
              });
              if (remaining === 0) {
                const now = yield* DateTime.nowAsDate;
                yield* tx
                  .update(pushDeviceTokens)
                  .set({ deletedAt: now, updatedAt: now })
                  .where(
                    and(
                      eq(pushDeviceTokens.id, input.pushDeviceTokenId),
                      eq(pushDeviceTokens.projectId, input.projectId),
                    ),
                  );
              }
            }),
          );
          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.PushDeviceToken,
              entityId: input.pushDeviceTokenId,
              action: AuditLogAction.Deleted,
            })
            .pipe(Effect.ignore);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * The REVERSE exchange: UUID -> platform creds, at the last moment before
       * `adapter.deliver`. Filters on BOTH projectId AND id so a forged UUID can
       * never dereference another tenant's token.
       */
      const resolveForDelivery = Effect.fn("resolveForDelivery")(
        function* (input: { readonly projectId: string; readonly pushDeviceTokenId: string }) {
          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const device = yield* tx.query.pushDeviceTokens.findFirst({
                where: {
                  id: input.pushDeviceTokenId,
                  projectId: input.projectId,
                  deletedAt: { isNull: true },
                  invalidatedAt: { isNull: true },
                },
              });
              if (!device) {
                return yield* Effect.fail(
                  new PushDeviceTokenNotFoundError({ message: "device token not found" }),
                );
              }
              const platform: DevicePlatform = yield* decodeColumn(
                DevicePlatformSchema,
                "platform",
                device.platform,
              );
              const provider: PushDeliveryProviderKind = yield* decodeColumn(
                PushDeliveryProviderKindSchema,
                "provider",
                device.provider,
              );
              const environment: PushEnvironment | undefined = yield* decodeEnvironment(
                device.environment,
              );
              return {
                platform,
                provider,
                platformToken: device.platformToken,
                bundleId: device.bundleId ?? undefined,
                environment,
              };
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * FRESHNESS-GATED invalidate on terminal token feedback. SKIPS if the
       * device was re-registered after the receipt (`device.updatedAt >
       * observedAt`) so a stale 410/UNREGISTERED can never kill a live device.
       */
      const invalidate = Effect.fn("invalidatePushDevice")(
        function* (input: {
          readonly projectId: string;
          readonly pushDeviceTokenId: string;
          readonly reason: string;
          readonly observedAt: Date;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.push.device_token_id",
            input.pushDeviceTokenId,
          );

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const device = yield* tx.query.pushDeviceTokens.findFirst({
                where: { id: input.pushDeviceTokenId, projectId: input.projectId },
              });
              if (!device) {
                return;
              }
              const updatedAtMillis = (device.updatedAt ?? device.createdAt)?.getTime() ?? 0;
              if (updatedAtMillis > input.observedAt.getTime()) {
                // Re-registered after this attempt -> it is a live device; skip.
                yield* Effect.annotateCurrentSpan("voidhash.push.invalidate_skipped", true);
                return;
              }
              const now = yield* DateTime.nowAsDate;
              yield* tx
                .update(pushDeviceTokens)
                .set({ invalidatedAt: now, invalidationReason: input.reason })
                .where(
                  and(
                    eq(pushDeviceTokens.id, input.pushDeviceTokenId),
                    eq(pushDeviceTokens.projectId, input.projectId),
                  ),
                );
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /** GDPR hard-cleanup hook — wired into person-deletion COMPLETION (Phase 3). */
      const invalidateAllForPerson = Effect.fn("invalidateAllForPerson")(
        function* (input: { readonly projectId: string; readonly personId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const now = yield* DateTime.nowAsDate;
              const personLinks = yield* tx.query.pushPersonDeviceTokens.findMany({
                where: { projectId: input.projectId, personId: input.personId },
              });
              for (const personLink of personLinks) {
                yield* tx
                  .update(pushDeviceTokens)
                  .set({
                    invalidatedAt: now,
                    invalidationReason: "person-deleted",
                    deletedAt: now,
                    updatedAt: now,
                  })
                  .where(
                    and(
                      eq(pushDeviceTokens.id, personLink.pushDeviceTokenId),
                      eq(pushDeviceTokens.projectId, input.projectId),
                    ),
                  );
              }
              yield* tx
                .update(pushPersonDeviceTokens)
                .set({ deletedAt: now, updatedAt: now })
                .where(
                  and(
                    eq(pushPersonDeviceTokens.projectId, input.projectId),
                    eq(pushPersonDeviceTokens.personId, input.personId),
                    isNull(pushPersonDeviceTokens.deletedAt),
                  ),
                );
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationTokenServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({
        invalidate,
        invalidateAllForPerson,
        refresh,
        register,
        resolveForDelivery,
        unregister,
      });
    }),
  },
) {
  static layer = Layer.effect(NotificationTokenService)(NotificationTokenService.make);
}
