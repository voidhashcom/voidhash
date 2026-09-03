import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AnalyticsDelivery,
  AnalyticsDeliveryError,
  type AnalyticsDeliveryShape,
} from "../../../application/ports.ts";
import { AnalyticsProcessor, inlineTransportRecord } from "../../application/Processor.ts";

const makeInlineAnalyticsDelivery = Effect.fn("makeInlineAnalyticsDelivery")(function* () {
  const processor = yield* AnalyticsProcessor;
  return {
    // The whole request is one processor batch: a single store write, and a
    // failure stores nothing, so the caller can safely retry the request.
    deliver: Effect.fn("InlineAnalyticsDelivery.deliver")(function* (envelopes) {
      const outcome = yield* processor
        .processBatch(envelopes.map((envelope, index) => inlineTransportRecord(envelope, index)))
        .pipe(
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
      return { deadLettered: outcome.deadLettered, stored: outcome.stored };
    }),
  } satisfies AnalyticsDeliveryShape;
})();

/** In-process delivery through the same processor used by queue consumers. */
export const InlineAnalyticsDeliveryLive = Layer.effect(AnalyticsDelivery)(
  makeInlineAnalyticsDelivery,
);
