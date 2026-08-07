/**
 * Pure unit tests for the analytics series resolver. The resolver's only seam
 * is the {@link AnalyticsDataAccessor} (the ClickHouse-backed query layer),
 * which is faked here with canned, deterministic series so the derivation graph
 * (ARR = MRR x 12, churn-rate, retention, ARPU/ARPPU, *_growth_rate, SLV, trial
 * conversion) and the per-call memoisation can be exercised without touching
 * ClickHouse. The accessor itself is covered in the integration suite.
 *
 * The fake also records how many times each metric was invoked so the cache
 * behaviour (same key → one underlying call, distinct keys → separate calls)
 * can be asserted directly.
 */
import { DateTime, Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import type {
  AnalyticsDataPoint,
  BuiltInInsightId,
  CompiledAnalyticsFilter,
  TimeGranularity,
} from "../../../src/domain/analytics/Analytics.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type {
  AnalyticsDataAccessor,
  AnalyticsQueryInput,
} from "../../../src/services/analytics/clickhouse-accessor.ts";
import { buildSeriesResolver } from "../../../src/services/analytics/series-resolver.ts";

// =============================================================================
// Fixtures + a recording accessor fake
// =============================================================================

const at = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

const TS0 = at("2026-01-01T00:00:00.000Z");
const TS1 = at("2026-01-02T00:00:00.000Z");
const TS2 = at("2026-01-03T00:00:00.000Z");

/** A fresh data point, one value per period. */
const point = (timestamp: Date, value: number): AnalyticsDataPoint => ({ timestamp, value });

const filter = (overrides: Partial<CompiledAnalyticsFilter> = {}): CompiledAnalyticsFilter => ({
  projectIds: ["it_project"],
  ...overrides,
});

const timeRange = () => ({ end: TS2, start: TS0 });

const granularity: TimeGranularity = "day";
const organizationId = "it_org";

/**
 * The resolver's accessor seam, faked. Each metric returns whatever canned
 * series the test seeded (default: empty) and bumps a per-metric call counter,
 * letting tests assert both the derived values and the cache's effect on the
 * number of underlying queries. Unseeded metrics that the resolver never asks
 * for simply stay at zero canned data.
 *
 * The real accessor methods type as `Effect.Effect<…, SqlError,
 * ClickhouseWebClient.ClickhouseWebClient>`; `Effect.succeed` (no requirements)
 * is assignable to that wider shape, so no ClickHouse service is touched at
 * runtime.
 */
interface FakeAccessor {
  readonly accessor: AnalyticsDataAccessor;
  readonly calls: Record<string, number>;
}

type MetricKey = keyof AnalyticsDataAccessor;

const makeFakeAccessor = (
  series: Partial<Record<MetricKey, AnalyticsDataPoint[]>> = {},
): FakeAccessor => {
  const calls: Record<string, number> = {};
  const metric =
    (key: MetricKey) =>
    (_input: AnalyticsQueryInput): Effect.Effect<AnalyticsDataPoint[]> =>
      Effect.sync(() => {
        calls[key] = (calls[key] ?? 0) + 1;
        // Return a fresh copy so callers cannot mutate the canned fixture.
        return (series[key] ?? []).map((p) => ({ ...p }));
      });

  const accessor: AnalyticsDataAccessor = {
    getActiveSubscriptions: metric("getActiveSubscriptions"),
    getActiveTrials: metric("getActiveTrials"),
    getChurnedRevenue: metric("getChurnedRevenue"),
    getChurnedSubscriptions: metric("getChurnedSubscriptions"),
    getMRR: metric("getMRR"),
    getNewPersons: metric("getNewPersons"),
    getNewSubscriptions: metric("getNewSubscriptions"),
    getPayingPersonCount: metric("getPayingPersonCount"),
    getPersonCount: metric("getPersonCount"),
    getRevenue: metric("getRevenue"),
    getTrialConversions: metric("getTrialConversions"),
    getTrials: metric("getTrials"),
  };

  return { accessor, calls };
};

/**
 * Stub ClickHouse client to discharge the `ClickhouseWebClient` requirement
 * that the resolver's return type carries. The fake accessor never reaches
 * ClickHouse, so any access throws (which would signal the fake leaked).
 */
// `ClickhouseWebClient` is a wide `SqlClient` surface that cannot be built here,
// so this narrow helper is the single seam where an untyped value is handed to
// the type system. Every property access dies, so a leak surfaces loudly.
const unusableService = (message: string): any =>
  new Proxy(
    {},
    {
      get: () => Effect.runSync(Effect.die(new Error(message))),
    },
  );

const clickhouseStub: ClickhouseWebClient.ClickhouseWebClient = unusableService(
  "ClickhouseWebClient must not be used in this test",
);

/** Run a resolver effect with the ClickHouse requirement stubbed out. */
const runSeries = (
  effect: Effect.Effect<AnalyticsDataPoint[], unknown, ClickhouseWebClient.ClickhouseWebClient>,
): Effect.Effect<AnalyticsDataPoint[], unknown> =>
  effect.pipe(Effect.provideService(ClickhouseWebClient.ClickhouseWebClient, clickhouseStub));

const get = (
  resolver: ReturnType<typeof buildSeriesResolver>,
  insightId: BuiltInInsightId,
): Effect.Effect<AnalyticsDataPoint[], unknown, ClickhouseWebClient.ClickhouseWebClient> =>
  resolver.getSeries(insightId, filter(), granularity, timeRange(), organizationId);


// =============================================================================
// Rate / growth-rate primitives (exercised through their public callers)
// =============================================================================

describe("calculateRate (via churn_rate / retention / trial_conversion_rate)", () => {
  it.effect("returns a percentage of numerator over the combined denominator", () =>
    Effect.gen(function* () {
      // churn_rate = churned / (active + churned) * 100 = 1 / (3 + 1) * 100 = 25.
      const { accessor } = makeFakeAccessor({
        getActiveSubscriptions: [point(TS0, 3)],
        getChurnedSubscriptions: [point(TS0, 1)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/churn_rate"));
      expect(result).toEqual([point(TS0, 25)]);
    }),
  );

  it.effect("returns 0 when the denominator is 0", () =>
    Effect.gen(function* () {
      // No active and no churned → 0 / 0 → calculateRate guards to 0.
      const { accessor } = makeFakeAccessor({
        getActiveSubscriptions: [point(TS0, 0)],
        getChurnedSubscriptions: [point(TS0, 0)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/churn_rate"));
      expect(result).toEqual([point(TS0, 0)]);
    }),
  );
});

describe("calculateGrowthRate (via mrr_growth_rate / active_subscribers_growth)", () => {
  it.effect("returns 0 for the first period (no previous value, current is 0)", () =>
    Effect.gen(function* () {
      // First point has previous = 0 and current = 0 → 0.
      const { accessor } = makeFakeAccessor({ getMRR: [point(TS0, 0), point(TS1, 0)] });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/mrr_growth_rate"),
      );
      expect(result[0]).toEqual(point(TS0, 0));
    }),
  );

  it.effect("returns 100 when growing from zero to a positive value", () =>
    Effect.gen(function* () {
      // previous = 0, current > 0 → 100.
      const { accessor } = makeFakeAccessor({ getMRR: [point(TS0, 0), point(TS1, 50)] });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/mrr_growth_rate"),
      );
      expect(result[1]).toEqual(point(TS1, 100));
    }),
  );

  it.effect("returns ((current - previous) / previous) * 100 between periods", () =>
    Effect.gen(function* () {
      // 200 → 250 = +25%; 250 → 200 = -20%.
      const { accessor } = makeFakeAccessor({
        getMRR: [point(TS0, 100), point(TS1, 200), point(TS2, 250)],
      });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/mrr_growth_rate"),
      );
      expect(result[1]).toEqual(point(TS1, 100)); // 100 → 200 = +100%
      expect(result[2]).toEqual(point(TS2, 25)); // 200 → 250 = +25%
    }),
  );
});

// =============================================================================
// Per-call cache behaviour
// =============================================================================

describe("buildSeriesResolver cache", () => {
  it.effect("caches by (insightId, filter, granularity, timeRange, organizationId)", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({ getRevenue: [point(TS0, 10)] });
      const resolver = buildSeriesResolver(accessor);
      yield* runSeries(get(resolver, "builtin/revenue"));
      yield* runSeries(get(resolver, "builtin/revenue"));
      // Identical cache key → only one underlying accessor call.
      expect(calls.getRevenue).toBe(1);
    }),
  );

  it.effect("reuses the cached result without re-querying for the same key", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({ getMRR: [point(TS0, 7)] });
      const resolver = buildSeriesResolver(accessor);
      // ARR and MRR-growth both derive from MRR; with one shared resolver the
      // MRR query is issued exactly once across all three reads.
      yield* runSeries(get(resolver, "builtin/mrr"));
      yield* runSeries(get(resolver, "builtin/arr"));
      yield* runSeries(get(resolver, "builtin/mrr_growth_rate"));
      expect(calls.getMRR).toBe(1);
    }),
  );

  it.effect("queries separately for different cache keys (distinct organization)", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({ getRevenue: [point(TS0, 10)] });
      const resolver = buildSeriesResolver(accessor);
      yield* runSeries(get(resolver, "builtin/revenue"));
      yield* runSeries(
        resolver.getSeries("builtin/revenue", filter(), granularity, timeRange(), "other_org"),
      );
      expect(calls.getRevenue).toBe(2);
    }),
  );

  it.effect("queries separately for different cache keys (distinct filter)", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({ getRevenue: [point(TS0, 10)] });
      const resolver = buildSeriesResolver(accessor);
      yield* runSeries(get(resolver, "builtin/revenue"));
      yield* runSeries(
        resolver.getSeries(
          "builtin/revenue",
          filter({ productIds: ["prod_1"] }),
          granularity,
          timeRange(),
          organizationId,
        ),
      );
      expect(calls.getRevenue).toBe(2);
    }),
  );

  it.effect("does not share a cache across separate resolver instances", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({ getRevenue: [point(TS0, 10)] });
      yield* runSeries(get(buildSeriesResolver(accessor), "builtin/revenue"));
      yield* runSeries(get(buildSeriesResolver(accessor), "builtin/revenue"));
      // Fresh per-call cache each time → two underlying calls.
      expect(calls.getRevenue).toBe(2);
    }),
  );
});

// =============================================================================
// Derived-metric composition
// =============================================================================

describe("derived metrics", () => {
  it.effect("ARR maps MRR x 12 over the series", () =>
    Effect.gen(function* () {
      const { accessor } = makeFakeAccessor({ getMRR: [point(TS0, 100), point(TS1, 0)] });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/arr"));
      expect(result).toEqual([point(TS0, 1200), point(TS1, 0)]);
    }),
  );

  it.effect("churn_rate combines churned and active subscriptions per period", () =>
    Effect.gen(function* () {
      // p0: 1 / (1 + 1) = 50; p1: 0 / (4 + 0) = 0.
      const { accessor } = makeFakeAccessor({
        getActiveSubscriptions: [point(TS0, 1), point(TS1, 4)],
        getChurnedSubscriptions: [point(TS0, 1), point(TS1, 0)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/churn_rate"));
      expect(result).toEqual([point(TS0, 50), point(TS1, 0)]);
    }),
  );

  it.effect("retention computes active / (active + churned)", () =>
    Effect.gen(function* () {
      // p0: 3 / (3 + 1) = 75; p1: 0 / (0 + 0) = 0 (guarded).
      const { accessor } = makeFakeAccessor({
        getActiveSubscriptions: [point(TS0, 3), point(TS1, 0)],
        getChurnedSubscriptions: [point(TS0, 1), point(TS1, 0)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/retention"));
      expect(result).toEqual([point(TS0, 75), point(TS1, 0)]);
    }),
  );

  it.effect("ARPU divides revenue by person_count with division-by-zero handling", () =>
    Effect.gen(function* () {
      // p0: 100 / 4 = 25; p1: persons = 0 → guarded to 0.
      const { accessor } = makeFakeAccessor({
        getRevenue: [point(TS0, 100), point(TS1, 80)],
        getPersonCount: [point(TS0, 4), point(TS1, 0)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/arpu"));
      expect(result).toEqual([point(TS0, 25), point(TS1, 0)]);
    }),
  );

  it.effect("ARPPU divides revenue by paying-person count with division-by-zero handling", () =>
    Effect.gen(function* () {
      // p0: 100 / 2 = 50; p1: paying = 0 → guarded to 0.
      const { accessor } = makeFakeAccessor({
        getRevenue: [point(TS0, 100), point(TS1, 60)],
        getPayingPersonCount: [point(TS0, 2), point(TS1, 0)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/arppu"));
      expect(result).toEqual([point(TS0, 50), point(TS1, 0)]);
    }),
  );

  it.effect("MRR growth rate uses the previous-period value", () =>
    Effect.gen(function* () {
      // first period previous = 0 & current 100 → 100; 100 → 150 = +50%.
      const { accessor } = makeFakeAccessor({ getMRR: [point(TS0, 100), point(TS1, 150)] });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/mrr_growth_rate"),
      );
      expect(result).toEqual([point(TS0, 100), point(TS1, 50)]);
    }),
  );

  it.effect("active-subscriber growth uses the previous-period value", () =>
    Effect.gen(function* () {
      // first period previous = 0 & current 10 → 100; 10 → 5 = -50%.
      const { accessor } = makeFakeAccessor({
        getActiveSubscriptions: [point(TS0, 10), point(TS1, 5)],
      });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/active_subscribers_growth"),
      );
      expect(result).toEqual([point(TS0, 100), point(TS1, -50)]);
    }),
  );

  it.effect("trial conversion rate divides conversions by trials", () =>
    Effect.gen(function* () {
      // p0: 5 conversions / 10 trials = 50; p1: trials = 0 → guarded to 0.
      const { accessor } = makeFakeAccessor({
        getTrials: [point(TS0, 10), point(TS1, 0)],
        getTrialConversions: [point(TS0, 5), point(TS1, 3)],
      });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/trial_conversion_rate"),
      );
      expect(result).toEqual([point(TS0, 50), point(TS1, 0)]);
    }),
  );

  it.effect("subscriber lifetime value divides ARPU by the churn fraction", () =>
    Effect.gen(function* () {
      // ARPU = revenue/persons = 100/10 = 10; churn_rate = churned/(active+churned)
      // = 5/(15+5) = 25 (percent). SLV = ARPU / (churn% / 100) = 10 / 0.25 = 40.
      const { accessor } = makeFakeAccessor({
        getRevenue: [point(TS0, 100)],
        getPersonCount: [point(TS0, 10)],
        getActiveSubscriptions: [point(TS0, 15)],
        getChurnedSubscriptions: [point(TS0, 5)],
      });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/subscriber_lifetime_value"),
      );
      expect(result).toEqual([point(TS0, 40)]);
    }),
  );

  it.effect("subscriber lifetime value is 0 when churn is 0 (no division by zero)", () =>
    Effect.gen(function* () {
      // churn_rate = 0 → SLV guarded to 0.
      const { accessor } = makeFakeAccessor({
        getRevenue: [point(TS0, 100)],
        getPersonCount: [point(TS0, 10)],
        getActiveSubscriptions: [point(TS0, 15)],
        getChurnedSubscriptions: [point(TS0, 0)],
      });
      const result = yield* runSeries(
        get(buildSeriesResolver(accessor), "builtin/subscriber_lifetime_value"),
      );
      expect(result).toEqual([point(TS0, 0)]);
    }),
  );
});

// =============================================================================
// Primitive pass-through
// =============================================================================

describe("primitive metrics", () => {
  it.effect("passes a primitive insight straight through the accessor", () =>
    Effect.gen(function* () {
      const { accessor, calls } = makeFakeAccessor({
        getNewPersons: [point(TS0, 3), point(TS1, 7)],
      });
      const result = yield* runSeries(get(buildSeriesResolver(accessor), "builtin/new_persons"));
      expect(result).toEqual([point(TS0, 3), point(TS1, 7)]);
      expect(calls.getNewPersons).toBe(1);
    }),
  );
});
