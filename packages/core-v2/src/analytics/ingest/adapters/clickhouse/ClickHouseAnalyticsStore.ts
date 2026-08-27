import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { AnalyticsPortError, AnalyticsStore } from "../../../application/ports.ts";
import type {
  AnalyticsEventPage,
  AnalyticsStoreShape,
  AnalyticsWriteBatch,
  ListAnalyticsEventsInput,
  StoredAnalyticsEvent,
} from "../../../application/ports.ts";
import {
  toAnalyticsEventRow,
  toClickhouseTimestamp,
  toPendingOverrideRow,
  toPersonIdentityRow,
  toPersonRow,
} from "./rows.ts";

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
    readonly table: string;
    readonly values: ReadonlyArray<Record<string, unknown>>;
  }) => Effect.Effect<void, unknown>;
  readonly query: <Row extends object>(
    statement: ClickHouseStatement,
  ) => Effect.Effect<ReadonlyArray<Row>, unknown>;
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

const isIdentityOverride = (
  event: (typeof AnalyticsWriteBatch.Type)["personIdentityEvents"][number],
) => Boolean(event.previousDistinctId && event.version > 0);

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
  cursor?: { readonly eventId: string; readonly insertedAt: string },
  extra = 0,
) => {
  const params: Record<string, unknown> = { projectIds: [...input.projectIds] };
  const where = ["project_id IN {projectIds:Array(String)}"];
  if (input.start) {
    params.start = toClickhouseTimestamp(input.start.toISOString());
    where.push("event_ts >= {start:DateTime64(3)}");
  }
  if (input.end) {
    params.end = toClickhouseTimestamp(input.end.toISOString());
    where.push("event_ts <= {end:DateTime64(3)}");
  }
  if (input.eventNames?.length) {
    params.eventNames = [...input.eventNames];
    where.push("event_name IN {eventNames:Array(String)}");
  }
  if (cursor) {
    params.cursorInsertedAt = cursor.insertedAt;
    params.cursorEventId = cursor.eventId;
    let comparator = "<";
    if (input.order === "asc") comparator = ">";
    where.push(
      `(inserted_ts, event_id) ${comparator} ({cursorInsertedAt:DateTime64(3)}, {cursorEventId:String})`,
    );
  }
  params.limit = Math.max(input.limit ?? 10_000, 0) + extra;
  let order = "DESC";
  if (input.order === "asc") order = "ASC";
  return {
    name: "analytics.events.list",
    sql:
      `SELECT ${selectedColumns} FROM (` +
      `SELECT ${selectedColumns} FROM events_v2 WHERE ${where.join(" AND ")} ` +
      `ORDER BY processed_ts DESC LIMIT 1 BY project_id, event_id` +
      `) ORDER BY inserted_ts ${order}, event_id ${order} LIMIT {limit:UInt32}`,
    params,
  } satisfies ClickHouseStatement;
};

const makeClickHouseAnalyticsStore = Effect.gen(function* () {
  const client = yield* ClickHouseAnalyticsClient;
  const list = (input: typeof ListAnalyticsEventsInput.Type) => {
    if (input.projectIds.length === 0) return Effect.succeed([]);
    return client.query<ClickHouseEventRow>(listStatement(input)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseEventRow))),
      Effect.map((rows) => rows.map(storedEvent)),
      Effect.mapError(portError("failed to list analytics events")),
    );
  };

  return {
    insert: (batch) =>
      Effect.gen(function* () {
        if (batch.events.length > 0) {
          yield* client.insert({
            table: "events_v2",
            values: batch.events.map(toAnalyticsEventRow),
          });
        }
        if (batch.personEvents.length > 0) {
          yield* client.insert({
            table: "persons_v1",
            values: batch.personEvents.map((event) =>
              toPersonRow(event, batch.organizationIdsByProject[event.projectId] ?? ""),
            ),
          });
        }
        if (batch.personIdentityEvents.length > 0) {
          yield* client.insert({
            table: "person_identity_v1",
            values: batch.personIdentityEvents.map((event) =>
              toPersonIdentityRow(event, batch.organizationIdsByProject[event.projectId] ?? ""),
            ),
          });
          const overrides = batch.personIdentityEvents.filter(isIdentityOverride);
          if (overrides.length > 0) {
            yield* client.insert({
              table: "person_identity_overrides_v1",
              values: overrides.map((event) =>
                toPersonIdentityRow(event, batch.organizationIdsByProject[event.projectId] ?? ""),
              ),
            });
            yield* client.insert({
              table: "person_identity_pending_overrides_v2",
              values: overrides.map((event) =>
                toPendingOverrideRow(event, batch.organizationIdsByProject[event.projectId] ?? ""),
              ),
            });
          }
        }
        return batch.events.length;
      }).pipe(Effect.mapError(portError("failed to insert analytics batch"))),
    list,
    listPage: (input) => {
      if (input.projectIds.length === 0) {
        return Effect.succeed({
          events: [],
          hasNextPage: false,
        } satisfies typeof AnalyticsEventPage.Type);
      }
      return Effect.gen(function* () {
        let cursor: { readonly eventId: string; readonly insertedAt: string } | undefined;
        if (input.afterEventId) {
          const anchors = yield* client
            .query<{
              readonly event_id: string;
              readonly inserted_ts: string;
            }>({
              name: "analytics.events.cursor",
              sql: "SELECT event_id, inserted_ts FROM events_v2 WHERE project_id IN {projectIds:Array(String)} AND event_id = {eventId:String} ORDER BY processed_ts DESC LIMIT 1",
              params: { eventId: input.afterEventId, projectIds: [...input.projectIds] },
            })
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseCursorRow))));
          if (anchors[0]) {
            cursor = { eventId: anchors[0].event_id, insertedAt: anchors[0].inserted_ts };
          } else {
            return yield* Effect.fail({
              cause: input.afterEventId,
              message: "analytics event cursor was not found",
            });
          }
        }
        const limit = input.limit ?? 100;
        const rows = yield* client
          .query<ClickHouseEventRow>(listStatement(input, cursor, 1))
          .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(ClickHouseEventRow))));
        return {
          events: rows.slice(0, limit).map(storedEvent),
          hasNextPage: rows.length > limit,
        };
      }).pipe(Effect.mapError(portError("failed to page analytics events")));
    },
  } satisfies AnalyticsStoreShape;
});

/** ClickHouse implementation of the unified analytics store. */
export const ClickHouseAnalyticsStoreLive = Layer.effect(AnalyticsStore)(
  makeClickHouseAnalyticsStore,
);
