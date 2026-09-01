import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import {
  AnalyticsDelivery,
  AnalyticsDeliveryError,
  type AnalyticsDeliveryShape,
} from "../../../application/ports.ts";
import type { CapturedEventV1 } from "../../domain/Ingest.ts";
import { AnalyticsProcessor, inlineTransportRecord } from "../../application/Processor.ts";

const makeInlineAnalyticsDelivery = Effect.fn("makeInlineAnalyticsDelivery")(function* () {
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
    deliver: Effect.fn("InlineAnalyticsDelivery.deliver")(function* (envelopes) {
      const results = yield* Effect.forEach(
        envelopes,
        (envelope, index) => Effect.result(deliverOne(envelope, index)),
        { concurrency: 1 },
      );
      const failures = Arr.getSomes(
        Arr.map(results, (result) =>
          Result.match(result, {
            onFailure: Option.some,
            onSuccess: () => Option.none(),
          }),
        ),
      );
      const outcome = Arr.reduce(results, { deadLettered: 0, stored: 0 }, (counts, result) =>
        Result.match(result, {
          onFailure: () => counts,
          onSuccess: (success) =>
            success.status === "stored"
              ? { ...counts, stored: counts.stored + 1 }
              : { ...counts, deadLettered: counts.deadLettered + 1 },
        }),
      );
      // Every envelope is attempted so a mid-batch failure cannot discard the
      // remaining events; the first hard failure still fails the request.
      return yield* Option.match(Arr.head(failures), {
        onNone: () => Effect.succeed(outcome),
        onSome: (first) =>
          Effect.fail(
            new AnalyticsDeliveryError({
              cause: first.cause,
              deadLettered: outcome.deadLettered,
              message: first.message,
              stored: outcome.stored,
            }),
          ),
      });
    }),
  } satisfies AnalyticsDeliveryShape;
})();

/** In-process delivery through the same processor used by queue consumers. */
export const InlineAnalyticsDeliveryLive = Layer.effect(AnalyticsDelivery)(
  makeInlineAnalyticsDelivery,
);
