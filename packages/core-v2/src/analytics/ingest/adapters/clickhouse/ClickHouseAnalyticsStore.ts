import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AnalyticsPortError, AnalyticsStore } from "../../../application/ports.ts";
import type {
  AnalyticsEventPage,
  AnalyticsStoreShape,
  ListAnalyticsEventsInput,
  StoredAnalyticsEvent,
} from "../../../application/ports.ts";
import { toAnalyticsWriteBatchRows } from "./rows.ts";

export interface ClickHouseStatement {
  readonly name: string;
  readonly sql: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly queryId?: string;
  readonly quotaKey?: string;
}

/** ClickHouse client capabilities used by analytics adapters. */
export interface ClickHouseAnalyticsClientShape {
  readonly insert: (input: {
    /** Stable token used by ClickHouse to deduplicate an ambiguous retry. */
    readonly deduplicationToken?: string;
    readonly table: string;
    readonly values: ReadonlyArray<Record<string, unknown>>;
  }) => Effect.Effect<void, unknown>;
  readonly query: (
    statement: ClickHouseStatement,
  ) => Effect.Effect<ReadonlyArray<unknown>, unknown>;
}

/** ClickHouse client boundary supplied by the application runtime. */
export class ClickHouseAnalyticsClient extends Context.Service<
  ClickHouseAnalyticsClient,
  ClickHouseAnalyticsClientShape
>()("@voidhash/core-v2/analytics/ClickHouseAnalyticsClient") {}

const normalizeTimestamp = (value: string) => {
  let normalized = value;
  if (!normalized.includes("T")) normalized = normalized.replace(" ", "T");
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) normalized = `${normalized}Z`;
  return normalized;
};
const ClickHouseTimestamp = Schema.String.pipe(
  Schema.refine(
    (value): value is string => Option.isSome(DateTime.make(normalizeTimestamp(value))),
    { expected: "a valid ClickHouse timestamp" },
  ),
);
const ClickHouseJsonRecord = Schema.Union([
  Schema.Record(Schema.String, Schema.Unknown),
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
]);

const ClickHouseEventRow = Schema.Struct({
  event_id: Schema.String,
  capture_id: Schema.String,
  event_name: Schema.String,
  event_ts: ClickHouseTimestamp,
  received_ts: Schema.optional(ClickHouseTimestamp),
  processed_ts: ClickHouseTimestamp,
  inserted_ts: ClickHouseTimestamp,
  organization_id: Schema.String,
  project_id: Schema.String,
  distinct_id: Schema.String,
  previous_distinct_id: Schema.NullOr(Schema.String),
  person_id: Schema.NullOr(Schema.String),
  identity_mode: Schema.Literals(["full", "personless"]),
  event_properties: ClickHouseJsonRecord,
  context: ClickHouseJsonRecord,
  token: Schema.String,
  request_id: Schema.String,
  request_path: Schema.String,
  session_id: Schema.NullOr(Schema.String),
  source_topic: Schema.String,
});
type ClickHouseEventRow = typeof ClickHouseEventRow.Type;

const ClickHouseCursorRow = Schema.Struct({
  event_id: Schema.String,
  inserted_ts: ClickHouseTimestamp,
});

const utc = (value: string) => {
  return DateTime.toDateUtc(DateTime.makeUnsafe(normalizeTimestamp(value)));
};

const source = (topic: string) => {
  if (topic.startsWith("revenue.")) return "revenue";
  if (topic.startsWith("experiment.")) return "internal";
  return "sdk";
};

const storedEvent = (row: ClickHouseEventRow) =>
  ({
    schemaVersion: 1,
    storageCursor: `${row.inserted_ts}|${row.event_id}`,
    eventId: row.event_id,
    captureId: row.capture_id,
    eventName: row.event_name,
    eventTimestamp: utc(row.event_ts),
    receivedAt: utc(row.received_ts ?? row.processed_ts),
    processedAt: utc(row.processed_ts),
    organizationId: row.organization_id,
    projectId: row.project_id,
    distinctId: row.distinct_id,
    previousDistinctId: row.previous_distinct_id || null,
    personId: row.person_id || null,
    identityMode: row.identity_mode,
    properties: row.event_properties,
    context: row.context,
    sessionId: row.session_id || null,
    token: row.token,
    requestId: row.request_id,
    requestPath: row.request_path || null,
    source: source(row.source_topic),
    sourceTopic: row.source_topic,
  }) satisfies typeof StoredAnalyticsEvent.Type;

const portError = (message: string) => (cause: unknown) =>
  new AnalyticsPortError({ cause, message });
const STORE_OPERATION_TIMEOUT = "30 seconds";

const selectedColumns = [
  "event_id",
  "capture_id",
  "event_name",
  "event_ts",
  "received_ts",
  "processed_ts",
  "inserted_ts",
  "organization_id",
  "project_id",
  "distinct_id",
  "previous_distinct_id",
  "person_id",
  "identity_mode",
  "event_properties",
  "context",
  "token",
  "request_id",
  "request_path",
  "session_id",
  "source_topic",
].join(", ");

const listStatement = (
  input: typeof ListAnalyticsEventsInput.Type,
  limit: number,
  cursor?: { readonly eventId: string; readonly insertedAt: string },
) => {
  const params: Record<string, unknown> = { projectIds: [...input.projectIds] };
  const where = ["project_id IN {projectIds:Array(String)}"];
  if (input.start) {
    // ISO-8601 with an explicit UTC offset so the range filter is correct on
    // non-UTC ClickHouse servers too.
    params.start = input.start.toISOString();
    where.push("event_ts >= {start:DateTime64(3)}");
  }
  if (input.end) {
    params.end = input.end.toISOString();
    where.push("event_ts <= {end:DateTime64(3)}");
  }
  if (input.eventNames?.length) {
    params.eventNames = [...input.eventNames];
    where.push("event_name IN {eventNames:Array(String)}");
  }
  let order = "DESC";
  if (input.order === "asc") order = "ASC";
  let cursorClause = "";
  if (cursor) {
    params.cursorInsertedAt = cursor.insertedAt;
    params.cursorEventId = cursor.eventId;
    let comparator = "<";
    if (input.order === "asc") comparator = ">";
    cursorClause = `WHERE (inserted_ts, event_id) ${comparator} ({cursorInsertedAt:DateTime64(3)}, {cursorEventId:String})`;
  }
  // The keyset cursor must be applied OUTSIDE the dedupe subquery: replayed
  // events carry multiple physical rows until ReplacingMergeTree merges, and a
  // cursor inside the dedupe would let the older duplicate of an already
  // returned event resurface on the next page.
  return {
    name: "analytics.events.list",
    sql:
      `SELECT ${selectedColumns} FROM (` +
      `SELECT ${selectedColumns} FROM (` +
      `SELECT ${selectedColumns} FROM analytics_events_v2 WHERE ${where.join(" AND ")} ` +
      `ORDER BY processed_ts DESC LIMIT 1 BY project_id, event_id` +
      `) ${cursorClause}` +
      `) ORDER BY inserted_ts ${order}, event_id ${order} LIMIT {limit:UInt32}`,
    params: { ...params, limit: Math.max(limit, 0) },
  } satisfies ClickHouseStatement;
};

const makeClickHouseAnalyticsStore = Effect.fn("makeClickHouseAnalyticsStore")(function* () {
  const client = yield* ClickHouseAnalyticsClient;
  const list = (input: typeof ListAnalyticsEventsInput.Type) => {
    if (Arr.isReadonlyArrayEmpty(input.projectIds)) return Effect.succeed([]);
    return client.query(listStatement(input, input.limit ?? 10_000)).pipe(
      Effect.timeout(STORE_OPERATION_TIMEOUT),
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseEventRow))),
      Effect.map((rows) => rows.map(storedEvent)),
      Effect.mapError(portError("failed to list analytics events")),
    );
  };

  return {
    insert: (batch) =>
      Effect.gen(function* () {
        const rows = toAnalyticsWriteBatchRows(batch);
        const insertedEventCount = rows.reduce((count, row) => {
          if (row.record_type === "event") return count + 1;
          return count;
        }, 0);
        yield* Option.match(Arr.head(rows), {
          onNone: () => Effect.void,
          onSome: (first) =>
            client
              .insert({
                deduplicationToken: String(first.write_id),
                table: "analytics_records_v1",
                values: rows,
              })
              .pipe(Effect.timeout(STORE_OPERATION_TIMEOUT)),
        });
        return insertedEventCount;
      }).pipe(Effect.mapError(portError("failed to insert analytics batch"))),
    list,
    listPage: (input) => {
      if (Arr.isReadonlyArrayEmpty(input.projectIds)) {
        return Effect.succeed({
          events: [],
          hasNextPage: false,
        } satisfies typeof AnalyticsEventPage.Type);
      }
      return Effect.gen(function* () {
        const cursor = yield* Effect.gen(function* () {
          if (!input.afterEventId) return undefined;
          const anchors = yield* client
            .query({
              name: "analytics.events.cursor",
              sql: "SELECT event_id, inserted_ts FROM analytics_events_v2 WHERE project_id IN {projectIds:Array(String)} AND event_id = {eventId:String} ORDER BY processed_ts DESC LIMIT 1",
              params: { eventId: input.afterEventId, projectIds: [...input.projectIds] },
            })
            .pipe(
              Effect.timeout(STORE_OPERATION_TIMEOUT),
              Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseCursorRow))),
            );
          if (anchors[0]) {
            return { eventId: anchors[0].event_id, insertedAt: anchors[0].inserted_ts };
          } else {
            return yield* Effect.fail({
              cause: input.afterEventId,
              message: "analytics event cursor was not found",
            });
          }
        });
        const limit = input.limit ?? 100;
        const rows = yield* client
          .query(listStatement(input, limit + 1, cursor))
          .pipe(
            Effect.timeout(STORE_OPERATION_TIMEOUT),
            Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseEventRow))),
          );
        return {
          events: rows.slice(0, limit).map(storedEvent),
          hasNextPage: rows.length > limit,
        };
      }).pipe(Effect.mapError(portError("failed to page analytics events")));
    },
  } satisfies AnalyticsStoreShape;
})();

/** ClickHouse implementation of the unified analytics store. */
export const ClickHouseAnalyticsStoreLive = Layer.effect(AnalyticsStore)(
  makeClickHouseAnalyticsStore,
);
