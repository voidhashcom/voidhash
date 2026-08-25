/**
 * Integration tests for {@link AnalyticsEventStore.listPage}, run against the
 * real Postgres provisioned once by the suite's `globalSetup`. The read under
 * test is the keyset walk over the event log: the cursor's `eventId` resolves
 * to its row's `sequence` via the unique `(project_id, event_id)` index, then
 * the page is `sequence < anchor ORDER BY sequence DESC LIMIT n+1` — so pages
 * follow *arrival* order and are immune to device-clock skew.
 *
 * Conventions (see CommunityPostgresAnalytics.integration.test.ts): every test
 * writes under the seeded fixture project ({@link CoreTestFixture}) with
 * per-call unique event ids/names, keeps walk assertions scoped to those
 * names, and deletes the rows it inserted on exit, success or failure.
 */
import { AnalyticsEventStore } from "@voidhash/core/services/analytics/AnalyticsEventStore";
import { AnalyticsService } from "@voidhash/core/services/analytics/AnalyticsService";
import type {
  AnalyticsEventPage,
  AnalyticsEventStoreShape,
  StoredAnalyticsEvent,
} from "@voidhash/core/services/analytics/AnalyticsEventStore";
import type { AnalyticsEventV1 } from "@voidhash/core/domain/analytics/AnalyticsEvent";
import { ActionForbiddenError } from "@voidhash/core/domain/auth/Auth";
import { analyticsEvents, Db, inArray } from "@voidhash/db";
import { Clock, DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

const eventStoreLayer = AnalyticsEventStore.layer;
const analyticsReadLayer = Layer.merge(
  eventStoreLayer,
  AnalyticsService.layer.pipe(Layer.provide(eventStoreLayer)),
);

/** Builds a `Date` from epoch millis without the `new Date` global. */
const dateAt = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** Monotonic counter so ids stay unique even within one millisecond. */
let seq = 0;
const unique = (prefix: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `${prefix}_${now}_${seq++}`);

/** A minimal portable event; `eventTimestamp` is caller-controlled on purpose. */
const makeEvent = (input: {
  readonly eventId: string;
  readonly eventName: string;
  readonly eventTimestamp: Date;
}): AnalyticsEventV1 => ({
  schemaVersion: 1,
  eventId: input.eventId,
  captureId: `capture_${input.eventId}`,
  eventName: input.eventName,
  eventTimestamp: input.eventTimestamp,
  processedAt: input.eventTimestamp,
  organizationId: CoreTestFixture.organizationId,
  projectId,
  distinctId: "device-1",
  previousDistinctId: null,
  personId: null,
  identityMode: "personless",
  properties: {},
  context: {},
  sessionId: null,
  token: "it-token",
  requestId: `req_${input.eventId}`,
  requestPath: null,
  source: "sdk",
  sourceTopic: "community.capture.v1",
});

/** Delete the inserted event rows; `ignore`d so cleanup never fails a test. */
const cleanupEvents = (eventIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (eventIds.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(analyticsEvents)
      .where(inArray(analyticsEvents.eventId, [...eventIds]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every event it inserts is removed afterward, regardless
 * of how the test exits. Ids are collected lazily via `Effect.ensuring`.
 */
const withEventCleanup = <E, R>(
  body: (track: (eventId: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const eventIds: string[] = [];
  return body((eventId) => {
    eventIds.push(eventId);
  }).pipe(Effect.ensuring(cleanupEvents(eventIds)));
};

/**
 * Follow `hasNextPage` / the last row's `eventId` to exhaustion, exactly like
 * the route does, returning every page. Bounded so a paging bug that never
 * terminates fails the test instead of hanging it.
 */
const walkPages = (
  store: AnalyticsEventStoreShape,
  input: { readonly eventNames: ReadonlyArray<string>; readonly limit: number },
) =>
  Effect.gen(function* () {
    const pages: Array<AnalyticsEventPage> = [];
    let after: string | undefined = undefined;
    for (let i = 0; i < 25; i++) {
      const page: AnalyticsEventPage = yield* store.listPage({
        afterEventId: after,
        eventNames: input.eventNames,
        limit: input.limit,
        projectIds: [projectId],
      });
      pages.push(page);
      if (!page.hasNextPage) return pages;
      const last: StoredAnalyticsEvent | undefined = page.events[page.events.length - 1];
      if (last === undefined) return pages;
      after = last.eventId;
    }
    return pages;
  });

test(
  "pages the event log in arrival order to exhaustion without duplicates or gaps",
  withEventCleanup((track) =>
    Effect.gen(function* () {
      const store = yield* AnalyticsEventStore;
      const eventName = yield* unique("it_page_walk");
      const base = yield* Clock.currentTimeMillis;

      // Deliberately shuffled client timestamps: arrival order (sequence) must
      // drive the pages, so a skewed clock cannot reorder them.
      const timestampOffsetsMinutes = [5, 55, 1, 40, 25, 60, 10];
      const insertedIds: string[] = [];
      for (const offset of timestampOffsetsMinutes) {
        const eventId = yield* unique("evt_walk");
        track(eventId);
        insertedIds.push(eventId);
        const inserted = yield* store.insert([
          makeEvent({
            eventId,
            eventName,
            eventTimestamp: dateAt(base - offset * 60_000),
          }),
        ]);
        expect(inserted).toBe(1);
      }

      const pages = yield* walkPages(store, { eventNames: [eventName], limit: 3 });

      expect(pages.map((page) => page.events.length)).toEqual([3, 3, 1]);
      expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);

      // Descending sequence = reverse insertion order, regardless of the
      // shuffled eventTimestamps; no row repeats or goes missing.
      const walkedIds = pages.flatMap((page) => page.events.map((event) => event.eventId));
      expect(walkedIds).toEqual([...insertedIds].reverse());
      expect(new Set(walkedIds).size).toBe(insertedIds.length);

      // Sequences strictly decrease across the whole walk.
      const sequences = pages.flatMap((page) => page.events.map((event) => event.sequence));
      const sorted = [...sequences].sort((left, right) => right - left);
      expect(sequences).toEqual(sorted);
    }),
  ).pipe(Effect.provide(AnalyticsEventStore.layer)),
);

test(
  "filters by eventName and computes hasNextPage within the filtered set",
  withEventCleanup((track) =>
    Effect.gen(function* () {
      const store = yield* AnalyticsEventStore;
      const nameA = yield* unique("it_page_filter_a");
      const nameB = yield* unique("it_page_filter_b");
      const now = yield* Clock.currentTimeMillis;

      // Interleave the two names so the filter has to skip rows mid-walk.
      const insertedA: string[] = [];
      const insertedB: string[] = [];
      const plan = [nameA, nameB, nameA, nameB, nameA, nameB, nameA];
      for (const name of plan) {
        const eventId = yield* unique("evt_filter");
        track(eventId);
        if (name === nameA) insertedA.push(eventId);
        if (name === nameB) insertedB.push(eventId);
        yield* store.insert([
          makeEvent({ eventId, eventName: name, eventTimestamp: dateAt(now) }),
        ]);
      }

      const pagesA = yield* walkPages(store, { eventNames: [nameA], limit: 3 });
      expect(pagesA.map((page) => page.events.length)).toEqual([3, 1]);
      expect(pagesA.map((page) => page.hasNextPage)).toEqual([true, false]);
      const walkedA = pagesA.flatMap((page) => page.events.map((event) => event.eventId));
      expect(walkedA).toEqual([...insertedA].reverse());
      // No nameB row leaks into the filtered walk.
      expect(walkedA.some((eventId) => insertedB.includes(eventId))).toBe(false);

      const pagesB = yield* walkPages(store, { eventNames: [nameB], limit: 10 });
      expect(pagesB.map((page) => page.events.length)).toEqual([3]);
      expect(pagesB[0]?.hasNextPage).toBe(false);
    }),
  ).pipe(Effect.provide(AnalyticsEventStore.layer)),
);

test(
  "fails with ActionForbiddenError when the cursor row was deleted",
  withEventCleanup((track) =>
    Effect.gen(function* () {
      const store = yield* AnalyticsEventStore;
      const db = yield* Db;
      const eventName = yield* unique("it_page_stale");
      const now = yield* Clock.currentTimeMillis;

      const keptId = yield* unique("evt_stale_kept");
      track(keptId);
      const deletedId = yield* unique("evt_stale_deleted");
      track(deletedId);
      yield* store.insert([
        makeEvent({ eventId: keptId, eventName, eventTimestamp: dateAt(now) }),
        makeEvent({ eventId: deletedId, eventName, eventTimestamp: dateAt(now) }),
      ]);

      // A cursor naming a live row still works…
      const livePage = yield* store.listPage({
        afterEventId: deletedId,
        eventNames: [eventName],
        projectIds: [projectId],
      });
      expect(livePage.events.map((event) => event.eventId)).toEqual([keptId]);

      // …but once the row is gone the cursor must fail loudly instead of
      // replaying page one forever.
      yield* db.delete(analyticsEvents).where(inArray(analyticsEvents.eventId, [deletedId]));
      const error = yield* Effect.flip(
        store.listPage({
          afterEventId: deletedId,
          eventNames: [eventName],
          projectIds: [projectId],
        }),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
      if (error instanceof ActionForbiddenError) {
        expect(error.message).toBe("Pagination cursor no longer refers to a known item.");
      }
    }),
  ).pipe(Effect.provide(AnalyticsEventStore.layer)),
);

test(
  "serves the PostgreSQL page through the shared analytics service port",
  withEventCleanup((track) =>
    Effect.gen(function* () {
      const store = yield* AnalyticsEventStore;
      const analytics = yield* AnalyticsService;
      const eventName = yield* unique("it_service_page");
      const ignoredName = yield* unique("it_service_page_ignored");
      const now = yield* Clock.currentTimeMillis;
      const expectedIds: string[] = [];

      for (const name of [eventName, ignoredName, eventName]) {
        const eventId = yield* unique("evt_service_page");
        track(eventId);
        if (name === eventName) expectedIds.push(eventId);
        yield* store.insert([makeEvent({ eventId, eventName: name, eventTimestamp: dateAt(now) })]);
      }

      const page = yield* analytics.listEventsPage({
        eventName,
        limit: 10,
        projectId,
      });
      expect(page.hasNextPage).toBe(false);
      expect(page.events.map((event) => event.eventId)).toEqual([...expectedIds].reverse());
      expect(page.events.every((event) => event.eventName === eventName)).toBe(true);
    }),
  ).pipe(Effect.provide(analyticsReadLayer), CoreAuthSession.authenticate()),
);
