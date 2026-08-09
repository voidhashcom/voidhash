import { constant, pick, stringOr } from "@voidhash/lib/lang";
import { Clock, Context, DateTime, Duration, Effect, Layer, Schema } from "effect";

import {
  and,
  Db,
  eq,
  inArray,
  isNull,
  PushNotificationDeliveryStatus,
  PushNotificationSendStatus,
  pushNotificationDeliveries,
  pushNotificationDeliveryAttempts,
  pushNotificationSends,
  sql,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { NotificationTokenService } from "./NotificationTokenService.ts";
import {
  ApplePushNotificationService,
  FirebaseCloudMessagingService,
  type AnyPushDeliveryProviderShape,
  type DeviceToken,
  type PushDeliveryError,
  type PushDeliverySuccess,
  type PushMessage,
} from "./push-delivery-provider.ts";

/** Catch-all delivery-engine error (infra). Retryable provider errors use the sibling below. */
export class PushDeliveryServiceError extends Schema.TaggedErrorClass<PushDeliveryServiceError>(
  "PushDeliveryServiceError",
)("PushDeliveryServiceError", { cause: Schema.String }) {}

/**
 * Signals the QUEUE to retry this message: a retryable provider outcome
 * (`Transient`/`RateExceeded`) that has NOT yet exhausted the delivery's attempt
 * budget. The consumer lets this bubble so Cloudflare redelivers per `maxRetries`.
 * `delaySeconds` is the schedule-derived hint recorded on the row for observability.
 */
export class PushDeliveryRetryableError extends Schema.TaggedErrorClass<PushDeliveryRetryableError>(
  "PushDeliveryRetryableError",
)("PushDeliveryRetryableError", { message: Schema.String, delaySeconds: Schema.Number }) {}

/** Push retry backoff, seconds: 10s, 30s, 5min, 30min, 2hr (the doc's schedule). */
const RETRY_SCHEDULE_SECONDS = constant([10, 30, 5 * 60, 30 * 60, 2 * 60 * 60]);

/**
 * Next retry delay for a delivery on its `attemptCount`-th attempt. An explicit
 * provider `Retry-After` overrides the schedule; otherwise the (1-indexed)
 * attempt selects a step, clamped to the last. Pure + deterministic so the
 * classification is directly unit-tested (queue-native retry means this value is
 * observability metadata on the row, not a live scheduler).
 */
export const nextPushDeliveryDelaySeconds = (
  attemptCount: number,
  retryAfterSeconds?: number,
): number => {
  if (retryAfterSeconds !== undefined && retryAfterSeconds >= 0) {
    return retryAfterSeconds;
  }
  const index = Math.min(Math.max(attemptCount - 1, 0), RETRY_SCHEDULE_SECONDS.length - 1);
  // The index is clamped into range; the `??` only discharges the
  // `noUncheckedIndexedAccess` union.
  return RETRY_SCHEDULE_SECONDS[index] ?? RETRY_SCHEDULE_SECONDS[0];
};

/**
 * Rebuild the typed {@link PushMessage} from the parent send's `jsonb` column
 * (the inverse of how `NotificationSendingService` persists it) without
 * asserting over the untyped record.
 */
const toPushMessage = (raw: Record<string, unknown> | undefined): PushMessage => {
  const source = raw ?? {};
  const message: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: string;
    badge?: number;
    priority?: "default" | "high";
    ttl?: number;
    channelId?: string;
    collapseId?: string;
  } = {
    title: stringOr(source.title, ""),
    body: stringOr(source.body, ""),
  };
  const data = source.data;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    message.data = Object.fromEntries(Object.entries(data));
  }
  if (typeof source.sound === "string") message.sound = source.sound;
  if (typeof source.badge === "number") message.badge = source.badge;
  if (source.priority === "default" || source.priority === "high")
    message.priority = source.priority;
  if (typeof source.ttl === "number") message.ttl = source.ttl;
  if (typeof source.channelId === "string") message.channelId = source.channelId;
  if (typeof source.collapseId === "string") message.collapseId = source.collapseId;
  return message;
};

/** Aggregate parent-send status from the child delivery tallies. */
const rollupSendStatus = ({
  inFlight,
  succeeded,
  total,
}: {
  readonly inFlight: number;
  readonly succeeded: number;
  readonly total: number;
}): number => {
  if (total === 0) return PushNotificationSendStatus.NoRecipients;
  if (inFlight > 0) return PushNotificationSendStatus.InProgress;
  if (succeeded === total) return PushNotificationSendStatus.Succeeded;
  if (succeeded === 0) return PushNotificationSendStatus.Failed;
  return PushNotificationSendStatus.PartialFailed;
};

/**
 * The delivery engine — the body the `PushDeliveryConsumer` runs per queue
 * message, and the async half of a push send (mirrors `WebhookDeliveryService`,
 * but queue-driven not workflow-driven). Owns the atomic claim/CAS, the
 * provider call, the append-only attempt log, the status transition + normalized
 * classification, the freshness-gated device invalidation, and the race-free
 * parent roll-up. The claim/CAS (`Pending|Failed & completed_at IS NULL ->
 * InProgress`) is the idempotency guard: terminal rows carry a `completedAt`, so
 * an at-least-once queue redelivery of a finished delivery is a no-op.
 */
export class PushDeliveryService extends Context.Service<PushDeliveryService>()(
  "PushDeliveryService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const notificationTokens = yield* NotificationTokenService;
      const fcm = yield* FirebaseCloudMessagingService;
      const apns = yield* ApplePushNotificationService;

      const recordAttempt = (input: {
        readonly deliveryId: string;
        readonly attemptNumber: number;
        readonly succeeded: boolean;
        readonly statusCode: number | null;
        readonly providerErrorCode: string | null;
        readonly durationMs: number | null;
        readonly errorMessage: string | null;
      }) =>
        db.insert(pushNotificationDeliveryAttempts).values({
          id: generateId("pushNotificationDeliveryAttempt"),
          pushNotificationDeliveryId: input.deliveryId,
          attemptNumber: input.attemptNumber,
          statusCode: input.statusCode,
          providerErrorCode: input.providerErrorCode?.slice(0, 100) ?? null,
          responseBody: null,
          errorMessage: input.errorMessage?.slice(0, 500) ?? null,
          durationMs: input.durationMs,
          succeeded: input.succeeded,
        });

      /** Terminal transition (Succeeded/Failed/Exhausted): stamps `completedAt`. */
      const finalizeDelivery = (input: {
        readonly deliveryId: string;
        readonly status: number;
        readonly providerMessageId?: string;
        readonly lastError?: string;
      }) =>
        Effect.gen(function* () {
          const completedAt = yield* DateTime.nowAsDate;
          return yield* db
            .update(pushNotificationDeliveries)
            .set({
              status: input.status,
              completedAt,
              nextAttemptAt: null,
              ...(input.providerMessageId && { providerMessageId: input.providerMessageId }),
              ...(input.lastError && { lastError: input.lastError.slice(0, 500) }),
            })
            .where(eq(pushNotificationDeliveries.id, input.deliveryId));
        });

      /** Non-terminal retry transition: status Failed, `completedAt` stays null (re-claimable). */
      const scheduleRetry = (input: {
        readonly deliveryId: string;
        readonly delaySeconds: number;
        readonly lastError: string;
      }) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;
          const nextAttemptAt = DateTime.toDateUtc(
            DateTime.addDuration(now, Duration.seconds(input.delaySeconds)),
          );
          return yield* db
            .update(pushNotificationDeliveries)
            .set({
              status: PushNotificationDeliveryStatus.Failed,
              nextAttemptAt,
              lastError: input.lastError.slice(0, 500),
            })
            .where(eq(pushNotificationDeliveries.id, input.deliveryId));
        });

      /**
       * Race-free parent roll-up: recompute the aggregate from the child rows.
       * A delivery is "settled" when Succeeded/Exhausted, or Failed WITH a
       * `completedAt` (terminal-device Failed); a Failed row awaiting retry is
       * still in flight.
       */
      const rollupParentSend = (sendId: string) =>
        Effect.gen(function* () {
          const rows = yield* db.query.pushNotificationDeliveries.findMany({
            where: { pushNotificationSendId: sendId },
          });
          const total = rows.length;
          let succeeded = 0;
          let settledFailed = 0;
          let inFlight = 0;
          for (const row of rows) {
            if (row.status === PushNotificationDeliveryStatus.Succeeded) {
              succeeded += 1;
            } else if (
              row.status === PushNotificationDeliveryStatus.Exhausted ||
              (row.status === PushNotificationDeliveryStatus.Failed && row.completedAt !== null)
            ) {
              settledFailed += 1;
            } else {
              inFlight += 1;
            }
          }
          const status = rollupSendStatus({ inFlight, succeeded, total });
          const completedAt = yield* DateTime.nowAsDate;
          yield* db
            .update(pushNotificationSends)
            .set({
              status,
              succeededCount: succeeded,
              failedCount: settledFailed,
              ...(inFlight === 0 && { completedAt }),
            })
            .where(eq(pushNotificationSends.id, sendId));
        });

      const processDelivery = Effect.fn("processPushDelivery")(
        function* (deliveryId: string) {
          yield* Effect.annotateCurrentSpan("voidhash.push.delivery_id", deliveryId);
          // The attempt clock for the freshness gate: any re-registration AFTER
          // this instant means the device is live and a terminal 404/410 must not
          // kill it.
          const observedAt = yield* DateTime.nowAsDate;

          // Atomic claim/CAS. `completed_at IS NULL` keeps terminal rows (which
          // carry a completedAt) un-reclaimable while still allowing a retryable
          // Failed row to be picked up by the redelivered message.
          const claimed = yield* db
            .update(pushNotificationDeliveries)
            .set({
              status: PushNotificationDeliveryStatus.InProgress,
              attemptCount: sql`${pushNotificationDeliveries.attemptCount} + 1`,
            })
            .where(
              and(
                eq(pushNotificationDeliveries.id, deliveryId),
                inArray(pushNotificationDeliveries.status, [
                  PushNotificationDeliveryStatus.Pending,
                  PushNotificationDeliveryStatus.Failed,
                ]),
                isNull(pushNotificationDeliveries.completedAt),
              ),
            )
            .returning();
          const row = claimed[0];
          if (!row) {
            // Lost the CAS. The row is either terminal (a genuine idempotent
            // no-op) or still `InProgress` from an earlier claim — which, if that
            // worker CRASHED between claim and finalize, would otherwise strand
            // the delivery (and pin the parent send) at InProgress forever, since
            // the CAS never re-claims InProgress. Distinguish the two: ack the
            // terminal case; FAIL the InProgress case so the queue redelivers,
            // and a truly-crashed claim eventually dead-letters to `markExhausted`
            // (a healthy in-flight claim finalizes first, so the retry then acks).
            const current = yield* db.query.pushNotificationDeliveries.findFirst({
              where: { id: deliveryId },
            });
            if (
              !current ||
              current.completedAt !== null ||
              current.status === PushNotificationDeliveryStatus.Succeeded ||
              current.status === PushNotificationDeliveryStatus.Exhausted
            ) {
              yield* Effect.annotateCurrentSpan("voidhash.push.claim_skipped", true);
              return;
            }
            yield* Effect.annotateCurrentSpan("voidhash.push.claim_in_progress_retry", true);
            return yield* Effect.fail(
              new PushDeliveryServiceError({
                cause: `delivery ${deliveryId} is InProgress (unfinished prior claim); retrying`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", row.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.push.provider", row.provider);
          const attemptNumber = row.attemptCount;

          const settleTerminal = (input: {
            readonly providerErrorCode: string;
            readonly errorMessage: string;
            readonly status: number;
          }) =>
            Effect.gen(function* () {
              yield* recordAttempt({
                deliveryId,
                attemptNumber,
                succeeded: false,
                statusCode: null,
                providerErrorCode: input.providerErrorCode,
                durationMs: null,
                errorMessage: input.errorMessage,
              });
              yield* finalizeDelivery({
                deliveryId,
                status: input.status,
                lastError: input.errorMessage,
              });
              yield* rollupParentSend(row.pushNotificationSendId);
            });

          // Dereference the device (tenant-isolated on projectId AND id). A
          // missing/invalidated device is terminal: nothing to deliver to.
          const device = yield* notificationTokens
            .resolveForDelivery({
              projectId: row.projectId,
              pushDeviceTokenId: row.pushDeviceTokenId,
            })
            .pipe(Effect.catchTag("PushDeviceTokenNotFoundError", () => Effect.succeed(null)));
          if (!device) {
            yield* settleTerminal({
              providerErrorCode: "DeviceNotFound",
              errorMessage: "device token not found or invalidated",
              status: PushNotificationDeliveryStatus.Exhausted,
            });
            return;
          }

          // Load the enabled provider config (may have been disabled mid-flight).
          const config = yield* db.query.pushNotificationConfigs.findFirst({
            where: {
              projectId: row.projectId,
              providerId: row.provider,
              enabled: true,
              deletedAt: { isNull: true },
            },
          });
          if (!config) {
            yield* settleTerminal({
              providerErrorCode: "NoEnabledConfig",
              errorMessage: "no enabled configuration for provider",
              status: PushNotificationDeliveryStatus.Exhausted,
            });
            return;
          }

          // Load the send message (PII) from the parent.
          const parent = yield* db.query.pushNotificationSends.findFirst({
            where: { id: row.pushNotificationSendId },
          });
          const message: PushMessage = toPushMessage(parent?.message);

          const provider: AnyPushDeliveryProviderShape = pick(row.provider === "apns", apns, fcm);
          const deviceToken: DeviceToken = {
            platform: device.platform,
            platformToken: device.platformToken,
            bundleId: device.bundleId,
            environment: device.environment,
          };

          const start = yield* Clock.currentTimeMillis;
          // `Effect.result` lifts the provider's success/failure into a value so
          // the attempt row is recorded uniformly before branching. The failure
          // is a normalized `PushDeliveryError` — matched on `_tag` with
          // compile-time exhaustiveness, never a defect.
          const outcome = yield* Effect.result(
            provider.deliver(config.configuration, deviceToken, message),
          );
          const durationMs = (yield* Clock.currentTimeMillis) - start;

          if (outcome._tag === "Success") {
            const success: PushDeliverySuccess = outcome.success;
            yield* recordAttempt({
              deliveryId,
              attemptNumber,
              succeeded: true,
              statusCode: success.statusCode,
              providerErrorCode: null,
              durationMs,
              errorMessage: null,
            });
            yield* finalizeDelivery({
              deliveryId,
              status: PushNotificationDeliveryStatus.Succeeded,
              providerMessageId: success.providerMessageId,
            });
            yield* rollupParentSend(row.pushNotificationSendId);
            return;
          }

          const error: PushDeliveryError = outcome.failure;
          yield* recordAttempt({
            deliveryId,
            attemptNumber,
            succeeded: false,
            statusCode: error.statusCode ?? null,
            providerErrorCode: error._tag,
            durationMs,
            errorMessage: error._tag,
          });

          switch (error._tag) {
            case "PushUnregisteredError":
            case "PushBadTokenError": {
              // Terminal-device: Failed + completedAt, then freshness-gated
              // invalidate so a stale 404/410 can't kill a re-registered device.
              yield* finalizeDelivery({
                deliveryId,
                status: PushNotificationDeliveryStatus.Failed,
                lastError: error._tag,
              });
              yield* notificationTokens.invalidate({
                projectId: row.projectId,
                pushDeviceTokenId: row.pushDeviceTokenId,
                reason: error._tag,
                observedAt,
              });
              yield* rollupParentSend(row.pushNotificationSendId);
              return;
            }
            case "PushPayloadTooLargeError": {
              yield* finalizeDelivery({
                deliveryId,
                status: PushNotificationDeliveryStatus.Exhausted,
                lastError: "payload too large",
              });
              yield* rollupParentSend(row.pushNotificationSendId);
              return;
            }
            case "PushInvalidCredentialsError":
            case "PushNotImplementedError": {
              // Terminal-config / unroutable: Failed, never device-deleted.
              yield* finalizeDelivery({
                deliveryId,
                status: PushNotificationDeliveryStatus.Failed,
                lastError: error._tag,
              });
              yield* rollupParentSend(row.pushNotificationSendId);
              return;
            }
            case "PushRateExceededError":
            case "PushTransientError": {
              // Retryable: exhaust or schedule + fail-to-retry.
              if (attemptNumber >= row.maxAttempts) {
                yield* finalizeDelivery({
                  deliveryId,
                  status: PushNotificationDeliveryStatus.Exhausted,
                  lastError: `retryable error exhausted: ${error._tag}`,
                });
                yield* rollupParentSend(row.pushNotificationSendId);
                return;
              }
              const delaySeconds = nextPushDeliveryDelaySeconds(
                attemptNumber,
                error.retryAfterSeconds,
              );
              yield* scheduleRetry({ deliveryId, delaySeconds, lastError: error._tag });
              yield* rollupParentSend(row.pushNotificationSendId);
              return yield* Effect.fail(
                new PushDeliveryRetryableError({ message: error._tag, delaySeconds }),
              );
            }
          }
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PushDeliveryServiceError({ cause: String(error.cause) })),
              NotificationTokenServiceError: (error) =>
                Effect.fail(new PushDeliveryServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * DLQ backstop: mark a delivery Exhausted after the queue drained its
       * retries. Idempotent — only settles a still-open row.
       */
      const markExhausted = (deliveryId: string) =>
        Effect.gen(function* () {
          const completedAt = yield* DateTime.nowAsDate;
          const rows = yield* db
            .update(pushNotificationDeliveries)
            .set({ status: PushNotificationDeliveryStatus.Exhausted, completedAt })
            .where(
              and(
                eq(pushNotificationDeliveries.id, deliveryId),
                isNull(pushNotificationDeliveries.completedAt),
              ),
            )
            .returning({ sendId: pushNotificationDeliveries.pushNotificationSendId });
          const sendId = rows[0]?.sendId;
          if (sendId) {
            yield* rollupParentSend(sendId);
          }
        }).pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PushDeliveryServiceError({ cause: String(error.cause) })),
          }),
        );

      return constant({ processDelivery, markExhausted });
    }),
  },
) {
  static layer = Layer.effect(PushDeliveryService)(PushDeliveryService.make);
}
