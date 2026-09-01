import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AnalyticsDeadLetterStore } from "../../../application/ports.ts";
import {
  buildDlqEvent,
  CapturedEventV1,
  type CapturedTransportRecord,
} from "../../domain/Ingest.ts";
import { AnalyticsProcessor, ProcessResult } from "../../application/Processor.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Provider-neutral queue record decoded at the transport boundary. */
export const AnalyticsQueueRecord = Schema.Struct({
  body: Schema.Unknown,
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  offset: Schema.String,
  partition: Schema.optional(Schema.Int),
  topic: Schema.String,
});
export type AnalyticsQueueRecord = typeof AnalyticsQueueRecord.Type;

/**
 * Decode a provider queue record and run it through the common processor. A
 * body that fails schema validation is dead-lettered with the purpose-built
 * `captured_event_invalid` class instead of surfacing as a poison message that
 * would loop forever.
 */
export const consumeAnalyticsQueueRecord = (input: unknown) =>
  Effect.gen(function* () {
    const record = yield* Schema.decodeUnknownEffect(AnalyticsQueueRecord)(input);
    const decoded = yield* Effect.result(Schema.decodeUnknownEffect(CapturedEventV1)(record.body));
    if (Result.isFailure(decoded)) {
      const deadLetters = yield* AnalyticsDeadLetterStore;
      let rawValue = "";
      if (P.isString(record.body)) {
        rawValue = record.body;
      } else {
        rawValue = encodeJson(record.body);
      }
      const event = yield* buildDlqEvent({
        failureClass: "captured_event_invalid",
        failureMessage: "captured event failed schema validation",
        headers: record.headers ?? {},
        rawValue,
        sourceOffset: record.offset,
        sourcePartition: record.partition ?? 0,
        sourceTopic: record.topic,
      });
      yield* deadLetters.write([event]);
      return { inserted: 0, status: "dead-lettered" } satisfies typeof ProcessResult.Type;
    }
    const processor = yield* AnalyticsProcessor;
    return yield* processor.process({
      capturedEvent: decoded.success,
      headers: record.headers ?? {},
      rawValue: encodeJson(record.body),
      sourceOffset: record.offset,
      sourcePartition: record.partition ?? 0,
      sourceTopic: record.topic,
    } satisfies typeof CapturedTransportRecord.Type);
  });
