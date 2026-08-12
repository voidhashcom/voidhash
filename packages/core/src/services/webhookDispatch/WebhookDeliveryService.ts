import { Clock, Context, DateTime, Duration, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

import {
  Db,
  WebhookDeliveryStatus,
  eq,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { causeMessage, constant } from "@voidhash/lib/lang";
import { generateId } from "../../utils/generate-id.ts";
import type { DeliverWebhookInput } from "../../workflows/definitions.ts";

export type { DeliverWebhookInput } from "../../workflows/definitions.ts";

/** Outcome of a single HTTP delivery attempt. Never throws — failures are
 * captured as a non-succeeded result so the workflow can decide to retry. */
export interface SendWebhookResult {
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly responseBody: string | null;
  readonly statusCode: number | null;
  readonly succeeded: boolean;
}

// Retry backoff in seconds: 1min, 5min, 30min, 2hr, 24hr.
const RETRY_DELAYS_SECONDS = constant([60, 300, 1800, 7200, 86400]);
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

      /** Sign and POST the payload, capturing the outcome. Never fails. */
      const send = Effect.fn("webhookDelivery.attempt")(
        function* (input: DeliverWebhookInput) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", input.deliveryId);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.delivery.attempt_number",
            input.attemptNumber,
          );
          yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", input.eventType);
          const nowMillis = yield* Clock.currentTimeMillis;
          const timestamp = Math.floor(nowMillis / 1000).toString();
          const payloadString = encodeJsonBody(input.payload);
          const signature = yield* generateSignature(payloadString, timestamp, input.secret);
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
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.delivery.succeeded",
            result.succeeded,
          );
          return result;
        },
      );

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

          yield* db
            .update(webhookEndpoints)
            .set({ consecutiveFailures: input.attemptNumber })
            .where(eq(webhookEndpoints.id, input.endpointId));
        });

      /** Mark the delivery exhausted once the retry schedule is depleted. */
      const markExhausted = Effect.fn("webhookDelivery.exhausted")(
        function* (input: DeliverWebhookInput) {
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

          yield* db
            .update(webhookEndpoints)
            .set({ consecutiveFailures: input.attemptNumber })
            .where(eq(webhookEndpoints.id, input.endpointId));
        },
      );

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
