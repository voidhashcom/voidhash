import { Context, Effect, Layer, Schema } from "effect";

import { AnalyticsPortError, AnalyticsStore } from "../../../application/ports.ts";
import type {
  AnalyticsEventPage,
  AnalyticsStoreShape,
  AnalyticsWriteBatch,
  ListAnalyticsEventsInput,
  StoredAnalyticsEvent,
} from "../../../application/ports.ts";

export interface PostgresStatement {
  readonly name: string;
  readonly text: string;
  readonly values: ReadonlyArray<unknown>;
}

/** PostgreSQL client capabilities used by the analytics adapter. */
export interface PostgresAnalyticsClientShape {
  readonly query: <Row extends object>(
    statement: PostgresStatement,
  ) => Effect.Effect<ReadonlyArray<Row>, unknown>;
}

/** PostgreSQL client boundary supplied by the application runtime. */
export class PostgresAnalyticsClient extends Context.Service<
  PostgresAnalyticsClient,
  PostgresAnalyticsClientShape
>()("@voidhash/core-v2/analytics/PostgresAnalyticsClient") {}

const DatabaseDate = Schema.Union([Schema.Date, Schema.DateFromString]);
const DatabaseJsonRecord = Schema.Union([
  Schema.Record(Schema.String, Schema.Unknown),
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
]);

const PostgresEventRow = Schema.Struct({
  sequence: Schema.Union([Schema.Number, Schema.String]),
  schema_version: Schema.Literal(1),
  event_id: Schema.String,
  capture_id: Schema.String,
  event_name: Schema.String,
  event_timestamp: DatabaseDate,
  received_at: DatabaseDate,
  processed_at: DatabaseDate,
  organization_id: Schema.String,
  project_id: Schema.String,
  distinct_id: Schema.String,
  previous_distinct_id: Schema.NullOr(Schema.String),
  person_id: Schema.NullOr(Schema.String),
  identity_mode: Schema.Literals(["full", "personless"]),
  properties: DatabaseJsonRecord,
  context: DatabaseJsonRecord,
  session_id: Schema.NullOr(Schema.String),
  token: Schema.String,
  request_id: Schema.String,
  request_path: Schema.NullOr(Schema.String),
  source: Schema.Literals(["sdk", "revenue", "internal"]),
  source_topic: Schema.String,
});
type PostgresEventRow = typeof PostgresEventRow.Type;

const PostgresCursorRow = Schema.Struct({
  sequence: Schema.Union([Schema.Number, Schema.String]),
});
const PostgresInsertedEventRow = Schema.Struct({ event_id: Schema.String });

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const storedEvent = (row: PostgresEventRow) =>
  ({
    schemaVersion: row.schema_version,
    storageCursor: String(row.sequence),
    eventId: row.event_id,
    captureId: row.capture_id,
    eventName: row.event_name,
    eventTimestamp: row.event_timestamp,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    organizationId: row.organization_id,
    projectId: row.project_id,
    distinctId: row.distinct_id,
    previousDistinctId: row.previous_distinct_id,
    personId: row.person_id,
    identityMode: row.identity_mode,
    properties: row.properties,
    context: row.context,
    sessionId: row.session_id,
    token: row.token,
    requestId: row.request_id,
    requestPath: row.request_path,
    source: row.source,
    sourceTopic: row.source_topic,
  }) satisfies typeof StoredAnalyticsEvent.Type;

const columns = [
  "sequence",
  "schema_version",
  "event_id",
  "capture_id",
  "event_name",
  "event_timestamp",
  "received_at",
  "processed_at",
  "organization_id",
  "project_id",
  "distinct_id",
  "previous_distinct_id",
  "person_id",
  "identity_mode",
  "properties",
  "context",
  "session_id",
  "token",
  "request_id",
  "request_path",
  "source",
  "source_topic",
];

const portError = (message: string) => (cause: unknown) =>
  new AnalyticsPortError({ cause, message });

const filters = (input: typeof ListAnalyticsEventsInput.Type, values: unknown[]) => {
  const conditions = [`project_id = ANY($${values.push([...input.projectIds])}::text[])`];
  if (input.start) conditions.push(`event_timestamp >= $${values.push(input.start)}`);
  if (input.end) conditions.push(`event_timestamp <= $${values.push(input.end)}`);
  if (input.eventNames?.length) {
    conditions.push(`event_name = ANY($${values.push([...input.eventNames])}::text[])`);
  }
  return conditions;
};

const listStatement = (
  input: typeof ListAnalyticsEventsInput.Type,
  cursor?: string,
  fetchExtra = false,
) => {
  const values: unknown[] = [];
  const conditions = filters(input, values);
  if (cursor !== undefined) {
    let comparator = "<";
    if (input.order === "asc") comparator = ">";
    conditions.push(`sequence ${comparator} $${values.push(Number(cursor))}`);
  }
  let order = "DESC";
  if (input.order === "asc") order = "ASC";
  let extra = 0;
  if (fetchExtra) extra = 1;
  const limit = Math.max(input.limit ?? 10_000, 0) + extra;
  values.push(limit);
  return {
    name: "analytics.events.list",
    text: `SELECT ${columns.join(", ")} FROM analytics_event WHERE ${conditions.join(
      " AND ",
    )} ORDER BY sequence ${order} LIMIT $${values.length}`,
    values,
  } satisfies PostgresStatement;
};

const insertStatement = (batch: typeof AnalyticsWriteBatch.Type) => {
  const values: unknown[] = [];
  const rowSql = batch.events.map((event) => {
    const row = [
      event.schemaVersion,
      event.eventId,
      event.captureId,
      event.eventName,
      event.eventTimestamp,
      event.receivedAt,
      event.processedAt,
      event.organizationId,
      event.projectId,
      event.distinctId,
      event.previousDistinctId,
      event.personId,
      event.identityMode,
      encodeJson(event.properties),
      encodeJson(event.context),
      event.sessionId,
      event.token,
      event.requestId,
      event.requestPath,
      event.source,
      event.sourceTopic,
    ];
    const placeholders = row.map((value) => `$${values.push(value)}`);
    return `(${placeholders.join(", ")})`;
  });
  return {
    name: "analytics.events.insert",
    text:
      `INSERT INTO analytics_event (` +
      `schema_version, event_id, capture_id, event_name, event_timestamp, received_at, processed_at, ` +
      `organization_id, project_id, distinct_id, previous_distinct_id, person_id, identity_mode, ` +
      `properties, context, session_id, token, request_id, request_path, source, source_topic) VALUES ` +
      rowSql.join(", ") +
      ` ON CONFLICT (project_id, event_id) DO NOTHING RETURNING event_id`,
    values,
  } satisfies PostgresStatement;
};

const makePostgresAnalyticsStore = Effect.gen(function* () {
  const client = yield* PostgresAnalyticsClient;
  const list = (input: typeof ListAnalyticsEventsInput.Type) => {
    if (input.projectIds.length === 0) return Effect.succeed([]);
    return client.query<PostgresEventRow>(listStatement(input)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(PostgresEventRow))),
      Effect.map((rows) => rows.map(storedEvent)),
      Effect.mapError(portError("failed to list analytics events")),
    );
  };

  const listPage = (input: typeof ListAnalyticsEventsInput.Type) => {
    if (input.projectIds.length === 0) {
      return Effect.succeed({
        events: [],
        hasNextPage: false,
      } satisfies typeof AnalyticsEventPage.Type);
    }
    return Effect.gen(function* () {
      let cursor: string | undefined;
      if (input.afterEventId) {
        const anchor = yield* client
          .query<{ readonly sequence: number | string }>({
            name: "analytics.events.cursor",
            text: "SELECT sequence FROM analytics_event WHERE project_id = ANY($1::text[]) AND event_id = $2 LIMIT 1",
            values: [[...input.projectIds], input.afterEventId],
          })
          .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(PostgresCursorRow))));
        if (!anchor[0]) {
          return yield* Effect.fail({
            cause: input.afterEventId,
            message: "analytics event cursor was not found",
          });
        }
        cursor = String(anchor[0].sequence);
      }
      const rows = yield* client
        .query<PostgresEventRow>(listStatement(input, cursor, true))
        .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(PostgresEventRow))));
      const limit = input.limit ?? 100;
      return {
        events: rows.slice(0, limit).map(storedEvent),
        hasNextPage: rows.length > limit,
      };
    }).pipe(Effect.mapError(portError("failed to page analytics events")));
  };

  return {
    insert: (batch) => {
      if (batch.events.length === 0) return Effect.succeed(0);
      return client.query<{ readonly event_id: string }>(insertStatement(batch)).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(PostgresInsertedEventRow))),
        Effect.map((rows) => rows.length),
        Effect.mapError(portError("failed to insert analytics events")),
      );
    },
    list,
    listPage,
  } satisfies AnalyticsStoreShape;
});

/** PostgreSQL implementation of the unified analytics store. */
export const PostgresAnalyticsStoreLive = Layer.effect(AnalyticsStore)(makePostgresAnalyticsStore);
