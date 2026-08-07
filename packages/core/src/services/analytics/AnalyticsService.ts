/**
 * `AnalyticsService` orchestrates the read-side analytics surface: the
 * recent-events feed (`listRecentEvents`) and the multi-insight composition
 * (`queryAnalyticsInsights`). Project lookups use `Db` inline; time-series and
 * event reads use {@link ClickhouseWebClient}. The filter compiler, time-range
 * resolver, and insight registry live in the analytics domain; the ClickHouse
 * query accessor and metric-derivation resolver live alongside this file. A
 * runtime without a ClickHouse service keeps authorization and Postgres scope
 * checks but returns empty analytics results.
 */
import { constant, pick } from "@voidhash/lib/lang";
import { Context, DateTime, Duration, Effect, Layer, Option, Schema } from "effect";

import {
  type AnalyticsDataPoint,
  type AnalyticsFilter,
  type AnalyticsInsightQuery,
  type AnalyticsInsightResult,
  type AnalyticsTimeRange,
  type BuiltInInsightId,
  CURRENCY_INSIGHTS,
  type CompiledAnalyticsFilter,
  InvalidAnalyticsQueryError,
  RATE_INSIGHTS,
  type TimeGranularity,
  avgDataPoints,
  compileAnalyticsFilter,
  ensureNoBreakdowns,
  getBuiltInInsight,
  resolveTimeRange,
  sumDataPoints,
} from "../../domain/analytics/Analytics.ts";
import { AuthSession } from "../../domain/auth/Auth.ts";
import { Db } from "@voidhash/db";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { checkOrganizationPermission, checkProjectPermission } from "../../utils/permissions.ts";
import { RESERVED_REVENUE_EVENT_NAMES } from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import {
  CLICKHOUSE_EVENTS_FULL_TABLE,
  CLICKHOUSE_PERSONS_FULL_TABLE,
  analyticsAccessor,
  getExperimentResults as getExperimentResultsQuery,
} from "./clickhouse-accessor.ts";
import { buildSeriesResolver } from "./series-resolver.ts";

const DEFAULT_LIMIT = 100;

/**
 * Conversion event assumed for an experiment that has not picked a primary
 * metric — the conventional purchase event the paywall SDK bridge emits, which
 * is the metric virtually every paywall test is measuring anyway.
 */
const DEFAULT_PRIMARY_METRIC_EVENT_NAME = "purchase_completed";
const MAX_LIMIT = 500;

/**
 * Catch-all service error. Wraps `SqlError`, `DbError`, and other
 * infrastructural failures at the public-method boundary.
 */
export class AnalyticsServiceError extends Schema.TaggedErrorClass<AnalyticsServiceError>(
  "AnalyticsServiceError",
)("AnalyticsServiceError", { cause: Schema.String, message: Schema.String }) {}

export interface QueryAnalyticsInsightsInput {
  queries: ReadonlyArray<{
    breakdowns?: AnalyticsInsightQuery["breakdowns"];
    context: { organizationId: string };
    filter?: AnalyticsFilter;
    granularity?: TimeGranularity;
    insightId: BuiltInInsightId;
    key: string;
    limit?: number;
    timeRange: AnalyticsTimeRange;
  }>;
}

interface RecentAnalyticsEventRow {
  capture_id: string;
  context: string;
  event_id: string;
  event_name: string;
  event_properties: string;
  identity_mode: string;
  person_distinct_id: string | null;
  person_email: string | null;
  person_id: string | null;
  person_name: string | null;
  previous_distinct_id: string | null;
  processed_at: string | Date;
  received_at: string | Date;
  request_id: string;
}

/** Conversion rate, guarding the zero-exposure division. */
const conversionRateOf = (conversions: number, exposures: number): number => {
  if (exposures > 0) return conversions / exposures;
  return 0;
};

const parseDate = (value: string | Date): Date => {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  let normalized = trimmed;
  if (!normalized.includes("T")) normalized = normalized.replace(" ", "T");
  // ClickHouse renders naive timestamps; anchor them to UTC before parsing.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) normalized = `${normalized}Z`;
  return DateTime.toDateUtc(DateTime.makeUnsafe(normalized));
};

/** JSON object payloads only: arrays and scalars decode to `None`, as before. */
const decodeJsonRecord = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

const parseJsonRecord = (value: string): Record<string, unknown> => {
  if (!value || value.trim().length === 0) return {};
  return Option.getOrElse(decodeJsonRecord(value), () => ({}));
};

export class AnalyticsService extends Context.Service<AnalyticsService>()("AnalyticsService", {
  make: Effect.gen(function* () {
    const ch = Option.getOrUndefined(
      yield* Effect.serviceOption(ClickhouseWebClient.ClickhouseWebClient),
    );
    const db = yield* Db;

    const listRecentEvents = Effect.fn("analytics.listRecentEvents")(
      function* (input: { readonly limit?: number; readonly projectId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access analytics events for project ${input.projectId}`,
        );

        if (ch === undefined) {
          return { events: [], hasMore: false };
        }

        const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
        yield* Effect.annotateCurrentSpan("voidhash.analytics.limit", limit);

        // The readonly ClickHouse user's row policies are keyed on
        // `SQL_organization_id`, so resolve the project's org and pass it on
        // every query (events_v2 + the persons_v1 join are both policy-scoped).
        const project = yield* db.query.projects.findFirst({
          columns: { organizationId: true },
          where: { id: input.projectId },
        });
        const organizationId = project?.organizationId ?? "";
        if (organizationId)
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);

        // Structural interpolations (table names) are injected with `ch.literal`
        // (raw SQL); scalar parameters use `ch.param` with their exact ClickHouse
        // type so the readonly user's row policies / parser behave as before.
        const rows = yield* ch.withClickhouseSettings(
          ch<RecentAnalyticsEventRow>`
            SELECT
              events.event_id AS event_id,
              events.event_name AS event_name,
              events.capture_id AS capture_id,
              events.distinct_id AS person_distinct_id,
              events.previous_distinct_id AS previous_distinct_id,
              events.person_id AS person_id,
              events.identity_mode AS identity_mode,
              events.request_id AS request_id,
              events.event_ts AS received_at,
              events.processed_ts AS processed_at,
              events.event_properties AS event_properties,
              events.context AS context,
              persons.name AS person_name,
              persons.email AS person_email
            FROM ${ch.literal(CLICKHOUSE_EVENTS_FULL_TABLE)} AS events
            LEFT JOIN (
              SELECT
                analytics_persons.person_id AS person_id,
                argMax(analytics_persons.email, analytics_persons.version) AS email,
                argMax(analytics_persons.name, analytics_persons.version) AS name
              FROM ${ch.literal(CLICKHOUSE_PERSONS_FULL_TABLE)} AS analytics_persons
              WHERE analytics_persons.project_id = ${ch.param("String", input.projectId)}
                AND analytics_persons.is_archived = 0
              GROUP BY analytics_persons.person_id
            ) AS persons ON events.person_id = persons.person_id
            WHERE events.project_id = ${ch.param("String", input.projectId)}
            ORDER BY events.event_ts DESC, events.event_id DESC
            LIMIT ${ch.param("UInt32", limit + 1)}
          `,
          { SQL_organization_id: organizationId },
        );

        yield* Effect.annotateCurrentSpan("voidhash.analytics.has_more", rows.length > limit);

        return {
          events: rows.slice(0, limit).map((row) => ({
            captureId: row.capture_id,
            context: parseJsonRecord(row.context),
            eventId: row.event_id,
            eventName: row.event_name,
            identityMode: row.identity_mode,
            personDistinctId: row.person_distinct_id,
            personEmail: row.person_email,
            personId: row.person_id,
            personName: row.person_name,
            previousDistinctId: row.previous_distinct_id,
            processedAt: parseDate(row.processed_at),
            properties: parseJsonRecord(row.event_properties),
            receivedAt: parseDate(row.received_at),
            requestId: row.request_id,
          })),
          hasMore: rows.length > limit,
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            SqlError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: error.message,
                  message: "Failed to list recent analytics events",
                }),
              ),
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to list recent analytics events",
                }),
              ),
          }),
        ),
    );

    const queryAnalyticsInsights = Effect.fn("queryAnalyticsInsights")(
      function* (input: QueryAnalyticsInsightsInput) {
        const session = yield* AuthSession;
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        yield* Effect.annotateCurrentSpan("voidhash.analytics.query_count", input.queries.length);
        const { getSeries } = buildSeriesResolver(analyticsAccessor);

        const results: ReadonlyArray<{
          insightId: BuiltInInsightId;
          key: string;
          resolvedTimeRange: { start: Date; end: Date };
          result: AnalyticsInsightResult;
        }>[number][] = [];

        for (const query of input.queries) {
          if (query.context.organizationId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              query.context.organizationId,
            );
          yield* Effect.annotateCurrentSpan("voidhash.analytics.insight_id", query.insightId);
          yield* Effect.annotateCurrentSpan("voidhash.analytics.insight_key", query.key);

          yield* checkOrganizationPermission(
            query.context.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to access analytics for organization ${query.context.organizationId}`,
          );

          const insight = yield* getBuiltInInsight(query.insightId);
          yield* ensureNoBreakdowns(query.breakdowns);

          const resolvedTimeRange = yield* resolveTimeRange(query.timeRange);
          yield* Effect.annotateCurrentSpan(
            "voidhash.analytics.time_range.start",
            resolvedTimeRange.start.toISOString(),
          );
          yield* Effect.annotateCurrentSpan(
            "voidhash.analytics.time_range.end",
            resolvedTimeRange.end.toISOString(),
          );
          const projectRows = yield* db.query.projects.findMany({
            where: { organizationId: query.context.organizationId },
          });
          const availableProjectIds = projectRows.map((project) => project.id);
          const compiledFilter: CompiledAnalyticsFilter = yield* compileAnalyticsFilter({
            availableProjectIds,
            filter: query.filter,
            supportedFields: insight.supportedFilterFields,
          });
          yield* Effect.annotateCurrentSpan(
            "voidhash.analytics.project_ids.count",
            compiledFilter.projectIds.length,
          );
          const granularity = query.granularity ?? insight.defaultGranularity;
          yield* Effect.annotateCurrentSpan("voidhash.analytics.granularity", granularity);

          if (!insight.supportedGranularities.includes(granularity)) {
            yield* Effect.fail(
              new InvalidAnalyticsQueryError({
                message: `Granularity ${granularity} is not supported for ${query.insightId}`,
              }),
            );
          }

          let series: AnalyticsDataPoint[] = [];
          if (compiledFilter.projectIds.length && ch !== undefined) {
            series = yield* getSeries(
              query.insightId,
              compiledFilter,
              granularity,
              resolvedTimeRange,
              query.context.organizationId,
            ).pipe(Effect.provideService(ClickhouseWebClient.ClickhouseWebClient, ch));
          }

          let summaryValue = sumDataPoints(series);
          if (RATE_INSIGHTS.has(query.insightId)) {
            summaryValue = avgDataPoints(series);
          }

          const result: AnalyticsInsightResult = {
            kind: "metric",
            sparkline: series,
            summary: {
              currency: pick(CURRENCY_INSIGHTS.has(query.insightId), "USD", undefined),
              value: summaryValue,
            },
          };

          results.push({
            insightId: query.insightId,
            key: query.key,
            resolvedTimeRange,
            result,
          });
        }

        return { results };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to query analytics insights",
                }),
              ),
            SqlError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: error.message,
                  message: "Failed to query analytics insights",
                }),
              ),
          }),
        ),
    );

    /**
     * Raw per-variant results for an experiment: exposures, conversions (primary
     * metric fired after first exposure), conversion rate, and post-exposure
     * revenue. Delegates the ClickHouse funnel to the accessor
     * ({@link getExperimentResultsQuery}); resolves the experiment's project +
     * organization (for the row policy) and its metric names here, falling back
     * to {@link DEFAULT_PRIMARY_METRIC_EVENT_NAME} when none was chosen. Reads
     * server-emitted `$experiment.exposed` events — returns zeroed variants until
     * exposure emission is live.
     */
    const getExperimentResults = Effect.fn("analytics.getExperimentResults")(
      function* (input: { readonly experimentId: string; readonly days?: number }) {
        const experiment = yield* db.query.experiments.findFirst({
          where: { id: input.experimentId },
        });
        if (!experiment) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: input.experimentId,
              message: "Experiment not found",
            }),
          );
        }
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to read experiment results for ${input.experimentId}`,
        );
        const project = yield* db.query.projects.findFirst({
          where: { id: experiment.projectId },
        });
        if (!project) {
          return yield* Effect.fail(
            new AnalyticsServiceError({
              cause: experiment.projectId,
              message: "Project not found",
            }),
          );
        }
        if (ch === undefined) {
          return { variants: [] };
        }
        const nowInstant = yield* DateTime.now;
        const now = DateTime.toDateUtc(nowInstant);
        const startDate =
          experiment.startedAt ??
          DateTime.toDateUtc(
            DateTime.subtractDuration(nowInstant, Duration.days(input.days ?? 90)),
          );
        const endDate = experiment.endedAt ?? now;

        const rows = yield* getExperimentResultsQuery({
          organizationId: project.organizationId,
          projectId: experiment.projectId,
          experimentId: experiment.id,
          primaryMetricEventNames: [
            experiment.primaryMetricEventName ?? DEFAULT_PRIMARY_METRIC_EVENT_NAME,
          ],
          revenueEventNames: [...RESERVED_REVENUE_EVENT_NAMES],
          startDate,
          endDate,
        }).pipe(Effect.provideService(ClickhouseWebClient.ClickhouseWebClient, ch));

        return {
          variants: rows.map((r) => {
            const exposures = Number(r.exposures);
            const conversions = Number(r.conversions);
            return {
              variantKey: r.variant,
              exposures,
              conversions,
              conversionRate: conversionRateOf(conversions, exposures),
              revenueUsd: Number(r.revenue_cents) / 100,
            };
          }),
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to query experiment results",
                }),
              ),
            SqlError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: error.message,
                  message: "Failed to query experiment results",
                }),
              ),
          }),
        ),
    );

    return constant({ getExperimentResults, listRecentEvents, queryAnalyticsInsights });
  }),
}) {
  static layer: Layer.Layer<AnalyticsService, never, Db> = Layer.effect(
    AnalyticsService,
  )(AnalyticsService.make);
}
