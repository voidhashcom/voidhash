import { Context, Effect, Layer } from "effect";

import {
  Db,
  WebhookDeliveryStatus,
  eq,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import type { DeliverWebhookInput } from "./WebhookDeliveryWorkflow.ts";

export type { DeliverWebhookInput } from "./WebhookDeliveryWorkflow.ts";

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
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 86400] as const;
const SIGNATURE_VERSION = "v1";

/**
 * Retry time for `attemptNumber`, or `null` once the backoff schedule is
 * exhausted.
 */
export const nextWebhookDeliveryRetryTime = (attemptNumber: number): Date | null => {
  const delaySeconds = RETRY_DELAYS_SECONDS[attemptNumber - 1];
  return delaySeconds === undefined ? null : new Date(Date.now() + delaySeconds * 1000);
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 signature of `${timestamp}.${payload}`, prefixed with the
 * scheme version so receivers can roll the algorithm forward. */
const generateSignature = (payload: string, timestamp: string, secret: string) =>
  Effect.promise(async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`),
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

      /** Sign and POST the payload, capturing the outcome. Never fails. */
      const send = (input: DeliverWebhookInput): Effect.Effect<SendWebhookResult> =>
        Effect.gen(function* () {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const payloadString = JSON.stringify(input.payload);
          const signature = yield* generateSignature(payloadString, timestamp, input.secret);
          const startTime = Date.now();

          return yield* Effect.promise(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30_000);

            try {
              const response = await fetch(input.url, {
                body: payloadString,
                headers: {
                  "Content-Type": "application/json",
                  "X-Webhook-Event": input.eventType,
                  "X-Webhook-Signature": signature,
                  "X-Webhook-Timestamp": timestamp,
                },
                method: "POST",
                signal: controller.signal,
              });
              const responseBody = await response.text().catch(() => undefined);

              return {
                durationMs: Date.now() - startTime,
                errorMessage: null,
                responseBody: responseBody?.slice(0, 2048) ?? null,
                statusCode: response.status,
                succeeded: response.status >= 200 && response.status < 300,
              };
            } catch (error) {
              return {
                durationMs: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error),
                responseBody: null,
                statusCode: null,
                succeeded: false,
              };
            } finally {
              clearTimeout(timeoutId);
            }
          });
        });

      /** Persist the result of a single attempt against the delivery. */
      const recordAttempt = (input: DeliverWebhookInput, result: SendWebhookResult) =>
        Effect.gen(function* () {
          yield* db.insert(webhookDeliveryAttempts).values({
            attemptNumber: input.attemptNumber,
            createdAt: new Date(),
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
          yield* db
            .update(webhookDeliveries)
            .set({
              attemptCount: input.attemptNumber,
              completedAt: new Date(),
              nextAttemptAt: null,
              status: WebhookDeliveryStatus.Succeeded,
            })
            .where(eq(webhookDeliveries.id, input.deliveryId));

          yield* db
            .update(webhookEndpoints)
            .set({
              consecutiveFailures: 0,
              lastSuccessAt: new Date(),
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
      const markExhausted = (input: DeliverWebhookInput) =>
        Effect.gen(function* () {
          yield* db
            .update(webhookDeliveries)
            .set({
              attemptCount: input.attemptNumber,
              completedAt: new Date(),
              nextAttemptAt: null,
              status: WebhookDeliveryStatus.Exhausted,
            })
            .where(eq(webhookDeliveries.id, input.deliveryId));

          yield* db
            .update(webhookEndpoints)
            .set({ consecutiveFailures: input.attemptNumber })
            .where(eq(webhookEndpoints.id, input.endpointId));
        });

      /**
       * Retry time for `attemptNumber`, or `null` once the backoff schedule is
       * exhausted (signalling the delivery should be marked exhausted).
       */
      return {
        markExhausted,
        markFailed,
        markSucceeded,
        nextRetryTime: nextWebhookDeliveryRetryTime,
        recordAttempt,
        send,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(WebhookDeliveryService)(WebhookDeliveryService.make);
}
