import { Effect, Layer } from "effect";

import {
  AnalyticsDelivery,
  AnalyticsPortError,
  type AnalyticsDeliveryShape,
} from "../../../application/ports.ts";
import type { CapturedEventV1 } from "../../domain/Ingest.ts";
import { AnalyticsProcessor, inlineTransportRecord } from "../../application/Processor.ts";

const makeInlineAnalyticsDelivery = Effect.gen(function* () {
  const processor = yield* AnalyticsProcessor;
  const deliverOne = (envelope: typeof CapturedEventV1.Type, index: number) =>
    processor.process(inlineTransportRecord(envelope, index)).pipe(
      Effect.mapError(
        (error) => new AnalyticsPortError({ cause: error.cause, message: error.message }),
      ),
      Effect.asVoid,
    );
  return {
    deliver: (envelopes) => Effect.forEach(envelopes, deliverOne, { discard: true }),
  } satisfies AnalyticsDeliveryShape;
});

/** In-process delivery through the same processor used by queue consumers. */
export const InlineAnalyticsDeliveryLive = Layer.effect(AnalyticsDelivery)(
  makeInlineAnalyticsDelivery,
);
