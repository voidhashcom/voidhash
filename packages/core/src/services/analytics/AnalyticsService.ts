import { Db } from "@voidhash/db";
import { constant, pick } from "@voidhash/lib/lang";
import type { ListRecentAnalyticsEventsResponseType } from "@voidhash/rpc";
import { Context, Effect, Layer, Schema } from "effect";

import {
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
import { checkOrganizationPermission, checkProjectPermission } from "../../utils/permissions.ts";
import { AnalyticsEventStore } from "./AnalyticsEventStore.ts";
import { resolvePostgresAnalyticsSeries } from "./postgres-series-resolver.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const COMMUNITY_QUERY_EVENT_LIMIT = 100_000;

/** Catch-all error for PostgreSQL analytics reads. */
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

export interface ExperimentAnalyticsVariant {
  readonly conversionRate: number;
  readonly conversions: number;
  readonly exposures: number;
  readonly revenueUsd: number;
  readonly variantKey: string;
}

/**
 * Community analytics reads over the portable PostgreSQL event log. The
 * service keeps the existing built-in insight contract and deliberately omits
 * custom insights, dashboards, cohorts, and VoidQL.
 */
export class AnalyticsService extends Context.Service<AnalyticsService>()("AnalyticsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const eventStore = yield* AnalyticsEventStore;

    const listRecentEvents = Effect.fn("analytics.listRecentEvents")(
      function* (input: { readonly limit?: number; readonly projectId: string }) {
        const session = yield* AuthSession;
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access analytics events for project ${input.projectId}`,
        );
        const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
        const rows = yield* eventStore.list({
          limit: limit + 1,
          order: "desc",
          projectIds: [input.projectId],
        });
        const response: ListRecentAnalyticsEventsResponseType = {
          events: rows.slice(0, limit).map((row) => ({
            captureId: row.captureId,
            context: row.context,
            eventId: row.eventId,
            eventName: row.eventName,
            identityMode: row.identityMode,
            personDistinctId: row.distinctId,
            personEmail: null,
            personId: row.personId,
            personName: null,
            previousDistinctId: row.previousDistinctId,
            processedAt: row.processedAt,
            properties: row.properties,
            receivedAt: row.eventTimestamp,
            requestId: row.requestId,
          })),
          hasMore: rows.length > limit,
        };
        return response;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTag("AnalyticsEventStoreError", (error) =>
            Effect.fail(new AnalyticsServiceError({ cause: error.cause, message: error.message })),
          ),
        ),
    );

    const queryAnalyticsInsights = Effect.fn("queryAnalyticsInsights")(
      function* (input: QueryAnalyticsInsightsInput) {
        const session = yield* AuthSession;
        const results: Array<{
          insightId: BuiltInInsightId;
          key: string;
          resolvedTimeRange: { start: Date; end: Date };
          result: AnalyticsInsightResult;
        }> = [];

        for (const query of input.queries) {
          yield* checkOrganizationPermission(
            query.context.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to access analytics for organization ${query.context.organizationId}`,
          );
          const insight = yield* getBuiltInInsight(query.insightId);
          yield* ensureNoBreakdowns(query.breakdowns);
          const resolvedTimeRange = yield* resolveTimeRange(query.timeRange);
          const projectRows = yield* db.query.projects.findMany({
            columns: { id: true },
            where: { organizationId: query.context.organizationId },
          });
          const compiledFilter: CompiledAnalyticsFilter = yield* compileAnalyticsFilter({
            availableProjectIds: projectRows.map((project) => project.id),
            filter: query.filter,
            supportedFields: insight.supportedFilterFields,
          });
          const granularity = query.granularity ?? insight.defaultGranularity;
          if (!insight.supportedGranularities.includes(granularity)) {
            return yield* Effect.fail(
              new InvalidAnalyticsQueryError({
                message: `Granularity ${granularity} is not supported for ${query.insightId}`,
              }),
            );
          }

          const events = yield* eventStore.list({
            end: resolvedTimeRange.end,
            limit: COMMUNITY_QUERY_EVENT_LIMIT,
            projectIds: compiledFilter.projectIds,
          });
          const series = resolvePostgresAnalyticsSeries({
            end: resolvedTimeRange.end,
            events,
            filters: compiledFilter,
            granularity,
            insightId: query.insightId,
            start: resolvedTimeRange.start,
          });
          let summaryValue = sumDataPoints(series);
          if (RATE_INSIGHTS.has(query.insightId)) summaryValue = avgDataPoints(series);

          results.push({
            insightId: query.insightId,
            key: query.key,
            resolvedTimeRange,
            result: {
              kind: "metric",
              sparkline: series,
              summary: {
                currency: pick(CURRENCY_INSIGHTS.has(query.insightId), "USD", undefined),
                value: summaryValue,
              },
            },
          });
        }
        return { results };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            AnalyticsEventStoreError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({ cause: error.cause, message: error.message }),
              ),
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new AnalyticsServiceError({
                  cause: String(error.cause),
                  message: "Failed to query analytics insights",
                }),
              ),
          }),
        ),
    );

    const getExperimentResults = Effect.fn("analytics.getExperimentResults")(
      function* (input: { readonly experimentId: string; readonly days?: number }) {
        const experiment = yield* db.query.experiments.findFirst({
          columns: { projectId: true },
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
        const variants: ExperimentAnalyticsVariant[] = [];
        return { variants };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTag("EffectDrizzleQueryError", (error) =>
            Effect.fail(
              new AnalyticsServiceError({
                cause: String(error.cause),
                message: "Failed to query experiment results",
              }),
            ),
          ),
        ),
    );

    return constant({ getExperimentResults, listRecentEvents, queryAnalyticsInsights });
  }),
}) {
  static readonly layer: Layer.Layer<AnalyticsService, never, Db | AnalyticsEventStore> =
    Layer.effect(AnalyticsService)(AnalyticsService.make);
}
