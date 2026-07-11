import type { Db } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type {
  EventProcessorDlqV1,
  RouteClass,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import { AnalyticsIngestDlqService } from "./AnalyticsIngestDlqService.ts";

export class DlqProducerError extends Schema.TaggedErrorClass<DlqProducerError>("DlqProducerError")(
  "DlqProducerError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export interface DlqProducerShape {
  readonly publishBatch: (
    events: ReadonlyArray<EventProcessorDlqV1>,
  ) => Effect.Effect<void, DlqProducerError, Db>;
}

export class DlqProducer extends Context.Service<DlqProducer, DlqProducerShape>()(
  "@voidhash/core/DlqProducer",
) {
  static readonly dbLive = Layer.effect(
    DlqProducer,
    Effect.gen(function* () {
      const dlq = yield* AnalyticsIngestDlqService;

      const toRouteClass = (lane: EventProcessorDlqV1["lane"]): RouteClass =>
        lane === "overflow" || lane === "historical" ? lane : "main";

      const sourceSequence = (event: EventProcessorDlqV1): number => {
        const suffix = event.sourceOffset.split(":").at(-1);
        const parsed = suffix ? Number.parseInt(suffix, 10) : Number.NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const payloadJson = (event: EventProcessorDlqV1): unknown => {
        if (!event.rawValue) return event;
        try {
          return JSON.parse(event.rawValue) as unknown;
        } catch {
          return event;
        }
      };

      return {
        publishBatch: (events) =>
          Effect.forEach(
            events,
            (event) =>
              dlq
                .recordFailure({
                  attemptCount: 0,
                  captureId: event.captureId,
                  distinctId: event.distinctId,
                  failureClass: event.failureClass,
                  failureMessage: event.failureMessage,
                  payloadJson: payloadJson(event),
                  projectId: event.projectId ?? "unknown",
                  routeClass: toRouteClass(event.lane),
                  sourceSequence: sourceSequence(event),
                  sourceShard: event.sourceTopic,
                })
                .pipe(
                  Effect.mapError(
                    (error) =>
                      new DlqProducerError({
                        cause: String(error.cause),
                        message: "failed to record analytics ingest DLQ row",
                      }),
                  ),
                ),
            { discard: true },
          ),
      } satisfies DlqProducerShape;
    }),
  );

  static readonly noop: Layer.Layer<DlqProducer> = Layer.succeed(DlqProducer, {
    publishBatch: () => Effect.void,
  });
}
