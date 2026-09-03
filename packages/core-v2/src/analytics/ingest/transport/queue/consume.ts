import * as Arr from "effect/Array";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AnalyticsDeadLetterStore } from "../../../application/ports.ts";
import {
  buildDlqEvent,
  CapturedEventV1,
  type CapturedTransportRecord,
  type EventProcessorDlqV1,
} from "../../domain/Ingest.ts";
import {
  AnalyticsProcessor,
  type ProcessBatchResult,
  type ProcessResult,
} from "../../application/Processor.ts";

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

const rawValueOf = (body: unknown) => (P.isString(body) ? body : encodeJson(body));

/**
 * Decode one queue record into either the dead-letter event describing why its
 * body is not a captured event (failure) or a transport record for the
 * processor (success).
 */
type DecodedQueueRecord = Result.Result<
  typeof CapturedTransportRecord.Type,
  typeof EventProcessorDlqV1.Type
>;

const decodeQueueRecord = (record: typeof AnalyticsQueueRecord.Type) =>
  Effect.gen(function* () {
    const decoded = yield* Effect.result(Schema.decodeUnknownEffect(CapturedEventV1)(record.body));
    if (Result.isFailure(decoded)) {
      const event = yield* buildDlqEvent({
        failureClass: "captured_event_invalid",
        failureMessage: "captured event failed schema validation",
        headers: record.headers ?? {},
        rawValue: rawValueOf(record.body),
        sourceOffset: record.offset,
        sourcePartition: record.partition ?? 0,
        sourceTopic: record.topic,
      });
      const failure: DecodedQueueRecord = Result.fail(event);
      return failure;
    }
    const success: DecodedQueueRecord = Result.succeed({
      capturedEvent: decoded.success,
      headers: record.headers ?? {},
      rawValue: encodeJson(record.body),
      sourceOffset: record.offset,
      sourcePartition: record.partition ?? 0,
      sourceTopic: record.topic,
    });
    return success;
  });

/**
 * Decode a whole queue delivery and run it through the common processor as one
 * batch. Bodies that fail schema validation are dead-lettered with the
 * purpose-built `captured_event_invalid` class instead of surfacing as poison
 * messages that would loop forever; the remaining records share one project
 * lookup per credential and one store write.
 */
export const consumeAnalyticsQueueRecords = (inputs: ReadonlyArray<unknown>) =>
  Effect.gen(function* () {
    const records = yield* Effect.forEach(
      inputs,
      (input) =>
        Schema.decodeUnknownEffect(AnalyticsQueueRecord)(input).pipe(
          Effect.flatMap(decodeQueueRecord),
        ),
      { concurrency: 1 },
    );
    const [invalid, transports] = Arr.separate(records);
    if (Arr.isReadonlyArrayNonEmpty(invalid)) {
      const deadLetters = yield* AnalyticsDeadLetterStore;
      yield* deadLetters.write(invalid);
    }
    const processor = yield* AnalyticsProcessor;
    const outcome = yield* processor.processBatch(transports);
    return {
      deadLettered: outcome.deadLettered + invalid.length,
      inserted: outcome.inserted,
      stored: outcome.stored,
    } satisfies typeof ProcessBatchResult.Type;
  });

/** Single-record form of {@link consumeAnalyticsQueueRecords}. */
export const consumeAnalyticsQueueRecord = (input: unknown) =>
  Effect.map(consumeAnalyticsQueueRecords([input]), (outcome) =>
    outcome.stored > 0
      ? ({ inserted: outcome.inserted, status: "stored" } satisfies typeof ProcessResult.Type)
      : ({ inserted: 0, status: "dead-lettered" } satisfies typeof ProcessResult.Type),
  );
