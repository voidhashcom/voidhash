import type { Db } from "@voidhash/db";
import { Context, Effect, Layer, Option, Schema } from "effect";

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

const decodeRawValue = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

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

      const toRouteClass = (lane: EventProcessorDlqV1["lane"]): RouteClass => {
        if (lane === "overflow" || lane === "historical") return lane;
        return "main";
      };

      const sourceSequence = (event: EventProcessorDlqV1): number => {
        const suffix = event.sourceOffset.split(":").at(-1);
        if (!suffix) return 0;
        const parsed = Number.parseInt(suffix, 10);
        if (!Number.isFinite(parsed)) return 0;
        return parsed;
      };

      const payloadJson = (event: EventProcessorDlqV1): unknown => {
        if (!event.rawValue) return event;
        return Option.getOrElse(decodeRawValue(event.rawValue), () => event);
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
