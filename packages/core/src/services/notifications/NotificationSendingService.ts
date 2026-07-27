import { Context, Effect, Layer, Schema } from "effect";

import { NotificationConfigNotEnabledError } from "../../domain/notifications/PushNotificationConfiguration.ts";
import {
  Db,
  PushNotificationSendStatus,
  PushNotificationDeliveryStatus,
  pushNotificationConfigs,
  pushNotificationDeliveries,
  pushNotificationSends,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { PersonIdentityService } from "../personIdentity/PersonIdentityService.ts";
import { PersonNotificationTokenService } from "./PersonNotificationTokenService.ts";
import { PushDeliveryDispatch } from "./PushDeliveryDispatch.ts";
import type { PushMessage } from "./push-delivery-provider.ts";

/** Catch-all send-service error. Wraps infra + downstream failures at the boundary. */
export class NotificationSendingServiceError extends Schema.TaggedErrorClass<NotificationSendingServiceError>(
  "NotificationSendingServiceError",
)("NotificationSendingServiceError", { cause: Schema.String }) {}

export interface SendNotificationInput {
  readonly projectId: string;
  readonly message: PushMessage;
  /** Canonical person ids to target directly (server-trusted). */
  readonly personIds?: ReadonlyArray<string>;
  /** Distinct ids resolved to canonical persons; unmapped ones are recorded, never fail the send. */
  readonly distinctIds?: ReadonlyArray<string>;
  /** Optional caller key collapsing retries into a single send (per project). */
  readonly idempotencyKey?: string;
}

export interface SendNotificationResult {
  readonly pushNotificationSendId: string;
  readonly deviceCount: number;
  readonly status: number;
  readonly unresolvedDistinctIds: ReadonlyArray<string>;
}

/**
 * The synchronous half of a push send — the analog of `WebhookDispatchService`.
 * Resolves the audience (canonical persons + their active devices), writes the
 * durable trail (one `push_notification_send` parent + one
 * `push_notification_delivery` per device), and hands the delivery ids to the
 * {@link PushDeliveryDispatch} queue. It NEVER performs a network send itself:
 * the request returns once the rows are committed and enqueued; the async
 * `PushDeliveryService` (per queue message) does the actual FCM/APNs call.
 *
 * Invariants folded in:
 *  - up-front `NotificationConfigNotEnabledError` if the project has no enabled
 *    provider (a send targeting nobody's provider is a config error, not a
 *    per-device failure);
 *  - targeting a distinct id with no person mapping is recorded in
 *    `unresolvedDistinctIds`, never fatal;
 *  - `idempotencyKey` short-circuits a duplicate send to the existing row;
 *  - devices whose provider has no enabled config are counted as `skipped`
 *    (no delivery row, no queue message).
 */
export class NotificationSendingService extends Context.Service<NotificationSendingService>()(
  "NotificationSendingService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const personIdentity = yield* PersonIdentityService;
      const links = yield* PersonNotificationTokenService;
      const dispatch = yield* PushDeliveryDispatch;

      const send = Effect.fn("sendPushNotification")(
        function* (input: SendNotificationInput) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);

          // 1. Idempotency short-circuit (only when a key is supplied).
          if (input.idempotencyKey) {
            const existing = yield* db.query.pushNotificationSends.findFirst({
              where: { projectId: input.projectId, idempotencyKey: input.idempotencyKey },
            });
            if (existing) {
              yield* Effect.annotateCurrentSpan("voidhash.push.idempotent_replay", true);
              return {
                pushNotificationSendId: existing.id,
                deviceCount: existing.deviceCount,
                status: existing.status,
                unresolvedDistinctIds: existing.unresolvedDistinctIds,
              } satisfies SendNotificationResult;
            }
          }

          // 2. Fail the whole send up-front if no provider is enabled.
          const configs = yield* db.query.pushNotificationConfigs.findMany({
            where: { projectId: input.projectId, enabled: true, deletedAt: { isNull: true } },
          });
          const enabledProviders = new Set(configs.map((config) => config.providerId));
          if (enabledProviders.size === 0) {
            return yield* Effect.fail(
              new NotificationConfigNotEnabledError({
                message: "no enabled push notification configuration for this project",
              }),
            );
          }

          // 3. Resolve distinct ids to canonical persons (never creating one).
          const distinctIds = input.distinctIds ?? [];
          const resolvedPersonIds: Array<string> = [];
          const unresolvedDistinctIds: Array<string> = [];
          for (const distinctId of distinctIds) {
            const resolution = yield* personIdentity.resolveDistinctId({
              projectId: input.projectId,
              distinctId,
              shouldCreatePerson: false,
              eventTimestamp: new Date(),
              setAttributes: {},
              setOnceAttributes: {},
            });
            if (resolution.identity.personId) {
              resolvedPersonIds.push(resolution.identity.personId);
            } else {
              unresolvedDistinctIds.push(distinctId);
            }
          }
          const canonicalPersonIds = [
            ...new Set([...(input.personIds ?? []), ...resolvedPersonIds]),
          ];

          // 4. Load their active devices; keep only those routed to an enabled
          //    provider, and dedupe by device id. The loader dedupes by
          //    (personId, platformToken), so a device that a merge collision left
          //    linked to BOTH a survivor and a loser person surfaces twice — that
          //    would both double-deliver AND violate the (send, device) unique
          //    index. Collapse to one delivery per physical device (first wins).
          const devices = yield* links.getActiveTokensForPersonIds(
            input.projectId,
            canonicalPersonIds,
          );
          const enabledDevices = devices.filter((device) => enabledProviders.has(device.provider));
          const seenDeviceIds = new Set<string>();
          const deliverable = enabledDevices.filter((device) => {
            if (seenDeviceIds.has(device.pushDeviceTokenId)) {
              return false;
            }
            seenDeviceIds.add(device.pushDeviceTokenId);
            return true;
          });
          const skippedCount = devices.length - deliverable.length;
          const deliveries = deliverable.map((device) => ({
            deliveryId: generateId("pushNotificationDelivery"),
            device,
          }));

          // 5. Persist the parent + per-device rows atomically.
          const sendId = generateId("pushNotificationSend");
          yield* Effect.annotateCurrentSpan("voidhash.push.send_id", sendId);
          yield* Effect.annotateCurrentSpan("voidhash.push.device_count", deliverable.length);
          const status =
            deliverable.length === 0
              ? PushNotificationSendStatus.NoRecipients
              : PushNotificationSendStatus.Pending;

          // Persist the trail; on a unique-violation from a CONCURRENT send with
          // the same idempotency key (the pre-check above races the insert), fall
          // back to the winner's row as an idempotent replay instead of surfacing
          // a 500. A re-read that finds no such row means the failure was genuine,
          // so re-raise it.
          const idempotentReplay: SendNotificationResult | null = yield* db
            .transaction((tx) =>
              Effect.gen(function* () {
                yield* tx.insert(pushNotificationSends).values({
                  id: sendId,
                  projectId: input.projectId,
                  idempotencyKey: input.idempotencyKey ?? null,
                  message: input.message as unknown as Record<string, unknown>,
                  requestedPersonIds: [...(input.personIds ?? [])],
                  requestedDistinctIds: [...distinctIds],
                  unresolvedDistinctIds,
                  status,
                  deviceCount: deliverable.length,
                  succeededCount: 0,
                  failedCount: 0,
                  skippedCount,
                  ...(deliverable.length === 0 ? { completedAt: new Date() } : {}),
                });
                for (const delivery of deliveries) {
                  yield* tx.insert(pushNotificationDeliveries).values({
                    id: delivery.deliveryId,
                    pushNotificationSendId: sendId,
                    projectId: input.projectId,
                    personId: delivery.device.personId,
                    pushDeviceTokenId: delivery.device.pushDeviceTokenId,
                    provider: delivery.device.provider,
                    status: PushNotificationDeliveryStatus.Pending,
                    attemptCount: 0,
                    maxAttempts: 5,
                  });
                }
              }),
            )
            .pipe(
              Effect.as<SendNotificationResult | null>(null),
              Effect.catch((error) =>
                input.idempotencyKey === undefined
                  ? Effect.fail(error)
                  : db.query.pushNotificationSends
                      .findFirst({
                        where: {
                          projectId: input.projectId,
                          idempotencyKey: input.idempotencyKey,
                        },
                      })
                      .pipe(
                        Effect.flatMap((existing) =>
                          existing
                            ? Effect.succeed<SendNotificationResult | null>({
                                pushNotificationSendId: existing.id,
                                deviceCount: existing.deviceCount,
                                status: existing.status,
                                unresolvedDistinctIds: existing.unresolvedDistinctIds,
                              })
                            : Effect.fail(error),
                        ),
                      ),
              ),
            );
          if (idempotentReplay) {
            yield* Effect.annotateCurrentSpan("voidhash.push.idempotent_replay", true);
            return idempotentReplay;
          }

          // 6. Enqueue (outside the DB transaction). A dispatch failure surfaces
          //    to the caller — the rows exist and a retry/backfill could re-enqueue.
          if (deliveries.length > 0) {
            yield* dispatch
              .dispatch(
                deliveries.map((delivery) => ({
                  pushNotificationDeliveryId: delivery.deliveryId,
                  pushNotificationSendId: sendId,
                  projectId: input.projectId,
                  provider: delivery.device.provider,
                })),
              )
              .pipe(
                Effect.mapError(
                  (error) => new NotificationSendingServiceError({ cause: error.cause }),
                ),
              );
          }

          return {
            pushNotificationSendId: sendId,
            deviceCount: deliverable.length,
            status,
            unresolvedDistinctIds,
          } satisfies SendNotificationResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new NotificationSendingServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new NotificationSendingServiceError({ cause: String(error.cause) })),
              PersonServiceError: (error) =>
                Effect.fail(new NotificationSendingServiceError({ cause: String(error.cause) })),
              PersonNotificationTokenServiceError: (error) =>
                Effect.fail(new NotificationSendingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return { send } as const;
    }),
  },
) {
  static layer = Layer.effect(NotificationSendingService)(NotificationSendingService.make);
}
