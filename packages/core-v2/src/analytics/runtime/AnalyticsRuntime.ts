import { DateTime, Effect, Layer, Schema } from "effect";

import { AnalyticsDelivery } from "../application/ports.ts";
import { InternalAnalyticsEventSchema } from "../domain/InternalAnalyticsEvents.ts";
import { AnalyticsCapture } from "../ingest/application/Capture.ts";
import {
  AnalyticsProcessor,
  makeInternalCaptureEnvelope,
} from "../ingest/application/Processor.ts";
import { InlineAnalyticsDeliveryLive } from "../ingest/adapters/delivery/inline.ts";
import { QueuedAnalyticsDeliveryLive } from "../ingest/adapters/delivery/queue.ts";
import { AnalyticsQuery } from "../query/application/AnalyticsQuery.ts";

const ProcessorWithInlineDeliveryLive = InlineAnalyticsDeliveryLive.pipe(
  Layer.provideMerge(AnalyticsProcessor.layer),
);

const CaptureWithInlineProcessingLive = AnalyticsCapture.layer.pipe(
  Layer.provideMerge(ProcessorWithInlineDeliveryLive),
);

const CaptureWithQueuedDeliveryLive = AnalyticsCapture.layer.pipe(
  Layer.provideMerge(QueuedAnalyticsDeliveryLive),
);

/**
 * Analytics capture, inline processing, and portable queries. Provide the
 * remaining port, configuration, and platform layers once at the application root.
 */
export const AnalyticsInlineLive = Layer.merge(
  CaptureWithInlineProcessingLive,
  AnalyticsQuery.layer,
);

/**
 * Analytics capture, queue production, queue processing, and portable queries.
 * Queue consumers use the same memoized `AnalyticsProcessor` service.
 */
export const AnalyticsQueuedLive = Layer.mergeAll(
  CaptureWithQueuedDeliveryLive,
  AnalyticsProcessor.layer,
  AnalyticsQuery.layer,
);

/** Validate and dispatch a server-trusted event through the configured delivery service. */
export const dispatchInternalAnalyticsEvent = (input: unknown) =>
  Effect.gen(function* () {
    const event = yield* Schema.decodeUnknownEffect(InternalAnalyticsEventSchema)(input);
    const delivery = yield* AnalyticsDelivery;
    const receivedAt = yield* DateTime.nowAsDate;
    yield* delivery.deliver([makeInternalCaptureEnvelope(event, receivedAt)]);
  });

/** Validate and dispatch a server-trusted batch through the configured delivery service. */
export const dispatchInternalAnalyticsEvents = (input: unknown) =>
  Effect.gen(function* () {
    const events = yield* Schema.decodeUnknownEffect(Schema.Array(InternalAnalyticsEventSchema))(
      input,
    );
    if (events.length === 0) return;
    const delivery = yield* AnalyticsDelivery;
    const receivedAt = yield* DateTime.nowAsDate;
    yield* delivery.deliver(events.map((event) => makeInternalCaptureEnvelope(event, receivedAt)));
  });
