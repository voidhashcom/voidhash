/**
 * Integration tests for {@link AnalyticsService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * The service is read-only — it writes nothing to MySQL or ClickHouse — so
 * these tests need no row cleanup. What they verify instead is the
 * *orchestration* layered on top of the (separately unit-tested) pure helpers:
 *
 *  - permission gates: `listRecentEvents` requires `project:all` on the target
 *    project; `queryAnalyticsInsights` requires `organization:all` on each
 *    query's organization. Both are exercised via {@link asUnauthorized}, which
 *    re-authenticates just the guarded call with a no-access session that
 *    shadows the harness's default full-permission session.
 *  - the inline `Db` project lookups (org resolution for the recent-events
 *    tenant setting; the org's project list that seeds filter compilation).
 *  - composition errors that propagate untouched past the service's
 *    `catchTags` net (`UnknownInsightError`, `UnsupportedAnalyticsBreakdownError`,
 *    `InvalidAnalyticsQueryError` for an unsupported granularity,
 *    `InvalidTimeRangeError` for an inverted custom range).
 *  - the derived-metric summary contract: a currency insight stamps
 *    `summary.currency = "USD"`, a rate insight leaves it `undefined`; the
 *    empty-series branch (no projects match the filter) skips ClickHouse
 *    entirely and yields a zero summary.
 *  - the real ClickHouse read path: against the fixture org (which has no
 *    ingested events) the metric query runs end-to-end and returns an empty
 *    sparkline rather than throwing.
 *
 * The pure helpers themselves — filter compilation, time-range presets, the
 * insight registry, JSON/date row parsing — are covered by the sibling
 * `*.test.ts` unit files and are not re-asserted here.
 *
 * Typed failures are asserted with `Effect.flip` (project convention),
 * narrowing the swapped error with `instanceof` before reading its fields.
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  AnalyticsService,
  AnalyticsServiceError,
} from "@voidhash/core/services/analytics/AnalyticsService";
import { constant } from "@voidhash/lib/lang";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  InvalidAnalyticsQueryError,
  InvalidTimeRangeError,
  UnknownInsightError,
  UnsupportedAnalyticsBreakdownError,
} from "@voidhash/core/domain/analytics/Analytics";
import { Db } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;
const organizationId = CoreTestFixture.organizationId;

/**
 * A `user`-method session for the fixture principal carrying neither project
 * nor organization access — used to assert both permission gates reject.
 */
const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

const untyped = (value: unknown): any => value;

const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: EPOCH,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/**
 * Run a single call as a caller with no access. Re-authenticates just this
 * effect with the no-access session; the inner provision shadows the harness's
 * default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("AnalyticsService.listRecentEvents", () => {
  test(
    "returns an events feed against the real ClickHouse for the fixture project",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // The point is that the query path — org resolution + tenant-scoped
      // ClickHouse read — runs end-to-end without throwing and returns a
      // well-formed feed. The live ClickHouse may already hold rows for the
      // fixture project (seeded by sibling suites / persisted across runs), so
      // we assert structure + the limit/hasMore contract rather than an exact
      // (and shared-state-dependent) row count.
      const limit = 5;
      const result = yield* analytics.listRecentEvents({ limit, projectId });

      expect(Array.isArray(result.events)).toBe(true);
      // Never returns more than the requested limit; the +1 lookahead is sliced
      // off before mapping (AnalyticsService.ts: rows.slice(0, limit)).
      expect(result.events.length).toBeLessThanOrEqual(limit);
      // hasMore is `rows.length > limit`, so it can only be true when the page
      // is full.
      if (result.hasMore) {
        expect(result.events.length).toBe(limit);
      }
      // Any rows that came back must carry the mapped event shape.
      for (const event of result.events) {
        expect(typeof event.eventId).toBe("string");
        expect(typeof event.eventName).toBe("string");
        expect(event.receivedAt).toBeInstanceOf(Date);
        expect(event.processedAt).toBeInstanceOf(Date);
        expect(typeof event.context).toBe("object");
        expect(typeof event.properties).toBe("object");
      }
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "resolves the project's organization for the tenant-scoped read",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;
      const db = yield* Db;

      // Confirm the inline Db lookup the service performs sees the same org we
      // expect to be stamped as SQL_organization_id on the ClickHouse query.
      const project = yield* db.query.projects.findFirst({
        columns: { organizationId: true },
        where: { id: projectId },
      });
      expect(project?.organizationId).toBe(organizationId);

      // A larger explicit limit must be accepted (clamped to MAX_LIMIT=500
      // internally) and still return cleanly.
      const result = yield* analytics.listRecentEvents({ limit: 1000, projectId });
      expect(result.hasMore).toBe(false);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and reads nothing",
    // No cleanup wrapper: the service writes nothing on any path.
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      const error = yield* Effect.flip(asUnauthorized(analytics.listRecentEvents({ projectId })));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  vitestTest.todo(
    "listRecentEvents: orders by event_ts DESC, honors limit + hasMore, and parses person join / JSON context + properties / dates — requires seeding events_v2 + persons_v1 rows in ClickHouse under the fixture org, which there is no in-process writer seam for here (the analytics writer pipeline runs in a separate worker runtime).",
  );
});

describe("AnalyticsService.queryAnalyticsInsights", () => {
  test(
    "rejects an unknown insight id with UnknownInsightError",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      const error = yield* Effect.flip(
        analytics.queryAnalyticsInsights({
          queries: [
            {
              context: { organizationId },
              // Untyped on purpose: the service validates the id against the
              // registry at runtime; we deliberately pass one outside the
              // BuiltInInsightId union to exercise that guard.
              insightId: untyped("builtin/does_not_exist"),
              key: "k",
              timeRange: { preset: "last_7d" },
            },
          ],
        }),
      );
      expect(error).toBeInstanceOf(UnknownInsightError);
      if (error instanceof UnknownInsightError) {
        expect(error.insightId).toBe("builtin/does_not_exist");
      }
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without organization:all",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      const error = yield* Effect.flip(
        asUnauthorized(
          analytics.queryAnalyticsInsights({
            queries: [
              {
                context: { organizationId },
                insightId: "builtin/revenue",
                key: "k",
                timeRange: { preset: "last_7d" },
              },
            ],
          }),
        ),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects an inverted custom time range with InvalidTimeRangeError",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      const error = yield* Effect.flip(
        analytics.queryAnalyticsInsights({
          queries: [
            {
              context: { organizationId },
              insightId: "builtin/revenue",
              key: "k",
              timeRange: {
                end: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00Z")),
                preset: "custom",
                start: DateTime.toDateUtc(DateTime.makeUnsafe("2024-06-01T00:00:00Z")),
              },
            },
          ],
        }),
      );
      expect(error).toBeInstanceOf(InvalidTimeRangeError);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects breakdowns with UnsupportedAnalyticsBreakdownError",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      const error = yield* Effect.flip(
        analytics.queryAnalyticsInsights({
          queries: [
            {
              breakdowns: [{ field: "product.id" }],
              context: { organizationId },
              insightId: "builtin/revenue",
              key: "k",
              timeRange: { preset: "last_7d" },
            },
          ],
        }),
      );
      expect(error).toBeInstanceOf(UnsupportedAnalyticsBreakdownError);
      if (error instanceof UnsupportedAnalyticsBreakdownError) {
        expect(error.field).toBe("product.id");
      }
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects an unsupported granularity for the insight with InvalidAnalyticsQueryError",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // `builtin/mrr` supports only the non-hourly granularities, so requesting
      // `hour` must be rejected.
      const error = yield* Effect.flip(
        analytics.queryAnalyticsInsights({
          queries: [
            {
              context: { organizationId },
              granularity: "hour",
              insightId: "builtin/mrr",
              key: "k",
              timeRange: { preset: "last_7d" },
            },
          ],
        }),
      );
      expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns an empty series and zero summary when the filter matches no projects",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // Filtering project.id to an id outside the org empties the compiled
      // projectIds, so the service short-circuits before any ClickHouse read.
      const nowMillis = yield* Clock.currentTimeMillis;
      const { results } = yield* analytics.queryAnalyticsInsights({
        queries: [
          {
            context: { organizationId },
            filter: {
              field: "project.id",
              op: "eq",
              type: "predicate",
              value: `it-nonexistent-project-${nowMillis}`,
            },
            insightId: "builtin/revenue",
            key: "empty",
            timeRange: { preset: "last_7d" },
          },
        ],
      });

      expect(results.length).toBe(1);
      const entry = results.find((r) => r.key === "empty");
      expect(entry).toBeDefined();
      expect(entry?.insightId).toBe("builtin/revenue");
      expect(entry?.result.kind).toBe("metric");
      if (entry?.result.kind === "metric") {
        expect(entry.result.sparkline).toEqual([]);
        expect(entry.result.summary.value).toBe(0);
      }
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "stamps USD on a currency insight and leaves currency undefined for a rate insight",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // Both queries match no projects (empty series) so the summary value is a
      // deterministic 0; what differs is the currency stamp, which the service
      // derives purely from the insight id (CURRENCY_INSIGHTS vs RATE_INSIGHTS).
      const nowMillis = yield* Clock.currentTimeMillis;
      const emptyFilter = constant({
        field: "project.id",
        op: "eq",
        type: "predicate",
        value: `it-nonexistent-project-${nowMillis}`,
      });

      const { results } = yield* analytics.queryAnalyticsInsights({
        queries: [
          {
            context: { organizationId },
            filter: emptyFilter,
            insightId: "builtin/revenue",
            key: "currency",
            timeRange: { preset: "last_30d" },
          },
          {
            context: { organizationId },
            filter: emptyFilter,
            insightId: "builtin/churn_rate",
            key: "rate",
            timeRange: { preset: "last_30d" },
          },
        ],
      });

      const currency = results.find((r) => r.key === "currency");
      const rate = results.find((r) => r.key === "rate");

      expect(currency?.result.kind).toBe("metric");
      if (currency?.result.kind === "metric") {
        expect(currency.result.summary.currency).toBe("USD");
        expect(currency.result.summary.value).toBe(0);
      }

      expect(rate?.result.kind).toBe("metric");
      if (rate?.result.kind === "metric") {
        expect(rate.result.summary.currency).toBeUndefined();
        expect(rate.result.summary.value).toBe(0);
      }
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "runs the real ClickHouse metric read for the org's projects and returns a metric result",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // No filter → compiled projectIds defaults to the org's project list
      // (the fixture project), which is non-empty, so the service issues the
      // live tenant-scoped ClickHouse query. The fixture org has no events, so
      // the sparkline is empty — but the query must execute, not throw.
      const { results } = yield* analytics.queryAnalyticsInsights({
        queries: [
          {
            context: { organizationId },
            insightId: "builtin/revenue",
            key: "live",
            timeRange: { preset: "last_7d" },
          },
        ],
      });

      const entry = results.find((r) => r.key === "live");
      expect(entry).toBeDefined();
      expect(entry?.result.kind).toBe("metric");
      if (entry?.result.kind === "metric") {
        expect(Array.isArray(entry.result.sparkline)).toBe(true);
        expect(typeof entry.result.summary.value).toBe("number");
        expect(entry.result.summary.currency).toBe("USD");
      }
      // The resolved range is surfaced alongside the result and is a real
      // ordered interval.
      expect(entry?.resolvedTimeRange.start.getTime()).toBeLessThanOrEqual(
        entry?.resolvedTimeRange.end.getTime() ?? 0,
      );
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "resolves multiple insights that share an underlying metric in a single call",
    Effect.gen(function* () {
      const analytics = yield* AnalyticsService;

      // ARPU and ARPPU both derive from Revenue; queried together they share
      // the per-call series-resolver cache. With no events the values are 0,
      // but both must resolve to metric results in one call.
      const { results } = yield* analytics.queryAnalyticsInsights({
        queries: [
          {
            context: { organizationId },
            insightId: "builtin/arpu",
            key: "arpu",
            timeRange: { preset: "last_7d" },
          },
          {
            context: { organizationId },
            insightId: "builtin/arppu",
            key: "arppu",
            timeRange: { preset: "last_7d" },
          },
        ],
      });

      expect(results.some((r) => r.key === "arpu" && r.result.kind === "metric")).toBe(true);
      expect(results.some((r) => r.key === "arppu" && r.result.kind === "metric")).toBe(true);
    }).pipe(Effect.provide(AnalyticsService.layer), CoreAuthSession.authenticate()),
  );

  vitestTest.todo(
    "queryAnalyticsInsights: returns non-empty sparkline points and a summed/averaged summary for an org with ingested revenue/subscription events — requires seeding events_v2 rows under the fixture org, for which there is no in-process writer seam (analytics ingest runs in a separate worker runtime). The summary aggregation (sum vs avg) and sparkline shape are otherwise covered as pure logic in the sibling unit tests.",
  );
});

// Referenced so the wrapped error type is imported and stays in sync with the
// service surface even while its DB/ClickHouse failure paths are deferred above.
void AnalyticsServiceError;
