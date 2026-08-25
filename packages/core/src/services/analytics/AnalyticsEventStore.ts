import { analyticsEvents, and, asc, Db, desc, eq, gt, gte, inArray, lt, lte } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type { AnalyticsEventV1 } from "../../domain/analytics/AnalyticsEvent.ts";
import { ActionForbiddenError } from "../../domain/auth/Auth.ts";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../utils/pagination.ts";

export class AnalyticsEventStoreError extends Schema.TaggedErrorClass<AnalyticsEventStoreError>(
  "AnalyticsEventStoreError",
)("AnalyticsEventStoreError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface ListAnalyticsEventsInput {
  readonly afterSequence?: number;
  readonly end?: Date;
  readonly eventNames?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly projectIds: ReadonlyArray<string>;
  readonly order?: "asc" | "desc";
  readonly start?: Date;
}

/**
 * A persisted event row. The wire contract's `processedAt` field carries the
 * capture-acceptance time (kept under that name for queue compatibility); on a
 * stored row that value lives in `receivedAt`, and `processedAt` is the store's
 * own insert stamp — so `processedAt - receivedAt` is the time the event spent
 * in the ingest queue, and `receivedAt - eventTimestamp` the client-to-server
 * lag.
 */
export interface StoredAnalyticsEvent extends AnalyticsEventV1 {
  readonly sequence: number;
  readonly receivedAt: Date;
}

/**
 * Input for {@link AnalyticsEventStoreShape.listPage}. `afterEventId` is the
 * decoded pagination cursor: the `eventId` of the last row the caller already
 * saw, not an offset.
 */
export interface ListAnalyticsEventsPageInput {
  readonly afterEventId?: string;
  readonly end?: Date;
  readonly eventNames?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly projectIds: ReadonlyArray<string>;
  readonly start?: Date;
}

/**
 * One keyset page of events in descending arrival order (`sequence`), plus
 * whether more rows follow.
 */
export interface AnalyticsEventPage {
  readonly events: ReadonlyArray<StoredAnalyticsEvent>;
  readonly hasNextPage: boolean;
}

export interface AnalyticsEventStoreShape {
  readonly insert: (
    events: ReadonlyArray<AnalyticsEventV1>,
  ) => Effect.Effect<number, AnalyticsEventStoreError>;
  readonly list: (
    input: ListAnalyticsEventsInput,
  ) => Effect.Effect<ReadonlyArray<StoredAnalyticsEvent>, AnalyticsEventStoreError>;
  /**
   * Keyset pagination over the event log in arrival order (`sequence`
   * descending). Paging on the server-assigned `sequence` rather than
   * `eventTimestamp` keeps cursors immune to device-clock skew: a client with
   * a skewed clock cannot pin its events to the first page or bury them, and
   * backdated arrivals cannot insert into pages a cursor has already walked
   * past (which would make pages skip or repeat rows). The wire cursor still
   * encodes the last row's `eventId`; it is resolved to its `sequence` via the
   * unique `(project_id, event_id)` index before the page query runs.
   */
  readonly listPage: (
    input: ListAnalyticsEventsPageInput,
  ) => Effect.Effect<AnalyticsEventPage, AnalyticsEventStoreError | ActionForbiddenError>;
}

const storedIdentityMode = (value: string): StoredAnalyticsEvent["identityMode"] => {
  if (value === "full") return "full";
  return "personless";
};

const storedSource = (value: string): StoredAnalyticsEvent["source"] => {
  if (value === "revenue" || value === "internal") return value;
  return "sdk";
};

const toStoredEvent = (row: typeof analyticsEvents.$inferSelect): StoredAnalyticsEvent => ({
  schemaVersion: 1,
  sequence: row.sequence,
  eventId: row.eventId,
  captureId: row.captureId,
  eventName: row.eventName,
  eventTimestamp: row.eventTimestamp,
  receivedAt: row.receivedAt,
  processedAt: row.processedAt,
  organizationId: row.organizationId,
  projectId: row.projectId,
  distinctId: row.distinctId,
  previousDistinctId: row.previousDistinctId,
  personId: row.personId,
  identityMode: storedIdentityMode(row.identityMode),
  properties: row.properties,
  context: row.context,
  sessionId: row.sessionId,
  token: row.token,
  requestId: row.requestId,
  requestPath: row.requestPath,
  source: storedSource(row.source),
  sourceTopic: row.sourceTopic,
});

const makeAnalyticsEventStore = Effect.gen(function* () {
  const db = yield* Db;

  // The wire contract's `processedAt` is the capture-acceptance time; it lands
  // in `received_at`, and `processed_at` is left to its insert-time default.
  const toInsertRow = (event: AnalyticsEventV1): typeof analyticsEvents.$inferInsert => {
    const { processedAt: acceptedAt, ...rest } = event;
    return { ...rest, receivedAt: acceptedAt };
  };

  const insert = (events: ReadonlyArray<AnalyticsEventV1>) => {
    if (events.length === 0) return Effect.succeed(0);
    return db
      .insert(analyticsEvents)
      .values(events.map(toInsertRow))
      .onConflictDoNothing({ target: [analyticsEvents.projectId, analyticsEvents.eventId] })
      .returning({ sequence: analyticsEvents.sequence })
      .pipe(
        Effect.map((rows) => rows.length),
        Effect.mapError(
          (error) =>
            new AnalyticsEventStoreError({
              cause: String(error.cause),
              message: "failed to insert analytics events",
            }),
        ),
      );
  };

  const list = (input: ListAnalyticsEventsInput) => {
    if (input.projectIds.length === 0) return Effect.succeed([]);
    const conditions = [inArray(analyticsEvents.projectId, [...input.projectIds])];
    if (input.afterSequence !== undefined) {
      conditions.push(gt(analyticsEvents.sequence, input.afterSequence));
    }
    if (input.start !== undefined)
      conditions.push(gte(analyticsEvents.eventTimestamp, input.start));
    if (input.end !== undefined) conditions.push(lte(analyticsEvents.eventTimestamp, input.end));
    if (input.eventNames !== undefined && input.eventNames.length > 0) {
      conditions.push(inArray(analyticsEvents.eventName, [...input.eventNames]));
    }
    let orderBy = asc(analyticsEvents.sequence);
    if (input.order === "desc") orderBy = desc(analyticsEvents.sequence);
    return db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(input.limit ?? 10_000)
      .pipe(
        Effect.map((rows) => rows.map(toStoredEvent)),
        Effect.mapError(
          (error) =>
            new AnalyticsEventStoreError({
              cause: String(error.cause),
              message: "failed to list analytics events",
            }),
        ),
      );
  };

  const storeError = (message: string) => (error: { readonly cause: unknown }) =>
    new AnalyticsEventStoreError({ cause: String(error.cause), message });

  const listPage = (input: ListAnalyticsEventsPageInput) =>
    Effect.gen(function* () {
      const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      if (input.projectIds.length === 0) {
        return { events: [], hasNextPage: false };
      }

      const conditions = [inArray(analyticsEvents.projectId, [...input.projectIds])];
      if (input.start !== undefined) {
        conditions.push(gte(analyticsEvents.eventTimestamp, input.start));
      }
      if (input.end !== undefined) conditions.push(lte(analyticsEvents.eventTimestamp, input.end));
      if (input.eventNames !== undefined && input.eventNames.length > 0) {
        conditions.push(inArray(analyticsEvents.eventName, [...input.eventNames]));
      }

      if (input.afterEventId !== undefined) {
        const anchorRows = yield* db
          .select({ sequence: analyticsEvents.sequence })
          .from(analyticsEvents)
          .where(
            and(
              inArray(analyticsEvents.projectId, [...input.projectIds]),
              eq(analyticsEvents.eventId, input.afterEventId),
            ),
          )
          .limit(1)
          .pipe(Effect.mapError(storeError("failed to resolve analytics event cursor")));
        const cursorRow = anchorRows[0];
        // The cursor names a row that is no longer visible; replaying page one
        // would look like an infinite scroll that never terminates.
        if (cursorRow === undefined) {
          return yield* Effect.fail(
            new ActionForbiddenError({
              message: "Pagination cursor no longer refers to a known item.",
            }),
          );
        }
        conditions.push(lt(analyticsEvents.sequence, cursorRow.sequence));
      }

      // One row beyond the page tells us whether a next page exists without a
      // second COUNT query.
      const rows = yield* db
        .select()
        .from(analyticsEvents)
        .where(and(...conditions))
        .orderBy(desc(analyticsEvents.sequence))
        .limit(limit + 1)
        .pipe(Effect.mapError(storeError("failed to list analytics events")));

      return {
        events: rows.slice(0, limit).map(toStoredEvent),
        hasNextPage: rows.length > limit,
      };
    });

  return { insert, list, listPage } satisfies AnalyticsEventStoreShape;
});

/** PostgreSQL implementation of the portable analytics event store. */
export class AnalyticsEventStore extends Context.Service<
  AnalyticsEventStore,
  AnalyticsEventStoreShape
>()("@voidhash/core/AnalyticsEventStore") {
  static readonly layer: Layer.Layer<AnalyticsEventStore, never, Db> =
    Layer.effect(AnalyticsEventStore)(makeAnalyticsEventStore);
}
