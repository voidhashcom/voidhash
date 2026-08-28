import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Schema } from "effect";

import {
  nextWebhookDeliveryRetryTime,
  WebhookDeliveryService,
} from "../services/webhookDispatch/WebhookDeliveryService.ts";
import { DeliverWebhook } from "@voidhash/core-v2";

const SendWebhookResult = Schema.Struct({
  durationMs: Schema.Number,
  errorMessage: Schema.NullOr(Schema.String),
  responseBody: Schema.NullOr(Schema.String),
  // Optional so a step result persisted before this field existed still decodes
  // when an in-flight instance resumes from its retry sleep.
  skipped: Schema.optionalKey(Schema.Boolean),
  statusCode: Schema.NullOr(Schema.Number),
  succeeded: Schema.Boolean,
});

/** Durable webhook delivery registration. */
export const DeliverWebhookRegistration = WorkflowRegistration.make(DeliverWebhook, {
  dependencies: WebhookDeliveryService.layer,
  run: (input, ctx) =>
    Effect.gen(function* () {
      let attemptNumber = input.attemptNumber;

      while (true) {
        const attempt = { ...input, attemptNumber };
        const result = yield* ctx.step({
          name: `send-${input.deliveryId}-${attemptNumber}`,
          success: SendWebhookResult,
          execute: Effect.gen(function* () {
            const delivery = yield* WebhookDeliveryService;
            return yield* delivery.send(attempt);
          }),
        });

        // The endpoint was deleted, disabled, or auto-failed between attempts;
        // nothing was sent, so there is no attempt to record and no retry to
        // schedule. The delivery row is left as-is: the sweep only picks up
        // deliveries of `Active` endpoints, so it resumes if the endpoint is
        // re-enabled.
        if (result.skipped) return;

        yield* ctx.step({
          name: `record-attempt-${input.deliveryId}-${attemptNumber}`,
          success: Schema.Void,
          execute: Effect.gen(function* () {
            const delivery = yield* WebhookDeliveryService;
            yield* delivery.recordAttempt(attempt, result);
          }),
        });

        if (result.succeeded) {
          yield* ctx.step({
            name: `mark-succeeded-${input.deliveryId}-${attemptNumber}`,
            success: Schema.Void,
            execute: Effect.gen(function* () {
              const delivery = yield* WebhookDeliveryService;
              yield* delivery.markSucceeded(attempt);
            }),
          });
          return;
        }

        const nextAttemptNumber = attemptNumber + 1;
        const retryTime = yield* nextWebhookDeliveryRetryTime(nextAttemptNumber);

        if (!retryTime) {
          yield* ctx.step({
            name: `mark-exhausted-${input.deliveryId}-${attemptNumber}`,
            success: Schema.Void,
            execute: Effect.gen(function* () {
              const delivery = yield* WebhookDeliveryService;
              yield* delivery.markExhausted(attempt);
            }),
          });
          return;
        }

        yield* ctx.step({
          name: `mark-failed-${input.deliveryId}-${attemptNumber}`,
          success: Schema.Void,
          execute: Effect.gen(function* () {
            const delivery = yield* WebhookDeliveryService;
            yield* delivery.markFailed(attempt, retryTime);
          }),
        });
        yield* ctx.sleepUntil(`retry-${input.deliveryId}-${nextAttemptNumber}`, retryTime);
        attemptNumber = nextAttemptNumber;
      }
    }),
});
