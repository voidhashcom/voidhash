import { Context, Effect, Layer, Schema } from "effect";

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
              // Match the dedup key (projectId, provider, platformToken,
              // coalesce(environment,'')). environment is null (fcm) or a value
              // (apns), never '', so an exact match mirrors the unique index.
              const existing = yield* tx.query.pushDeviceTokens.findFirst({
                where: {
                  projectId: input.projectId,
                  provider: input.provider,
                  platformToken: input.platformToken,
                  ...(environment === null ? { environment: { isNull: true } } : { environment }),
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
                    updatedAt: new Date(),
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
                    invalidatedAt: new Date(),
                    invalidationReason: "orphan-reaped",
                    deletedAt: new Date(),
                    updatedAt: new Date(),
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
              yield* tx
                .update(pushDeviceTokens)
                .set({ platformToken: input.newPlatformToken, updatedAt: new Date() })
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
                yield* tx
                  .update(pushDeviceTokens)
                  .set({ deletedAt: new Date(), updatedAt: new Date() })
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
              return {
                platform: device.platform as DevicePlatform,
                provider: device.provider as PushDeliveryProviderKind,
                platformToken: device.platformToken,
                bundleId: device.bundleId ?? undefined,
                environment: (device.environment ?? undefined) as PushEnvironment | undefined,
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
              const updatedAt = device.updatedAt ?? device.createdAt ?? new Date(0);
              if (updatedAt.getTime() > input.observedAt.getTime()) {
                // Re-registered after this attempt -> it is a live device; skip.
                yield* Effect.annotateCurrentSpan("voidhash.push.invalidate_skipped", true);
                return;
              }
              yield* tx
                .update(pushDeviceTokens)
                .set({ invalidatedAt: new Date(), invalidationReason: input.reason })
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
              const personLinks = yield* tx.query.pushPersonDeviceTokens.findMany({
                where: { projectId: input.projectId, personId: input.personId },
              });
              for (const personLink of personLinks) {
                yield* tx
                  .update(pushDeviceTokens)
                  .set({
                    invalidatedAt: new Date(),
                    invalidationReason: "person-deleted",
                    deletedAt: new Date(),
                    updatedAt: new Date(),
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
                .set({ deletedAt: new Date(), updatedAt: new Date() })
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

      return {
        invalidate,
        invalidateAllForPerson,
        refresh,
        register,
        resolveForDelivery,
        unregister,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(NotificationTokenService)(NotificationTokenService.make);
}
