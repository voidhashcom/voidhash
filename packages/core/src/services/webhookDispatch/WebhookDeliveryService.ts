import { Clock, Context, DateTime, Duration, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

import {
  Db,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  and,
  eq,
  sql,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { causeMessage, constant } from "@voidhash/lib/lang";
import { generateId } from "../../utils/generate-id.ts";
import type { DeliverWebhookInput } from "@voidhash/core-v2";

export type { DeliverWebhookInput } from "@voidhash/core-v2";

/** Outcome of a single HTTP delivery attempt. Transport failures are captured
 * as a non-succeeded result so the workflow can decide to retry. */
export interface SendWebhookResult {
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly responseBody: string | null;
  /**
   * Set when nothing was sent because the endpoint no longer exists or is no
   * longer `Active`. The workflow terminates the delivery instead of recording
   * an attempt or scheduling another retry.
   */
  readonly skipped?: boolean;
  readonly statusCode: number | null;
  readonly succeeded: boolean;
}

// Retry backoff in seconds: 1min, 5min, 30min, 2hr, 24hr.
const RETRY_DELAYS_SECONDS = constant([60, 300, 1800, 7200, 86400]);

/**
 * Attempt ceiling for every delivery. The backoff ladder length *is* the
 * ceiling — it is a fixed schedule with no per-delivery override, so this is
 * the only value the delivery API can honestly report.
 */
export const WEBHOOK_DELIVERY_MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length;

/**
 * Consecutive failed attempts (across deliveries — any success resets the
 * counter) after which an endpoint is auto-transitioned to the `Failed`
 * status and stops receiving new deliveries. Equals four fully-exhausted
 * 5-attempt deliveries with no success in between.
 */
const AUTO_DISABLE_CONSECUTIVE_FAILURES = 20;
const SIGNATURE_VERSION = "v1";
const REQUEST_TIMEOUT = Duration.seconds(30);

/** Serializes the webhook payload to the exact JSON body that gets signed. */
const encodeJsonBody = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Retry time for `attemptNumber`, or `null` once the backoff schedule is
 * exhausted.
 */
export const nextWebhookDeliveryRetryTime = (attemptNumber: number): Effect.Effect<Date | null> =>
  Effect.gen(function* () {
    const delaySeconds = RETRY_DELAYS_SECONDS[attemptNumber - 1];
    if (delaySeconds === undefined) return null;
    const now = yield* DateTime.now;
    return DateTime.toDateUtc(DateTime.addDuration(now, Duration.seconds(delaySeconds)));
  });

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 signature of `${timestamp}.${payload}`, prefixed with the
 * scheme version so receivers can roll the algorithm forward. */
const generateSignature = (payload: string, timestamp: string, secret: string) =>
  Effect.gen(function* () {
    const key = yield* Effect.promise(() =>
      crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"],
      ),
    );
    const signature = yield* Effect.promise(() =>
      crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)),
    );
    return `${SIGNATURE_VERSION}=${bytesToHex(new Uint8Array(signature))}`;
  });

/**
 * All business logic for delivering a single webhook: signing and sending the
 * HTTP request, recording each attempt, and transitioning delivery/endpoint
 * status on success, retry, or exhaustion.
 *
 * The service owns *what* happens at each step. The durable orchestration —
 * task naming, sleeping until the next retry, the attempt loop — lives in the
 * thin `DeliverWebhookWorkflow`, so the workflow can be swapped for another
 * durable-execution backend without touching this logic.
 */
export class WebhookDeliveryService extends Context.Service<WebhookDeliveryService>()(
  "WebhookDeliveryService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const httpClient = yield* HttpClient.HttpClient;

      /**
       * Sign and POST the payload, capturing the outcome. The signing secret is
       * re-read from the endpoint row on every attempt rather than taken from
       * the workflow payload: the retry ladder spans 24h, so a payload-pinned
       * secret would keep signing with a rotated-away value and rotation would
       * never revoke anything.
       */
      const send = Effect.fn("webhookDelivery.attempt")(function* (input: DeliverWebhookInput) {
        yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", input.deliveryId);
        yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);
        yield* Effect.annotateCurrentSpan(
          "voidhash.webhook.delivery.attempt_number",
          input.attemptNumber,
        );
        yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", input.eventType);

        const endpoint = yield* db.query.webhookEndpoints.findFirst({
          where: { id: input.endpointId },
        });
        // Mirrors the dispatch/sweep candidate filters, which only ever select
        // `Active` endpoints: an endpoint deleted, disabled, or auto-failed
        // mid-flight stops receiving traffic at the next attempt.
        if (!endpoint || endpoint.status !== WebhookEndpointStatus.Active) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.skipped", true);
          yield* Effect.logWarning("webhook delivery skipped: endpoint is not active", {
            deliveryId: input.deliveryId,
            endpointId: input.endpointId,
            endpointStatus: endpoint?.status ?? null,
          });
          return {
            durationMs: 0,
            errorMessage: null,
            responseBody: null,
            skipped: true,
            statusCode: null,
            succeeded: false,
          } satisfies SendWebhookResult;
        }

        const nowMillis = yield* Clock.currentTimeMillis;
        const timestamp = Math.floor(nowMillis / 1000).toString();
        const payloadString = encodeJsonBody(input.payload);
        const signature = yield* generateSignature(payloadString, timestamp, endpoint.secret);
        const startTime = yield* Clock.currentTimeMillis;

        const elapsed = Effect.map(Clock.currentTimeMillis, (end) => end - startTime);

        const post = Effect.gen(function* () {
          const response = yield* httpClient.post(input.url, {
            body: HttpBody.text(payloadString, "application/json"),
            headers: {
              "X-Webhook-Event": input.eventType,
              "X-Webhook-Signature": signature,
              "X-Webhook-Timestamp": timestamp,
            },
          });
          const responseBody = yield* response.text.pipe(Effect.orElseSucceed(() => undefined));

          return {
            durationMs: yield* elapsed,
            errorMessage: null,
            responseBody: responseBody?.slice(0, 2048) ?? null,
            statusCode: response.status,
            succeeded: response.status >= 200 && response.status < 300,
          };
        });

        // A transport failure (or the 30s cap) is not a defect: it is captured
        // as a non-succeeded result so the workflow can decide to retry.
        const result: SendWebhookResult = yield* post.pipe(
          Effect.timeout(REQUEST_TIMEOUT),
          Effect.catch((error) =>
            Effect.gen(function* () {
              return {
                durationMs: yield* elapsed,
                errorMessage: causeMessage(error).slice(0, 500),
                responseBody: null,
                statusCode: null,
                succeeded: false,
              };
            }),
          ),
        );

        if (result.statusCode !== null) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.delivery.status_code",
            result.statusCode,
          );
        }
        yield* Effect.annotateCurrentSpan(
          "voidhash.webhook.delivery.duration_ms",
          result.durationMs,
        );
        yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.succeeded", result.succeeded);
        return result;
      });

      /** Persist the result of a single attempt against the delivery. */
      const recordAttempt = (input: DeliverWebhookInput, result: SendWebhookResult) =>
        Effect.gen(function* () {
          const createdAt = yield* DateTime.nowAsDate;
          yield* db.insert(webhookDeliveryAttempts).values({
            attemptNumber: input.attemptNumber,
            createdAt,
            durationMs: result.durationMs,
            errorMessage: result.errorMessage,
            id: generateId("webhookDeliveryAttempt"),
            responseBody: result.responseBody,
            statusCode: result.statusCode,
            succeeded: result.succeeded,
            webhookDeliveryId: input.deliveryId,
          });
        });

      /** Mark the delivery succeeded and reset the endpoint's failure counter. */
      const markSucceeded = (input: DeliverWebhookInput) =>
        Effect.gen(function* () {
          const completedAt = yield* DateTime.nowAsDate;
          yield* db
            .update(webhookDeliveries)
            .set({
              attemptCount: input.attemptNumber,
              completedAt,
              nextAttemptAt: null,
              status: WebhookDeliveryStatus.Succeeded,
            })
            .where(eq(webhookDeliveries.id, input.deliveryId));

          yield* db
            .update(webhookEndpoints)
            .set({
              consecutiveFailures: 0,
              lastSuccessAt: completedAt,
            })
            .where(eq(webhookEndpoints.id, input.endpointId));
        });

      /**
       * Atomically bump the endpoint's consecutive-failure counter (assigning
       * `attemptNumber` would under-count when several deliveries fail
       * concurrently) and flip the endpoint to `Failed` once the counter
       * crosses the auto-disable threshold.
       */
      const recordEndpointFailure = (endpointId: string) =>
        Effect.gen(function* () {
          const rows = yield* db
            .update(webhookEndpoints)
            .set({ consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1` })
            .where(eq(webhookEndpoints.id, endpointId))
            .returning({ consecutiveFailures: webhookEndpoints.consecutiveFailures });
          const consecutiveFailures = rows[0]?.consecutiveFailures ?? 0;
          if (consecutiveFailures < AUTO_DISABLE_CONSECUTIVE_FAILURES) return;
          const disabled = yield* db
            .update(webhookEndpoints)
            .set({ status: WebhookEndpointStatus.Failed })
            .where(
              and(
                eq(webhookEndpoints.id, endpointId),
                eq(webhookEndpoints.status, WebhookEndpointStatus.Active),
              ),
            )
            .returning({ id: webhookEndpoints.id });
          if (disabled.length > 0) {
            yield* Effect.logWarning("webhook endpoint auto-disabled after consecutive failures", {
              consecutiveFailures,
              endpointId,
            });
          }
        });

      /** Record a failed attempt and schedule the next retry at `nextRetryTime`. */
      const markFailed = (input: DeliverWebhookInput, nextRetryTime: Date) =>
        Effect.gen(function* () {
          yield* db
            .update(webhookDeliveries)
            .set({
              attemptCount: input.attemptNumber,
              nextAttemptAt: nextRetryTime,
              status: WebhookDeliveryStatus.Failed,
            })
            .where(eq(webhookDeliveries.id, input.deliveryId));

          yield* recordEndpointFailure(input.endpointId);
        });

      /** Mark the delivery exhausted once the retry schedule is depleted. */
      const markExhausted = Effect.fn("webhookDelivery.exhausted")(function* (
        input: DeliverWebhookInput,
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", input.deliveryId);
        yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);
        yield* Effect.annotateCurrentSpan(
          "voidhash.webhook.delivery.attempt_number",
          input.attemptNumber,
        );
        yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.exhausted", "true");
        yield* Effect.logError("webhook delivery exhausted", {
          attemptNumber: input.attemptNumber,
          deliveryId: input.deliveryId,
          endpointId: input.endpointId,
          eventType: input.eventType,
        });
        const completedAt = yield* DateTime.nowAsDate;
        yield* db
          .update(webhookDeliveries)
          .set({
            attemptCount: input.attemptNumber,
            completedAt,
            nextAttemptAt: null,
            status: WebhookDeliveryStatus.Exhausted,
          })
          .where(eq(webhookDeliveries.id, input.deliveryId));

        yield* recordEndpointFailure(input.endpointId);
      });

      /**
       * Retry time for `attemptNumber`, or `null` once the backoff schedule is
       * exhausted (signalling the delivery should be marked exhausted).
       */
      return constant({
        markExhausted,
        markFailed,
        markSucceeded,
        nextRetryTime: nextWebhookDeliveryRetryTime,
        recordAttempt,
        send,
      });
    }),
  },
) {
  /**
   * The HTTP client is provided here rather than by consumers so the service
   * stays a drop-in `Db`-only dependency for the durable workflow.
   */
  static layer = Layer.effect(WebhookDeliveryService)(WebhookDeliveryService.make).pipe(
    Layer.provide(FetchHttpClient.layer),
  );
}
