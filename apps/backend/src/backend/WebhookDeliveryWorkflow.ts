import {
  WebhookDeliveryService,
  nextWebhookDeliveryRetryTime,
} from "@voidhash/core/services/webhookDispatch/WebhookDeliveryService";
import { Db } from "@voidhash/db";
import { WorkflowRunner } from "@voidhash/platform/Workflow";
import { Effect, Layer, Schema } from "effect";

import { DeliverWebhookDefinition } from "./WorkflowDefinitions.ts";

const SendWebhookResultSchema = Schema.Struct({
  durationMs: Schema.Number,
  errorMessage: Schema.NullOr(Schema.String),
  responseBody: Schema.NullOr(Schema.String),
  statusCode: Schema.NullOr(Schema.Number),
  succeeded: Schema.Boolean,
});

/** Registers durable webhook delivery with persisted retries and attempt state. */
export const registerWebhookDeliveryWorkflow = (
  runner: WorkflowRunner["Service"],
  database: Layer.Layer<Db>,
) =>
  runner.register(
    DeliverWebhookDefinition,
    (input, context) =>
      Effect.gen(function* () {
        let attemptNumber = input.attemptNumber;

        while (true) {
          const attempt = { ...input, attemptNumber };
          const result = yield* context.step({
            name: `send-${input.deliveryId}-${attemptNumber}`,
            success: SendWebhookResultSchema,
            execute: Effect.gen(function* () {
              const delivery = yield* WebhookDeliveryService;
              return yield* delivery.send(attempt);
            }).pipe(Effect.provide(WebhookDeliveryService.layer), Effect.provide(database)),
          });

          yield* context.step({
            name: `record-attempt-${input.deliveryId}-${attemptNumber}`,
            success: Schema.Void,
            execute: Effect.gen(function* () {
              const delivery = yield* WebhookDeliveryService;
              yield* delivery.recordAttempt(attempt, result);
            }).pipe(Effect.provide(WebhookDeliveryService.layer), Effect.provide(database)),
          });

          if (result.succeeded) {
            yield* context.step({
              name: `mark-succeeded-${input.deliveryId}-${attemptNumber}`,
              success: Schema.Void,
              execute: Effect.gen(function* () {
                const delivery = yield* WebhookDeliveryService;
                yield* delivery.markSucceeded(attempt);
              }).pipe(Effect.provide(WebhookDeliveryService.layer), Effect.provide(database)),
            });
            return;
          }

          const nextAttemptNumber = attemptNumber + 1;
          const retryTime = nextWebhookDeliveryRetryTime(nextAttemptNumber);

          if (!retryTime) {
            yield* context.step({
              name: `mark-exhausted-${input.deliveryId}-${attemptNumber}`,
              success: Schema.Void,
              execute: Effect.gen(function* () {
                const delivery = yield* WebhookDeliveryService;
                yield* delivery.markExhausted(attempt);
              }).pipe(Effect.provide(WebhookDeliveryService.layer), Effect.provide(database)),
            });
            return;
          }

          yield* context.step({
            name: `mark-failed-${input.deliveryId}-${attemptNumber}`,
            success: Schema.Void,
            execute: Effect.gen(function* () {
              const delivery = yield* WebhookDeliveryService;
              yield* delivery.markFailed(attempt, retryTime);
            }).pipe(Effect.provide(WebhookDeliveryService.layer), Effect.provide(database)),
          });
          yield* context.sleepUntil(
            `retry-${input.deliveryId}-${nextAttemptNumber}`,
            retryTime,
          );
          attemptNumber = nextAttemptNumber;
        }
      }),
  );
