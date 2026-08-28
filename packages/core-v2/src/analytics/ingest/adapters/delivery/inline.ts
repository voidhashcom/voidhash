import { Effect, Layer } from "effect";

import {
  AnalyticsDelivery,
  AnalyticsDeliveryError,
  type AnalyticsDeliveryShape,
} from "../../../application/ports.ts";
import type { CapturedEventV1 } from "../../domain/Ingest.ts";
import { AnalyticsProcessor, inlineTransportRecord } from "../../application/Processor.ts";

const makeInlineAnalyticsDelivery = Effect.gen(function* () {
  const processor = yield* AnalyticsProcessor;
  const deliverOne = (envelope: typeof CapturedEventV1.Type, index: number) =>
    processor.process(inlineTransportRecord(envelope, index)).pipe(
      Effect.mapError(
        (error) =>
          new AnalyticsDeliveryError({
            cause: error.cause,
            deadLettered: 0,
            message: error.message,
            stored: 0,
          }),
      ),
    );
  return {
    deliver: (envelopes) =>
      Effect.gen(function* () {
        const outcome = { deadLettered: 0, stored: 0 };
        const failures: AnalyticsDeliveryError[] = [];
        for (const [index, envelope] of envelopes.entries()) {
          const result = yield* Effect.result(deliverOne(envelope, index));
          if (result._tag === "Failure") {
            failures.push(result.failure);
            continue;
          }
          if (result.success.status === "stored") outcome.stored += 1;
          else outcome.deadLettered += 1;
        }
        // Every envelope is attempted so a mid-batch failure cannot discard the
        // remaining events; the first hard failure still fails the request.
        if (failures.length > 0) {
          const first = failures[0]!;
          return yield* new AnalyticsDeliveryError({
            cause: first.cause,
            deadLettered: outcome.deadLettered,
            message: first.message,
            stored: outcome.stored,
          });
        }
        return outcome;
      }),
  } satisfies AnalyticsDeliveryShape;
});

/** In-process delivery through the same processor used by queue consumers. */
export const InlineAnalyticsDeliveryLive = Layer.effect(AnalyticsDelivery)(
  makeInlineAnalyticsDelivery,
);
