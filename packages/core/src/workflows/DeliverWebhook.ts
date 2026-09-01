import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
  isSucceeded: Schema.Boolean,
}).pipe(Schema.encodeKeys({ isSucceeded: "succeeded" }));

/** Durable webhook delivery registration. */
export const DeliverWebhookRegistration = WorkflowRegistration.make(DeliverWebhook, {
  dependencies: WebhookDeliveryService.layer,
  run: (input, ctx) =>
    Effect.gen(function* () {
      let pendingAttempt = Option.some(input.attemptNumber);

      yield* Effect.whileLoop({
        while: () => Option.isSome(pendingAttempt),
        body: () =>
          Effect.gen(function* () {
            if (Option.isNone(pendingAttempt)) return Option.none<number>();
            const attemptNumber = pendingAttempt.value;
            const attempt = { ...input, attemptNumber };
            const result = yield* ctx.step({
              name: `send-${input.deliveryId}-${attemptNumber}`,
              success: SendWebhookResult,
              execute: Effect.gen(function* () {
                const delivery = yield* WebhookDeliveryService;
                const sent = yield* delivery.send(attempt);
                return {
                  ...sent,
                  errorMessage: Option.getOrNull(sent.errorMessage),
                  responseBody: Option.getOrNull(sent.responseBody),
                  statusCode: Option.getOrNull(sent.statusCode),
                  isSucceeded: sent.succeeded,
                };
              }),
            });

            // The endpoint was deleted, disabled, or auto-failed between attempts;
            // nothing was sent, so there is no attempt to record and no retry to
            // schedule. The delivery row is left as-is: the sweep only picks up
            // deliveries of `Active` endpoints, so it resumes if the endpoint is
            // re-enabled.
            if (result.skipped) return Option.none<number>();

            yield* ctx.step({
              name: `record-attempt-${input.deliveryId}-${attemptNumber}`,
              success: Schema.Void,
              execute: Effect.gen(function* () {
                const delivery = yield* WebhookDeliveryService;
                yield* delivery.recordAttempt(attempt, {
                  ...result,
                  errorMessage: Option.fromNullishOr(result.errorMessage),
                  responseBody: Option.fromNullishOr(result.responseBody),
                  statusCode: Option.fromNullishOr(result.statusCode),
                  succeeded: result.isSucceeded,
                });
              }),
            });

            if (result.isSucceeded) {
              yield* ctx.step({
                name: `mark-succeeded-${input.deliveryId}-${attemptNumber}`,
                success: Schema.Void,
                execute: Effect.gen(function* () {
                  const delivery = yield* WebhookDeliveryService;
                  yield* delivery.markSucceeded(attempt);
                }),
              });
              return Option.none<number>();
            }

            const nextAttemptNumber = attemptNumber + 1;
            const retryTime = yield* nextWebhookDeliveryRetryTime(nextAttemptNumber);

            if (Option.isNone(retryTime)) {
              yield* ctx.step({
                name: `mark-exhausted-${input.deliveryId}-${attemptNumber}`,
                success: Schema.Void,
                execute: Effect.gen(function* () {
                  const delivery = yield* WebhookDeliveryService;
                  yield* delivery.markExhausted(attempt);
                }),
              });
              return Option.none<number>();
            }

            yield* ctx.step({
              name: `mark-failed-${input.deliveryId}-${attemptNumber}`,
              success: Schema.Void,
              execute: Effect.gen(function* () {
                const delivery = yield* WebhookDeliveryService;
                yield* delivery.markFailed(attempt, retryTime.value);
              }),
            });
            yield* ctx.sleepUntil(
              `retry-${input.deliveryId}-${nextAttemptNumber}`,
              retryTime.value,
            );
            return Option.some(nextAttemptNumber);
          }),
        step: (nextAttempt) => {
          pendingAttempt = nextAttempt;
        },
      });
    }),
});
