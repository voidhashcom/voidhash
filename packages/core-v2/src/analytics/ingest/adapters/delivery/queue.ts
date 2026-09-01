import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AnalyticsDelivery,
  AnalyticsDeliveryError,
  type AnalyticsDeliveryShape,
  type AnalyticsPortError,
} from "../../../application/ports.ts";
import type { CapturedEventV1 } from "../../domain/Ingest.ts";

/** Queue producer capabilities required by queued analytics delivery. */
export interface AnalyticsQueueProducerShape {
  readonly publish: (
    envelopes: ReadonlyArray<typeof CapturedEventV1.Type>,
  ) => Effect.Effect<void, AnalyticsPortError>;
}

/** Queue producer boundary supplied by the application runtime. */
export class AnalyticsQueueProducer extends Context.Service<
  AnalyticsQueueProducer,
  AnalyticsQueueProducerShape
>()("@voidhash/core-v2/analytics/AnalyticsQueueProducer") {}

const makeQueuedAnalyticsDelivery = AnalyticsQueueProducer.pipe(
  Effect.map(
    (producer) =>
      ({
        deliver: (envelopes) =>
          producer.publish(envelopes).pipe(
            Effect.as({
              deadLettered: 0,
              stored: envelopes.length,
            }),
            Effect.mapError(
              (error) =>
                new AnalyticsDeliveryError({
                  cause: error.cause,
                  deadLettered: 0,
                  message: error.message,
                  stored: 0,
                }),
            ),
          ),
      }) satisfies AnalyticsDeliveryShape,
  ),
);

/** Queue-backed delivery; consumers decode records before invoking the common processor. */
export const QueuedAnalyticsDeliveryLive = Layer.effect(AnalyticsDelivery)(
  makeQueuedAnalyticsDelivery,
);
