/**
 * Integration tests for the ClickHouse analytics data accessor
 * ({@link analyticsAccessor} / the 12 named metric helpers), run against the
 * real ClickHouse provisioned once by `test/_testing/globalSetup.ts`.
 *
 * The accessor is a plain object of pure-SQL query builders — there is no
 * service layer to provide. Each helper only requires the
 * {@link ClickhouseWebClient} infrastructure service, which the harness already
 * supplies (bound to the analytics database's *read-write* user, so a test can
 * both seed and assert).
 *
 * Each test seeds deterministic rows into the real `events_v2` table via
 * `ClickhouseWebClient.insertQuery`, runs a metric over a tight, uniquely-namespaced
 * time window, and asserts the aggregated `AnalyticsDataPoint[]` the helper
 * returns. Conventions:
 *  - Every seeded row carries a per-test unique `event_id` prefix and a fresh
 *    `distinct_id`, and queries use a narrow `[start, end]` window so a metric
 *    only ever sees this test's rows. Assertions stay value/membership-based.
 *  - Rows are scoped to the shared fixture container
 *    (`organization_id = it_org`, `project_id = it_project`) so they match the
 *    accessor's `project_ids` WHERE clause (and the tenant setting, were RLS
 *    active).
 *  - {@link withEventCleanup} lightweight-`DELETE`s every seeded row on exit,
 *    success or failure, via `Effect.ensuring`; the global sweep does not touch
 *    ClickHouse, so this is the only cleanup.
 *
 * NOTE on tenant isolation: the harness binds the ClickHouse *read-write* user,
 * which is not subject to the readonly role's row policy. The `SQL_organization_id`
 * setting the accessor passes is therefore inert here, so org-level RLS
 * enforcement cannot be observed in-process — that path is recorded as a
 * `test.todo` below. Project scoping (an explicit `project_id IN (...)` WHERE
 * clause) IS exercised by every test.
 */
import { Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import type {
  AnalyticsDataPoint,
  CompiledAnalyticsFilter,
  TimeGranularity,
  TimeRangeParams,
} from "@voidhash/core/domain/analytics/Analytics";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

import {
  type AnalyticsQueryInput,
  analyticsAccessor,
  getEventFunnelBreakdownCounts,
  getEventFunnelCounts,
  getEventLifecyclePoints,
  getEventPathLinks,
  getEventPersonDrilldown,
  getEventRetentionCohorts,
  getEventStickinessBuckets,
  getEventTrendSeries,
} from "../../../src/services/analytics/clickhouse-accessor.ts";

const { test } = CoreIntegrationTestHarness.make();

// Per-test synthetic project id: each metric seeds and queries `events_v2` over a
// fixed 2021 window. ClickHouse `DELETE` cleanup is eventual and the global
// teardown never sweeps ClickHouse, so a shared project would let a sibling test's
// (or a prior run's) un-deleted rows in the same window bleed into the count.
// `track` (below) sets this to the test's unique namespace before it seeds, so
// every test reads ONLY its own rows regardless of cleanup timing. These reads
// never join MySQL, so the id need not exist there.
let currentProjectId: string = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

const EVENTS_TABLE = "events_v2";

/** Monotonic counter so namespaces stay unique even within the same millisecond. */
let seq = 0;
/** A unique token used to prefix every `event_id`/`distinct_id` a test seeds. */
const uniqueNs = (label: string) => `it-cha-${label}-${Date.now()}-${seq++}`;

/** Format a JS `Date` as the `YYYY-MM-DD HH:MM:SS.mmm` string ClickHouse stores. */
const toEventTs = (date: Date): string => date.toISOString().replace("T", " ").replace("Z", "");

/** A single row to seed into `events_v2`. Omitted columns default in JSONEachRow. */
interface SeedEvent {
  readonly eventName: string;
  readonly eventTs: Date;
  readonly distinctId: string;
  readonly personId?: string;
  readonly properties?: Record<string, unknown>;
  /**
   * Override the auto-derived `${ns}-${index}` event_id — used to seed two rows
   * that share an event_id (a duplicate / redelivery) for the read-side dedup
   * tests. Keep it `${ns}-`-prefixed so `deleteSeeded` still cleans it up.
   */
  readonly eventId?: string;
  /** Latest-wins dedup ordering key (`processed_ts`); defaults to `eventTs`. */
  readonly processedTs?: Date;
}

/**
 * A small fixed time window every metric runs over, plus a base instant inside
 * it. Far enough in the past that no real ingest collides with the window, and
 * narrow enough that only this test's seeded rows fall inside it.
 */
const startDate = new Date("2021-01-01T00:00:00.000Z");
const endDate = new Date("2021-01-31T23:59:59.000Z");
const baseTs = new Date("2021-01-15T12:00:00.000Z");

const timeRange = (granularity: TimeGranularity = "day"): TimeRangeParams => ({
  endDate,
  granularity,
  startDate,
});

const filtersFor = (overrides: Partial<CompiledAnalyticsFilter> = {}): CompiledAnalyticsFilter => ({
  projectIds: [currentProjectId],
  ...overrides,
});

const queryInput = (overrides: Partial<AnalyticsQueryInput> = {}): AnalyticsQueryInput => ({
  filters: filtersFor(overrides.filters),
  organizationId,
  params: overrides.params ?? timeRange(),
});

/** Seed rows into the real `events_v2`, namespacing `event_id` with `ns`. */
const seedEvents = (ns: string, events: ReadonlyArray<SeedEvent>) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const values = events.map((event, index) => ({
      event_id: event.eventId ?? `${ns}-${index}`,
      event_name: event.eventName,
      event_ts: toEventTs(event.eventTs),
      processed_ts: toEventTs(event.processedTs ?? event.eventTs),
      organization_id: organizationId,
      project_id: ns,
      distinct_id: event.distinctId,
      person_id: event.personId ?? null,
      event_properties: JSON.stringify(event.properties ?? {}),
    }));
    yield* ch.insertQuery({ table: EVENTS_TABLE, values }).pipe(Effect.asVoid);
    // `events_v2` is a MergeTree; reads see inserted parts immediately, but be
    // explicit so the very next SELECT is fully consistent under the RW user.
    yield* ch`SELECT count() FROM ${ch.literal(EVENTS_TABLE)} WHERE event_id LIKE ${ch.param("String", `${ns}-%`)}`;
  });

/** Lightweight-delete every row a test seeded under `ns`. */
const deleteSeeded = (ns: string) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    yield* ch
      .asCommand(
        ch`DELETE FROM ${ch.literal(EVENTS_TABLE)} WHERE event_id LIKE ${ch.param("String", `${ns}-%`)}`,
      )
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every event-namespace it seeds is deleted afterward,
 * regardless of how the body exits. The body registers each namespace via the
 * `track` callback; cleanup reads the collected list lazily at finalization.
 */
const withEventCleanup = <E, R>(
  body: (track: (ns: string) => string) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | ClickhouseWebClient.ClickhouseWebClient> => {
  const namespaces: string[] = [];
  const track = (ns: string) => {
    namespaces.push(ns);
    // Scope this test's seeds and reads to its own project id (see currentProjectId).
    currentProjectId = ns;
    return ns;
  };
  return body(track).pipe(
    Effect.ensuring(Effect.forEach(namespaces, deleteSeeded, { discard: true })),
  );
};

/** Sum of all data-point values returned by a metric. */
const totalOf = (points: ReadonlyArray<AnalyticsDataPoint>): number =>
  points.reduce((sum, point) => sum + point.value, 0);

describe("analyticsAccessor.getRevenue", () => {
  test(
    "sums amount across purchase/subscription events and converts cents to dollars",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("revenue"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 1000 },
          },
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 500 },
          },
          // FX-less row: only the raw original-currency `amount` is present (no
          // `amount_usd`). USD revenue must NOT fall back to it — summing e.g.
          // £2.50 as $2.50 is a silent miscount — so this row contributes 0.
          {
            eventName: "$subscription.renewed",
            eventTs: baseTs,
            distinctId,
            properties: { amount: 250 },
          },
          // Event outside the metric's event-name set is ignored.
          {
            eventName: "$subscription.canceled",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 9999 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(queryInput());
        // (1000 + 500) cents -> 15 dollars; the FX-less `amount`-only row is excluded.
        expect(totalOf(points)).toBeCloseTo(15, 5);
        for (const point of points) {
          expect(point.timestamp).toBeInstanceOf(Date);
          expect(Number.isNaN(point.timestamp.getTime())).toBe(false);
        }
      }),
    ),
  );

  test(
    "returns an empty array (not null) when no events fall in the window",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("revenue-empty"));
        // Seed a row OUTSIDE the queried window so nothing matches.
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: new Date("2019-06-01T00:00:00.000Z"),
            distinctId: `${ns}-u`,
            properties: { amount_usd: 1000 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(queryInput());
        expect(Array.isArray(points)).toBe(true);
        expect(points).toEqual([]);
      }),
    ),
  );

  test(
    "honours a non-matching project filter and returns nothing",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("revenue-project"));
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId: `${ns}-u`,
            properties: { amount_usd: 4200 },
          },
        ]);

        // Filter on a project the seeded rows do not belong to.
        const points = yield* analyticsAccessor.getRevenue(
          queryInput({ filters: { projectIds: ["it_project_absent"] } }),
        );
        expect(points).toEqual([]);
      }),
    ),
  );
});

describe("analyticsAccessor.getMRR", () => {
  test(
    "sums subscription revenue but excludes trial subscriptions",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("mrr"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 999, is_trial: false },
          },
          {
            eventName: "$subscription.renewed",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 999, is_trial: false },
          },
          // Trial subscription is excluded by the is_trial = 0 guard.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 1500, is_trial: true },
          },
          // Purchase events are not part of the MRR event set.
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 7777 },
          },
        ]);

        const points = yield* analyticsAccessor.getMRR(queryInput());
        // (999 + 999) cents -> 19.98 dollars; trial + purchase excluded.
        expect(totalOf(points)).toBeCloseTo(19.98, 5);
      }),
    ),
  );
});

describe("analyticsAccessor.getChurnedRevenue", () => {
  test(
    "sums amount over subscription.canceled and subscription.expired events",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("churned-rev"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.canceled",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 600 },
          },
          {
            eventName: "$subscription.expired",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 400 },
          },
          // Active subscription is not churn.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 9999 },
          },
        ]);

        const points = yield* analyticsAccessor.getChurnedRevenue(queryInput());
        // (600 + 400) cents -> 10 dollars.
        expect(totalOf(points)).toBeCloseTo(10, 5);
      }),
    ),
  );
});

describe("analyticsAccessor.getActiveSubscriptions", () => {
  test(
    "counts distinct non-trial subscription ids",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("active-subs"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-s1`, is_trial: false },
          },
          // Same subscription id seen again -> still one distinct.
          {
            eventName: "$subscription.renewed",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-s1`, is_trial: false },
          },
          {
            eventName: "$subscription.active",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-s2`, is_trial: false },
          },
          // Trial subscription is filtered out by is_trial = 0.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-s3`, is_trial: true },
          },
        ]);

        const points = yield* analyticsAccessor.getActiveSubscriptions(queryInput());
        // s1 + s2 distinct, s3 excluded as trial.
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor.getActiveTrials", () => {
  test(
    "counts distinct trial subscription ids only",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("active-trials"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-t1`, is_trial: true },
          },
          {
            eventName: "$subscription.active",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-t2`, is_trial: true },
          },
          // Non-trial subscription is excluded by is_trial = 1.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-n1`, is_trial: false },
          },
        ]);

        const points = yield* analyticsAccessor.getActiveTrials(queryInput());
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor.getNewSubscriptions", () => {
  test(
    "counts non-trial subscription.created events",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("new-subs"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a`, is_trial: false },
          },
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-b`, is_trial: false },
          },
          // Trial creation excluded by is_trial = 0.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-c`, is_trial: true },
          },
          // Renewal is not a "new" subscription.
          {
            eventName: "$subscription.renewed",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a`, is_trial: false },
          },
        ]);

        const points = yield* analyticsAccessor.getNewSubscriptions(queryInput());
        // count() over the two non-trial creations.
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor.getChurnedSubscriptions", () => {
  test(
    "counts subscription.canceled and subscription.expired events",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("churned-subs"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.canceled",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a` },
          },
          {
            eventName: "$subscription.expired",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-b` },
          },
          {
            eventName: "$subscription.expired",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-c` },
          },
          // Active subscription is not churn.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-d` },
          },
        ]);

        const points = yield* analyticsAccessor.getChurnedSubscriptions(queryInput());
        // count() over the three cancel/expire events.
        expect(totalOf(points)).toBe(3);
      }),
    ),
  );
});

describe("analyticsAccessor.getTrials", () => {
  test(
    "counts trial subscription.created events",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("trials"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a`, is_trial: true },
          },
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-b`, is_trial: true },
          },
          // Non-trial creation excluded by is_trial = 1.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-c`, is_trial: false },
          },
        ]);

        const points = yield* analyticsAccessor.getTrials(queryInput());
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor.getTrialConversions", () => {
  test(
    "counts distinct subscription ids flagged converted_from_trial",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("trial-conv"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a`, converted_from_trial: true },
          },
          // Same subscription id repeated -> still one distinct.
          {
            eventName: "$subscription.renewed",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-a`, converted_from_trial: true },
          },
          {
            eventName: "$subscription.active",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-b`, converted_from_trial: true },
          },
          // Not converted -> excluded by converted_from_trial = 1.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { subscription_id: `${ns}-c`, converted_from_trial: false },
          },
        ]);

        const points = yield* analyticsAccessor.getTrialConversions(queryInput());
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor.getPersonCount", () => {
  // Regression guard for the empty-string key collapse: with no pending-override
  // match the effective-person key must fall through to each event's own
  // person_id (the source `nullIf(overrides.col, '')` turns the unmatched join's
  // '' back into NULL), so distinct persons stay distinct instead of collapsing
  // into a single '' group.
  test(
    "counts distinct effective persons appearing up to the window end",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("person-count"));
        yield* seedEvents(ns, [
          { eventName: "$pageview", eventTs: baseTs, distinctId: `${ns}-d1`, personId: `${ns}-p1` },
          { eventName: "$pageview", eventTs: baseTs, distinctId: `${ns}-d2`, personId: `${ns}-p2` },
          { eventName: "$pageview", eventTs: baseTs, distinctId: `${ns}-d3`, personId: `${ns}-p3` },
          // Same person seen again -> still one distinct person, not double-counted.
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId: `${ns}-d3`,
            personId: `${ns}-p3`,
          },
        ]);

        const points = yield* analyticsAccessor.getPersonCount(queryInput());
        // Three distinct persons (p1, p2, p3); the repeated p3 event folds in.
        expect(totalOf(points)).toBe(3);
      }),
    ),
  );
});

describe("analyticsAccessor.getNewPersons", () => {
  test(
    "counts only persons first seen inside the window",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("new-persons"));
        const beforeWindow = new Date("2020-06-01T00:00:00.000Z");
        yield* seedEvents(ns, [
          // Person A's earliest event is BEFORE the window, so min(event_ts) is
          // 2020 and the `first_seen >= start` filter excludes it.
          {
            eventName: "$pageview",
            eventTs: beforeWindow,
            distinctId: `${ns}-dA`,
            personId: `${ns}-pA`,
          },
          { eventName: "$pageview", eventTs: baseTs, distinctId: `${ns}-dA`, personId: `${ns}-pA` },
          // Person B is first seen inside the window.
          { eventName: "$pageview", eventTs: baseTs, distinctId: `${ns}-dB`, personId: `${ns}-pB` },
        ]);

        const points = yield* analyticsAccessor.getNewPersons(queryInput());
        // Only person B is "new" in [start, end]; person A leaked in from 2020.
        expect(totalOf(points)).toBe(1);
      }),
    ),
  );
});

describe("analyticsAccessor.getPayingPersonCount", () => {
  test(
    "counts distinct persons with a positive-amount purchase or subscription",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("paying-persons"));
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId: `${ns}-dA`,
            personId: `${ns}-pA`,
            properties: { amount_usd: 1000 },
          },
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId: `${ns}-dB`,
            personId: `${ns}-pB`,
            properties: { amount_usd: 500 },
          },
          // Person C's only paying-eligible event has a zero amount, so the
          // `amount > 0` guard drops it and C does not count.
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId: `${ns}-dC`,
            personId: `${ns}-pC`,
            properties: { amount_usd: 0 },
          },
        ]);

        const points = yield* analyticsAccessor.getPayingPersonCount(queryInput());
        // Persons A and B paid; person C's zero-amount row is excluded.
        expect(totalOf(points)).toBe(2);
      }),
    ),
  );
});

describe("analyticsAccessor — granularity & period normalisation", () => {
  test(
    "buckets revenue per day and normalises each period string to a Date",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("granularity-day"));
        const distinctId = `${ns}-u`;
        const dayA = new Date("2021-01-10T08:00:00.000Z");
        const dayB = new Date("2021-01-20T20:00:00.000Z");
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: dayA,
            distinctId,
            properties: { amount_usd: 1000 },
          },
          // Same day, different hour -> folds into the same day bucket.
          {
            eventName: "$purchase.completed",
            eventTs: new Date("2021-01-10T18:00:00.000Z"),
            distinctId,
            properties: { amount_usd: 500 },
          },
          {
            eventName: "$purchase.completed",
            eventTs: dayB,
            distinctId,
            properties: { amount_usd: 700 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(queryInput());
        // Two distinct day buckets, ordered ascending by period.
        expect(points.length).toBe(2);
        expect(points[0]?.timestamp.getTime()).toBeLessThan(points[1]?.timestamp.getTime() ?? 0);
        // Day buckets normalise to UTC midnight Dates.
        const isoDays = points.map((point) => point.timestamp.toISOString().slice(0, 10));
        expect(isoDays).toContain("2021-01-10");
        expect(isoDays).toContain("2021-01-20");
        // Day A bucket = (1000 + 500) cents -> 15 dollars.
        const dayAPoint = points.find(
          (point) => point.timestamp.toISOString().slice(0, 10) === "2021-01-10",
        );
        expect(dayAPoint?.value).toBeCloseTo(15, 5);
      }),
    ),
  );

  test(
    "month granularity collapses events across the window into one bucket",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("granularity-month"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: new Date("2021-01-05T00:00:00.000Z"),
            distinctId,
            properties: { amount_usd: 1000 },
          },
          {
            eventName: "$purchase.completed",
            eventTs: new Date("2021-01-25T00:00:00.000Z"),
            distinctId,
            properties: { amount_usd: 1000 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(
          queryInput({ params: timeRange("month") }),
        );
        // All January events fold into a single month bucket = 20 dollars.
        expect(points.length).toBe(1);
        expect(points[0]?.timestamp.toISOString().slice(0, 10)).toBe("2021-01-01");
        expect(points[0]?.value).toBeCloseTo(20, 5);
      }),
    ),
  );
});

describe("analyticsAccessor — compiled filter constraints", () => {
  test(
    "getRevenue applies the product_ids IN filter from CompiledAnalyticsFilter",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("filter-product"));
        const distinctId = `${ns}-u`;
        const keptProduct = `${ns}-prod-keep`;
        yield* seedEvents(ns, [
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 1000, product_id: keptProduct },
          },
          // Different product -> excluded by the product filter.
          {
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 9999, product_id: `${ns}-prod-other` },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(
          queryInput({ filters: { projectIds: [ns], productIds: [keptProduct] } }),
        );
        // Only the kept product's 1000 cents -> 10 dollars.
        expect(totalOf(points)).toBeCloseTo(10, 5);
      }),
    ),
  );

  test(
    "getRevenue applies the subscription_status IN filter",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("filter-status"));
        const distinctId = `${ns}-u`;
        yield* seedEvents(ns, [
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 1000, subscription_status: 1 },
          },
          // Different status -> excluded.
          {
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            properties: { amount_usd: 9999, subscription_status: 2 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(
          queryInput({ filters: { projectIds: [ns], subscriptionStatuses: [1] } }),
        );
        // Only status 1's 1000 cents -> 10 dollars.
        expect(totalOf(points)).toBeCloseTo(10, 5);
      }),
    ),
  );
});

describe("analyticsAccessor — read-side dedup by event_id (latest processed_ts wins)", () => {
  test(
    "collapses duplicate rows sharing an event_id and keeps the newest processed_ts",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("dedup-revenue"));
        const distinctId = `${ns}-u`;
        const dupId = `${ns}-dup`;
        yield* seedEvents(ns, [
          // Original write of the event.
          {
            eventId: dupId,
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            processedTs: new Date("2021-01-15T12:00:00.000Z"),
            properties: { amount_usd: 1000 },
          },
          // A redelivery / replay of the SAME event_id with a later processed_ts
          // and a corrected amount. The MergeTree keeps both rows; read-side
          // latest-wins dedup must keep ONLY this one.
          {
            eventId: dupId,
            eventName: "$purchase.completed",
            eventTs: baseTs,
            distinctId,
            processedTs: new Date("2021-01-16T12:00:00.000Z"),
            properties: { amount_usd: 1500 },
          },
        ]);

        const points = yield* analyticsAccessor.getRevenue(queryInput());
        // Counted once, and the newer processed_ts (1500 cents) wins -> 15 dollars
        // (NOT 25, which is what summing both un-deduped rows would give).
        expect(totalOf(points)).toBeCloseTo(15, 5);
      }),
    ),
  );

  test(
    "a count() metric counts a duplicated event_id once, not twice",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("dedup-count"));
        const distinctId = `${ns}-u`;
        const dupId = `${ns}-c`;
        yield* seedEvents(ns, [
          {
            eventId: dupId,
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            processedTs: new Date("2021-01-15T12:00:00.000Z"),
            properties: { subscription_id: `${ns}-s`, is_trial: false },
          },
          // Same event_id written twice (a race / retry) -> count() must see one.
          {
            eventId: dupId,
            eventName: "$subscription.created",
            eventTs: baseTs,
            distinctId,
            processedTs: new Date("2021-01-16T12:00:00.000Z"),
            properties: { subscription_id: `${ns}-s`, is_trial: false },
          },
        ]);

        const points = yield* analyticsAccessor.getNewSubscriptions(queryInput());
        expect(totalOf(points)).toBe(1);
      }),
    ),
  );
});

describe("getEventTrendSeries", () => {
  test(
    "aggregates total events and unique users across the full range for number charts",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-trends-total"));
        yield* seedEvents(ns, [
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-15T12:00:00.000Z"),
            distinctId: `${ns}-one`,
            properties: { duration_ms: 10 },
          },
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-16T12:00:00.000Z"),
            distinctId: `${ns}-one`,
            properties: { duration_ms: 30 },
          },
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-17T12:00:00.000Z"),
            distinctId: `${ns}-one`,
          },
        ]);
        const input = {
          aggregateOverRange: true,
          eventNames: ["screen_viewed"],
          filters: filtersFor(),
          organizationId,
          params: { endDate, granularity: "day" as const, startDate },
        };

        const totals = yield* getEventTrendSeries({ ...input, aggregation: "total_events" });
        const uniqueUsers = yield* getEventTrendSeries({
          ...input,
          aggregation: "unique_users",
        });
        const propertySum = yield* getEventTrendSeries({
          ...input,
          aggregation: "property_sum",
          mathProperty: "duration_ms",
        });
        const propertyAverage = yield* getEventTrendSeries({
          ...input,
          aggregation: "property_average",
          mathProperty: "duration_ms",
        });

        expect(totals[0]?.points.map((point) => point.value)).toEqual([3]);
        expect(uniqueUsers[0]?.points.map((point) => point.value)).toEqual([1]);
        expect(propertySum[0]?.points.map((point) => point.value)).toEqual([40]);
        expect(propertyAverage[0]?.points.map((point) => point.value)).toEqual([20]);
      }),
    ),
  );

  test(
    "counts unique group actors and applies person-cohort scope before aggregation",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-trends-groups"));
        yield* seedEvents(ns, [
          {
            eventName: "opened",
            eventTs: new Date("2021-01-15T12:00:00.000Z"),
            distinctId: `${ns}-one-distinct`,
            personId: `${ns}-one`,
            properties: { account_id: "account-a" },
          },
          {
            eventName: "opened",
            eventTs: new Date("2021-01-16T12:00:00.000Z"),
            distinctId: `${ns}-two-distinct`,
            personId: `${ns}-two`,
            properties: { account_id: "account-a" },
          },
          {
            eventName: "opened",
            eventTs: new Date("2021-01-17T12:00:00.000Z"),
            distinctId: `${ns}-three-distinct`,
            personId: `${ns}-three`,
            properties: { account_id: "account-b" },
          },
        ]);
        const input = {
          actor: { kind: "group" as const, property: "account_id" },
          aggregateOverRange: true,
          aggregation: "unique_users" as const,
          eventNames: ["opened"],
          filters: filtersFor(),
          organizationId,
          params: { endDate, granularity: "day" as const, startDate },
        };

        const allGroups = yield* getEventTrendSeries(input);
        const cohortGroups = yield* getEventTrendSeries({
          ...input,
          cohortPersonIds: [`${ns}-one`, `${ns}-two`],
        });

        expect(allGroups[0]?.points[0]?.value).toBe(2);
        expect(cohortGroups[0]?.points[0]?.value).toBe(1);
      }),
    ),
  );
});

describe("getEventPersonDrilldown", () => {
  test(
    "returns identified people scoped by cohort membership and group property",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-person-drilldown"));
        yield* seedEvents(ns, [
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-15T12:00:00.000Z"),
            distinctId: `${ns}-one-distinct`,
            personId: `${ns}-one`,
            properties: { workspace_id: "mobile" },
          },
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-16T12:00:00.000Z"),
            distinctId: `${ns}-one-distinct`,
            personId: `${ns}-one`,
            properties: { workspace_id: "mobile" },
          },
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-17T12:00:00.000Z"),
            distinctId: `${ns}-two-distinct`,
            personId: `${ns}-two`,
            properties: { workspace_id: "web" },
          },
          {
            eventName: "screen_viewed",
            eventTs: new Date("2021-01-18T12:00:00.000Z"),
            distinctId: `${ns}-three-distinct`,
            personId: `${ns}-three`,
            properties: { workspace_id: "mobile" },
          },
        ]);

        const people = yield* getEventPersonDrilldown({
          cohortPersonIds: [`${ns}-one`, `${ns}-two`],
          eventNames: ["screen_viewed"],
          group: { property: "workspace_id", value: "mobile" },
          limit: 50,
          organizationId,
          params: { endDate, startDate },
          projectId: ns,
        });

        expect(people).toEqual([
          {
            eventCount: 2,
            lastSeenAt: new Date("2021-01-16T12:00:00.000Z"),
            personId: `${ns}-one`,
          },
        ]);
      }),
    ),
  );
});

describe("getEventFunnelCounts", () => {
  test(
    "distinguishes sequential, strict-adjacency, and any-order funnels",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-funnel-orders"));
        const at = (seconds: number) => new Date(baseTs.getTime() + seconds * 1000);
        yield* seedEvents(ns, [
          {
            eventName: "step_a",
            eventTs: at(1),
            distinctId: `${ns}-sequential`,
            properties: { platform: "ios" },
          },
          { eventName: "unrelated", eventTs: at(2), distinctId: `${ns}-sequential` },
          { eventName: "step_b", eventTs: at(3), distinctId: `${ns}-sequential` },
          {
            eventName: "step_a",
            eventTs: at(4),
            distinctId: `${ns}-strict`,
            properties: { platform: "android" },
          },
          { eventName: "step_b", eventTs: at(5), distinctId: `${ns}-strict` },
          { eventName: "step_b", eventTs: at(6), distinctId: `${ns}-reverse` },
          {
            eventName: "step_a",
            eventTs: at(7),
            distinctId: `${ns}-reverse`,
            properties: { platform: "ios" },
          },
        ]);
        const input = {
          conversionWindowSeconds: 3_600,
          filters: filtersFor(),
          organizationId,
          params: { endDate, startDate },
          steps: [
            { eventNames: ["step_a"] as const, key: "A" },
            { eventNames: ["step_b"] as const, key: "B" },
          ] as const,
        };

        const sequential = yield* getEventFunnelCounts({ ...input, order: "sequential" });
        const strict = yield* getEventFunnelCounts({ ...input, order: "strict" });
        const any = yield* getEventFunnelCounts({ ...input, order: "any" });

        expect(sequential).toEqual([3, 2]);
        expect(strict).toEqual([3, 1]);
        expect(any).toEqual([3, 3]);

        const breakdowns = yield* getEventFunnelBreakdownCounts({
          ...input,
          breakdown: { field: "event.properties.platform", limit: 5 },
          breakdownAttributionStep: 1,
          order: "sequential",
        });
        expect(breakdowns).toEqual([
          { breakdownValue: "android", counts: [1, 1] },
          { breakdownValue: "ios", counts: [2, 1] },
        ]);
      }),
    ),
  );
});

describe("getEventRetentionCohorts", () => {
  test(
    "distinguishes recurring and first-time cohorts and keeps rolling counts unique",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-retention"));
        const day = (offset: number, hour = 12) =>
          new Date(
            `2021-01-${String(15 + offset).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
          );
        yield* seedEvents(ns, [
          { eventName: "activated", eventTs: day(0), distinctId: `${ns}-one` },
          { eventName: "activated", eventTs: day(1), distinctId: `${ns}-one` },
          { eventName: "opened", eventTs: day(1, 14), distinctId: `${ns}-one` },
          { eventName: "opened", eventTs: day(3), distinctId: `${ns}-one` },
          { eventName: "activated", eventTs: day(0), distinctId: `${ns}-two` },
          { eventName: "opened", eventTs: day(2), distinctId: `${ns}-two` },
          { eventName: "activated", eventTs: day(1), distinctId: `${ns}-three` },
          { eventName: "opened", eventTs: day(3), distinctId: `${ns}-three` },
        ]);
        const input = {
          cumulative: false,
          filters: filtersFor(),
          intervals: 4,
          organizationId,
          params: { endDate, startDate },
          period: "day" as const,
          returning: {
            aggregation: "unique_users" as const,
            eventNames: ["opened"] as const,
            key: "returning",
          },
          start: {
            aggregation: "unique_users" as const,
            eventNames: ["activated"] as const,
            key: "start",
          },
        };

        const recurring = yield* getEventRetentionCohorts({
          ...input,
          retentionType: "recurring",
        });
        const firstTime = yield* getEventRetentionCohorts({
          ...input,
          retentionType: "first_time",
        });
        const rolling = yield* getEventRetentionCohorts({
          ...input,
          cumulative: true,
          retentionType: "first_time",
        });

        expect(recurring.map((cohort) => [cohort.cohortSize, cohort.counts])).toEqual([
          [2, [0, 1, 1, 1]],
          [2, [1, 0, 2, 0]],
        ]);
        expect(firstTime.map((cohort) => [cohort.cohortSize, cohort.counts])).toEqual([
          [2, [0, 1, 1, 1]],
          [1, [0, 0, 1, 0]],
        ]);
        expect(rolling[0]?.counts).toEqual([0, 2, 2, 1]);
      }),
    ),
  );
});

describe("getEventLifecyclePoints", () => {
  test(
    "classifies new, returning, resurrecting, and dormant identities by period",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-lifecycle"));
        const day = (offset: number, hour = 12) =>
          new Date(
            `2021-01-${String(15 + offset).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
          );
        yield* seedEvents(ns, [
          {
            eventName: "opened",
            eventTs: day(0),
            distinctId: `${ns}-returning`,
            personId: `${ns}-returning-person`,
          },
          {
            eventName: "opened",
            eventTs: day(1),
            distinctId: `${ns}-returning`,
            personId: `${ns}-returning-person`,
          },
          {
            eventName: "installed",
            eventTs: day(-2),
            distinctId: `${ns}-existing`,
            personId: `${ns}-existing-person`,
          },
          {
            eventName: "opened",
            eventTs: day(0),
            distinctId: `${ns}-existing`,
            personId: `${ns}-existing-person`,
          },
          {
            eventName: "opened",
            eventTs: day(0),
            distinctId: `${ns}-gap`,
            personId: `${ns}-gap-person`,
          },
          {
            eventName: "opened",
            eventTs: day(2),
            distinctId: `${ns}-gap`,
            personId: `${ns}-gap-person`,
          },
          { eventName: "opened", eventTs: day(0), distinctId: `vh:anon:${ns}` },
        ]);

        const points = yield* getEventLifecyclePoints({
          filters: filtersFor(),
          granularity: "day",
          organizationId,
          params: { endDate: day(3, 23), startDate: day(0, 0) },
          series: {
            aggregation: "unique_users",
            eventNames: ["opened"],
            key: "A",
          },
        });

        expect(
          points.map((point) => [
            point.timestamp.toISOString().slice(0, 10),
            point.status,
            point.count,
          ]),
        ).toEqual([
          ["2021-01-15", "new", 2],
          ["2021-01-15", "resurrecting", 1],
          ["2021-01-16", "dormant", 2],
          ["2021-01-16", "returning", 1],
          ["2021-01-17", "dormant", 1],
          ["2021-01-17", "resurrecting", 1],
          ["2021-01-18", "dormant", 1],
        ]);
      }),
    ),
  );
});

describe("getEventPathLinks", () => {
  test(
    "counts adjacent session transitions, collapses repeats, and maps mobile screen names",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-paths"));
        const at = (minutes: number) => new Date(baseTs.getTime() + minutes * 60_000);
        yield* seedEvents(ns, [
          { eventName: "home", eventTs: at(0), distinctId: `${ns}-one` },
          { eventName: "home", eventTs: at(1), distinctId: `${ns}-one` },
          { eventName: "search", eventTs: at(2), distinctId: `${ns}-one` },
          { eventName: "purchase", eventTs: at(3), distinctId: `${ns}-one` },
          { eventName: "settings", eventTs: at(34), distinctId: `${ns}-one` },
          { eventName: "home", eventTs: at(0), distinctId: `${ns}-two` },
          { eventName: "search", eventTs: at(4), distinctId: `${ns}-two` },
          { eventName: "purchase", eventTs: at(5), distinctId: `${ns}-two` },
          {
            eventName: "$screen",
            eventTs: at(10),
            distinctId: `${ns}-screen`,
            properties: { $screen_name: "Welcome" },
          },
          {
            eventName: "$screen",
            eventTs: at(11),
            distinctId: `${ns}-screen`,
            properties: { $screen_name: "Paywall" },
          },
          {
            eventName: "$screen",
            eventTs: at(12),
            distinctId: `${ns}-screen`,
            properties: { $screen_name: "Done" },
          },
          { eventName: "long_home", eventTs: at(15), distinctId: `${ns}-long` },
          { eventName: "long_middle_a", eventTs: at(16), distinctId: `${ns}-long` },
          { eventName: "long_middle_b", eventTs: at(17), distinctId: `${ns}-long` },
          { eventName: "long_purchase", eventTs: at(18), distinctId: `${ns}-long` },
        ]);

        const eventLinks = yield* getEventPathLinks({
          definition: {
            collapseRepeated: true,
            eventNames: ["home", "search", "purchase", "settings"],
            kind: "paths",
            maxDepth: 5,
            sessionGapSeconds: 1_800,
            timeRange: { preset: "last_30d" },
          },
          filters: filtersFor(),
          organizationId,
          params: { endDate, startDate },
        });
        const screenLinks = yield* getEventPathLinks({
          definition: {
            eventNames: ["$screen"],
            kind: "paths",
            maxDepth: 5,
            pathItem: "screen_name",
            timeRange: { preset: "last_30d" },
          },
          filters: filtersFor(),
          organizationId,
          params: { endDate, startDate },
        });
        const screenLinksWithExclusion = yield* getEventPathLinks({
          definition: {
            eventNames: ["$screen"],
            excludeEventNames: ["Paywall"],
            kind: "paths",
            maxDepth: 5,
            pathItem: "screen_name",
            timeRange: { preset: "last_30d" },
          },
          filters: filtersFor(),
          organizationId,
          params: { endDate, startDate },
        });
        const collapsedEndpointLinks = yield* getEventPathLinks({
          definition: {
            endEventName: "long_purchase",
            eventNames: ["long_home", "long_middle_a", "long_middle_b", "long_purchase"],
            kind: "paths",
            maxDepth: 3,
            startEventName: "long_home",
            timeRange: { preset: "last_30d" },
          },
          filters: filtersFor(),
          organizationId,
          params: { endDate, startDate },
        });

        expect(eventLinks).toEqual([
          {
            averageTransitionSeconds: 180,
            count: 2,
            source: "home",
            sourceStep: 1,
            target: "search",
            targetStep: 2,
          },
          {
            averageTransitionSeconds: 60,
            count: 2,
            source: "search",
            sourceStep: 2,
            target: "purchase",
            targetStep: 3,
          },
        ]);
        expect(screenLinks).toEqual([
          {
            averageTransitionSeconds: 60,
            count: 1,
            source: "Welcome",
            sourceStep: 1,
            target: "Paywall",
            targetStep: 2,
          },
          {
            averageTransitionSeconds: 60,
            count: 1,
            source: "Paywall",
            sourceStep: 2,
            target: "Done",
            targetStep: 3,
          },
        ]);
        expect(screenLinksWithExclusion).toEqual([
          {
            averageTransitionSeconds: 120,
            count: 1,
            source: "Welcome",
            sourceStep: 1,
            target: "Done",
            targetStep: 2,
          },
        ]);
        expect(collapsedEndpointLinks.map((link) => [link.source, link.target])).toEqual([
          ["long_home", "…"],
          ["…", "long_purchase"],
        ]);
      }),
    ),
  );
});

describe("getEventStickinessBuckets", () => {
  test(
    "stitches identities and applies minimum event occurrences inside each interval",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-stickiness"));
        const activeAt = (dayOffset: number, hour: number) =>
          new Date(
            `2021-01-${String(15 + dayOffset).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
          );
        yield* seedEvents(ns, [
          { eventName: "opened", eventTs: activeAt(0, 9), distinctId: `${ns}-three-days` },
          { eventName: "opened", eventTs: activeAt(0, 12), distinctId: `${ns}-three-days` },
          { eventName: "opened", eventTs: activeAt(1, 9), distinctId: `${ns}-three-days` },
          { eventName: "opened", eventTs: activeAt(2, 9), distinctId: `${ns}-three-days` },
          { eventName: "opened", eventTs: activeAt(0, 10), distinctId: `${ns}-two-days` },
          { eventName: "opened", eventTs: activeAt(2, 10), distinctId: `${ns}-two-days` },
          { eventName: "opened", eventTs: activeAt(1, 11), distinctId: `${ns}-one-day` },
          {
            eventName: "opened",
            eventTs: activeAt(0, 14),
            distinctId: `${ns}-stitched-a`,
            personId: `${ns}-stitched-person`,
          },
          {
            eventName: "opened",
            eventTs: activeAt(1, 14),
            distinctId: `${ns}-stitched-b`,
            personId: `${ns}-stitched-person`,
          },
        ]);
        const input = {
          filters: filtersFor(),
          interval: "day" as const,
          organizationId,
          params: { endDate, startDate },
          series: {
            aggregation: "unique_users" as const,
            eventNames: ["opened"] as const,
            key: "A",
          },
        };

        const all = yield* getEventStickinessBuckets({
          ...input,
          occurrenceCriteria: { operator: "gte", value: 1 },
        });
        const repeated = yield* getEventStickinessBuckets({
          ...input,
          occurrenceCriteria: { operator: "gte", value: 2 },
        });

        expect(all).toEqual([
          { count: 1, intervals: 1 },
          { count: 2, intervals: 2 },
          { count: 1, intervals: 3 },
        ]);
        expect(repeated).toEqual([{ count: 1, intervals: 1 }]);
      }),
    ),
  );
});

describe("custom insight actor scope", () => {
  test(
    "applies group aggregation and person-cohort membership across every behavioral engine",
    withEventCleanup((track) =>
      Effect.gen(function* () {
        const ns = track(uniqueNs("custom-group-cohort-engines"));
        const at = (dayOffset: number, minutes: number) =>
          new Date(Date.UTC(2021, 0, 15 + dayOffset, 9, minutes));
        const personOne = `${ns}-person-one`;
        const personTwo = `${ns}-person-two`;
        const personThree = `${ns}-person-three`;
        const group = (accountId: string) => ({ account_id: accountId });
        yield* seedEvents(ns, [
          {
            distinctId: `${ns}-one`,
            eventName: "funnel_start",
            eventTs: at(0, 0),
            personId: personOne,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-one`,
            eventName: "funnel_finish",
            eventTs: at(0, 1),
            personId: personOne,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "funnel_start",
            eventTs: at(0, 2),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "funnel_finish",
            eventTs: at(0, 3),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-one`,
            eventName: "retention_start",
            eventTs: at(0, 5),
            personId: personOne,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-two`,
            eventName: "retention_return",
            eventTs: at(1, 5),
            personId: personTwo,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "retention_start",
            eventTs: at(0, 6),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "retention_return",
            eventTs: at(1, 6),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-one`,
            eventName: "path_home",
            eventTs: at(0, 10),
            personId: personOne,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-two`,
            eventName: "path_paywall",
            eventTs: at(0, 11),
            personId: personTwo,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "path_home",
            eventTs: at(0, 12),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "path_paywall",
            eventTs: at(0, 13),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-one`,
            eventName: "opened",
            eventTs: at(0, 20),
            personId: personOne,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-two`,
            eventName: "opened",
            eventTs: at(1, 20),
            personId: personTwo,
            properties: group("account-a"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "opened",
            eventTs: at(0, 21),
            personId: personThree,
            properties: group("account-b"),
          },
          {
            distinctId: `${ns}-three`,
            eventName: "opened",
            eventTs: at(1, 21),
            personId: personThree,
            properties: group("account-b"),
          },
        ]);

        const actor = { kind: "group" as const, property: "account_id" };
        const cohortPersonIds = [personOne, personTwo];
        const scope = {
          actor,
          cohortPersonIds,
          filters: filtersFor(),
          organizationId,
        };
        const funnel = yield* getEventFunnelCounts({
          ...scope,
          conversionWindowSeconds: 3_600,
          order: "sequential",
          params: { endDate, startDate },
          steps: [
            { eventNames: ["funnel_start"], key: "A" },
            { eventNames: ["funnel_finish"], key: "B" },
          ],
        });
        const retention = yield* getEventRetentionCohorts({
          ...scope,
          cumulative: false,
          intervals: 3,
          params: { endDate: at(2, 59), startDate: at(0, 0) },
          period: "day",
          retentionType: "recurring",
          returning: {
            aggregation: "unique_users",
            eventNames: ["retention_return"],
            key: "returning",
          },
          start: {
            aggregation: "unique_users",
            eventNames: ["retention_start"],
            key: "start",
          },
        });
        const paths = yield* getEventPathLinks({
          ...scope,
          definition: {
            eventNames: ["path_home", "path_paywall"],
            kind: "paths",
            maxDepth: 3,
            timeRange: { preset: "last_30d" },
          },
          params: { endDate, startDate },
        });
        const stickiness = yield* getEventStickinessBuckets({
          ...scope,
          interval: "day",
          occurrenceCriteria: { operator: "gte", value: 1 },
          params: { endDate, startDate },
          series: {
            aggregation: "unique_users",
            eventNames: ["opened"],
            key: "A",
          },
        });
        const lifecycle = yield* getEventLifecyclePoints({
          ...scope,
          granularity: "day",
          params: { endDate: at(2, 59), startDate: at(0, 0) },
          series: {
            aggregation: "unique_users",
            eventNames: ["opened"],
            key: "A",
          },
        });

        expect(funnel).toEqual([1, 1]);
        expect(retention.map((cohort) => [cohort.cohortSize, cohort.counts])).toEqual([
          [1, [0, 1, 0]],
        ]);
        expect(paths).toEqual([
          {
            averageTransitionSeconds: 60,
            count: 1,
            source: "path_home",
            sourceStep: 1,
            target: "path_paywall",
            targetStep: 2,
          },
        ]);
        expect(stickiness).toEqual([{ count: 1, intervals: 2 }]);
        expect(
          lifecycle.map((point) => [
            point.timestamp.toISOString().slice(0, 10),
            point.status,
            point.count,
          ]),
        ).toEqual([
          ["2021-01-15", "new", 1],
          ["2021-01-16", "returning", 1],
          ["2021-01-17", "dormant", 1],
        ]);
      }),
    ),
  );
});

// Deferred: the harness binds the ClickHouse *read-write* user, which is not
// subject to the readonly role's row policy, so the `SQL_organization_id`
// per-query setting the accessor passes is inert in-process — a row from
// organization A is still visible when querying as organization B. Verifying
// that the tenant row policy fail-closes for the wrong organization requires
// binding the readonly RLS user (and granting only SELECT under the role),
// which the harness does not expose. Project-level scoping (the explicit
// `project_id IN (...)` WHERE clause) is exercised by the tests above.
vitestTest.todo(
  "analyticsAccessor respects organization tenant row policies (needs readonly RLS user, not the harness RW user)",
);
