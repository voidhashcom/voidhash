import { Context, type Effect, Schema } from "effect";

import { AnalyticsEventV1 } from "../../domain/AnalyticsEvent.ts";
import {
  ProcessorPersonEventV1,
  ProcessorPersonIdentityEventV1,
} from "../../ingest/domain/Ingest.ts";
import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** A canonical event decorated with storage-owned pagination metadata. */
export const StoredAnalyticsEvent = Schema.Struct({
  ...AnalyticsEventV1.fields,
  /** Stable adapter cursor used to order and resume event scans. */
  storageCursor: Schema.String,
});

/** Filters and pagination controls for reading canonical events. */
export const ListAnalyticsEventsInput = Schema.Struct({
  /** Resume after this event in the requested ordering. */
  afterEventId: Schema.optional(Schema.String),
  /** Inclusive upper bound for event time. */
  end: Schema.optional(Schema.Date),
  /** Optional allow-list of event names. */
  eventNames: Schema.optional(Schema.Array(Schema.String)),
  /** Maximum number of events to return. Must be positive. */
  limit: Schema.optional(Schema.Int.pipe(Schema.refine((value): value is number => value > 0))),
  /** Direction in which events are read. */
  order: Schema.optional(Schema.Literals(["asc", "desc"])),
  /** Authorized projects included in the read. */
  projectIds: Schema.Array(Schema.String),
  /** Inclusive lower bound for event time. */
  start: Schema.optional(Schema.Date),
});

/** One page of stored events and its continuation state. */
export const AnalyticsEventPage = Schema.Struct({
  events: Schema.Array(StoredAnalyticsEvent),
  hasNextPage: Schema.Boolean,
});

/**
 * Canonical events plus the identity projections derived while processing.
 * Adapters that maintain their own identity tables commit these as part of the
 * same logical write; adapters whose identity ownership lives elsewhere (e.g.
 * the PostgreSQL adapter, where the primary database owns identity) may ignore
 * the projections but must say so here rather than dropping them silently.
 */
export const AnalyticsWriteBatch = Schema.Struct({
  events: Schema.Array(AnalyticsEventV1),
  /** Supplies tenant ownership for every project represented in the batch. */
  organizationIdsByProject: Schema.Record(Schema.String, Schema.String),
  personEvents: Schema.Array(ProcessorPersonEventV1),
  personIdentityEvents: Schema.Array(ProcessorPersonIdentityEventV1),
});

/** Portable storage capabilities implemented by PostgreSQL and ClickHouse adapters. */
export interface AnalyticsStoreShape {
  /**
   * Persists a processed batch and returns the number of canonical events
   * submitted for insert — duplicates may still be collapsed by the adapter.
   */
  readonly insert: (
    batch: typeof AnalyticsWriteBatch.Type,
  ) => Effect.Effect<number, AnalyticsPortError>;
  /** Lists stored events without computing pagination metadata. */
  readonly list: (
    input: typeof ListAnalyticsEventsInput.Type,
  ) => Effect.Effect<ReadonlyArray<typeof StoredAnalyticsEvent.Type>, AnalyticsPortError>;
  /** Lists stored events together with whether another page is available. */
  readonly listPage: (
    input: typeof ListAnalyticsEventsInput.Type,
  ) => Effect.Effect<typeof AnalyticsEventPage.Type, AnalyticsPortError>;
}

/** Portable storage boundary implemented by PostgreSQL and ClickHouse adapters. */
export class AnalyticsStore extends Context.Service<AnalyticsStore, AnalyticsStoreShape>()(
  "@voidhash/core-v2/analytics/AnalyticsStore",
) {}
