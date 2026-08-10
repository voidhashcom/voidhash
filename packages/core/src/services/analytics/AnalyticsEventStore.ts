import { analyticsEvents, and, asc, Db, desc, gt, gte, inArray, lte } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type { AnalyticsEventV1 } from "../../domain/analytics/AnalyticsEvent.ts";

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

export interface StoredAnalyticsEvent extends AnalyticsEventV1 {
  readonly sequence: number;
}

export interface AnalyticsEventStoreShape {
  readonly insert: (
    events: ReadonlyArray<AnalyticsEventV1>,
  ) => Effect.Effect<number, AnalyticsEventStoreError>;
  readonly list: (
    input: ListAnalyticsEventsInput,
  ) => Effect.Effect<ReadonlyArray<StoredAnalyticsEvent>, AnalyticsEventStoreError>;
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

  const insert = (events: ReadonlyArray<AnalyticsEventV1>) => {
    if (events.length === 0) return Effect.succeed(0);
    return db
      .insert(analyticsEvents)
      .values([...events])
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

  return { insert, list } satisfies AnalyticsEventStoreShape;
});

/** PostgreSQL implementation of the portable analytics event store. */
export class AnalyticsEventStore extends Context.Service<
  AnalyticsEventStore,
  AnalyticsEventStoreShape
>()("@voidhash/core/AnalyticsEventStore") {
  static readonly layer: Layer.Layer<AnalyticsEventStore, never, Db> =
    Layer.effect(AnalyticsEventStore)(makeAnalyticsEventStore);
}
