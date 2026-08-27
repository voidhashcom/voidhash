import { Effect, Schema } from "effect";

import { CapturedEventV1, type CapturedTransportRecord } from "../../domain/Ingest.ts";
import { AnalyticsProcessor } from "../../application/Processor.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Provider-neutral queue record decoded at the transport boundary. */
export const AnalyticsQueueRecord = Schema.Struct({
  body: Schema.Unknown,
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  offset: Schema.String,
  partition: Schema.optional(Schema.Int),
  topic: Schema.String,
});

/** Decode a provider queue record and run it through the common processor. */
export const consumeAnalyticsQueueRecord = (input: unknown) =>
  Effect.gen(function* () {
    const record = yield* Schema.decodeUnknownEffect(AnalyticsQueueRecord)(input);
    const capturedEvent = yield* Schema.decodeUnknownEffect(CapturedEventV1)(record.body);
    const processor = yield* AnalyticsProcessor;
    return yield* processor.process({
      capturedEvent,
      headers: record.headers ?? {},
      rawValue: encodeJson(record.body),
      sourceOffset: record.offset,
      sourcePartition: record.partition ?? 0,
      sourceTopic: record.topic,
    } satisfies typeof CapturedTransportRecord.Type);
  });
