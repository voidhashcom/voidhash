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
import type { AnalyticsEventV1 } from "../../domain/analytics/AnalyticsEvent.ts";
import { AuthSession } from "../../domain/auth/Auth.ts";
import { checkOrganizationPermission, checkProjectPermission } from "../../utils/permissions.ts";
import { AnalyticsEventStore, type StoredAnalyticsEvent } from "./AnalyticsEventStore.ts";
import { RequestEnvironmentMode } from "../requestEnvironment/RequestEnvironmentMode.ts";
import { resolvePostgresAnalyticsSeries } from "./postgres-series-resolver.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const COMMUNITY_QUERY_EVENT_LIMIT = 100_000;

/** Catch-all error for PostgreSQL analytics reads. */
export class AnalyticsServiceError extends Schema.TaggedErrorClass<AnalyticsServiceError>(
  "AnalyticsServiceError",
)("AnalyticsServiceError", { cause: Schema.String, message: Schema.String }) {}

/** A single built-in insight request, independent of how it is authorized. */
export interface AnalyticsInsightRequest {
  breakdowns?: AnalyticsInsightQuery["breakdowns"];
  filter?: AnalyticsFilter;
  granularity?: TimeGranularity;
  insightId: BuiltInInsightId;
  key: string;
  limit?: number;
  timeRange: AnalyticsTimeRange;
}

export interface QueryAnalyticsInsightsInput {
  queries: ReadonlyArray<AnalyticsInsightRequest & { context: { organizationId: string } }>;
}

/**
 * Input for the project-scoped read used by the public HTTP API, where the
 * caller may hold a project-only credential (a secret key) and therefore has no
 * organization membership to check.
 */
export interface QueryProjectAnalyticsInsightsInput {
  projectId: string;
  queries: ReadonlyArray<AnalyticsInsightRequest>;
}

interface AnalyticsInsightQueryResult {
  insightId: BuiltInInsightId;
  key: string;
  resolvedTimeRange: { start: Date; end: Date };
  result: AnalyticsInsightResult;
}

export interface ExperimentAnalyticsVariant {
  readonly conversionRate: number;
  readonly conversions: number;
  readonly exposures: number;
  readonly revenueUsd: number;
  readonly variantKey: string;
}

/** Storage-neutral event fields exposed by the paginated management API. */
export interface AnalyticsEventListItem {
  readonly captureId: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly distinctId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly identityMode: AnalyticsEventV1["identityMode"];
  readonly personId: string | null;
  readonly previousDistinctId: string | null;
  readonly processedAt: Date;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly receivedAt: Date;
  readonly requestId: string;
  readonly source: AnalyticsEventV1["source"];
  readonly timestamp: Date;
}

/** Project-scoped input for paginating analytics events. */
export interface ListProjectAnalyticsEventsPageInput {
  readonly afterEventId?: string;
  readonly eventName?: string;
  readonly limit?: number;
  readonly projectId: string;
}

/** One page of analytics events plus whether another page follows. */
export interface ProjectAnalyticsEventPage {
  readonly events: ReadonlyArray<AnalyticsEventListItem>;
  readonly hasNextPage: boolean;
}

const toAnalyticsEventListItem = (row: StoredAnalyticsEvent): AnalyticsEventListItem => ({
  captureId: row.captureId,
  context: row.context,
  distinctId: row.distinctId,
  eventId: row.eventId,
  eventName: row.eventName,
  identityMode: row.identityMode,
  personId: row.personId,
  previousDistinctId: row.previousDistinctId,
  processedAt: row.processedAt,
  properties: row.properties,
  receivedAt: row.receivedAt,
  requestId: row.requestId,
  source: row.source,
  timestamp: row.eventTimestamp,
});

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
            receivedAt: row.receivedAt,
            requestId: row.requestId,
            timestamp: row.eventTimestamp,
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

    const listEventsPage = Effect.fn("analytics.listEventsPage")(
      function* (input: ListProjectAnalyticsEventsPageInput) {
        const session = yield* AuthSession;
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access analytics events for project ${input.projectId}`,
        );
        const eventNames: Array<string> = [];
        if (input.eventName !== undefined) eventNames.push(input.eventName);
        const page = yield* eventStore.listPage({
          afterEventId: input.afterEventId,
          eventNames,
          limit: input.limit,
          projectIds: [input.projectId],
        });
        return {
          events: page.events.map(toAnalyticsEventListItem),
          hasNextPage: page.hasNextPage,
        } satisfies ProjectAnalyticsEventPage;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTag("AnalyticsEventStoreError", (error) =>
            Effect.fail(new AnalyticsServiceError({ cause: error.cause, message: error.message })),
          ),
        ),
    );

    /**
     * Runs one built-in insight against an already-authorized set of projects.
     *
     * `availableProjectIds` is the authorization boundary: `compileAnalyticsFilter`
     * intersects every `project.id` predicate with it and falls back to it when the
     * caller supplies no project predicate, so a query can never read outside the
     * set its caller was authorized for.
     */
    const runInsightQuery = (input: {
      availableProjectIds: Array<string>;
      query: AnalyticsInsightRequest;
    }) =>
      Effect.gen(function* () {
        const { availableProjectIds, query } = input;
        const environmentMode = yield* RequestEnvironmentMode;
        const insight = yield* getBuiltInInsight(query.insightId);
        yield* ensureNoBreakdowns(query.breakdowns);
        const resolvedTimeRange = yield* resolveTimeRange(query.timeRange);
        const compiledFilter: CompiledAnalyticsFilter = yield* compileAnalyticsFilter({
          availableProjectIds,
          filter: query.filter,
          supportedFields: insight.supportedFilterFields,
        });
        if (insight.supportedFilterFields.includes("provider.environment")) {
          compiledFilter.providerEnvironments = (
            compiledFilter.providerEnvironments ?? [...environmentMode.providerEnvironments]
          ).filter((environment) =>
            environmentMode.providerEnvironments.some((allowed) => allowed === environment),
          );
        }
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

        const queryResult: AnalyticsInsightQueryResult = {
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
        };
        return queryResult;
      });

    const queryAnalyticsInsights = Effect.fn("queryAnalyticsInsights")(
      function* (input: QueryAnalyticsInsightsInput) {
        const session = yield* AuthSession;
        const results: Array<AnalyticsInsightQueryResult> = [];

        for (const query of input.queries) {
          yield* checkOrganizationPermission(
            query.context.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to access analytics for organization ${query.context.organizationId}`,
          );
          const projectRows = yield* db.query.projects.findMany({
            columns: { id: true },
            where: { organizationId: query.context.organizationId },
          });
          results.push(
            yield* runInsightQuery({
              availableProjectIds: projectRows.map((project) => project.id),
              query,
            }),
          );
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

    /**
     * Project-scoped variant of {@link queryAnalyticsInsights} for callers that
     * hold a project credential rather than organization membership (public HTTP
     * API secret keys, whose sessions carry no organizations at all).
     *
     * Authorization is a single `project:all` check on `input.projectId`, and the
     * query is confined to that one project, so it can never read sibling
     * projects even if the caller's filter names one.
     */
    const queryProjectAnalyticsInsights = Effect.fn("queryProjectAnalyticsInsights")(
      function* (input: QueryProjectAnalyticsInsightsInput) {
        const session = yield* AuthSession;
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access analytics for project ${input.projectId}`,
        );
        const results: Array<AnalyticsInsightQueryResult> = [];
        for (const query of input.queries) {
          results.push(
            yield* runInsightQuery({ availableProjectIds: [input.projectId], query }),
          );
        }
        return { results };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTag("AnalyticsEventStoreError", (error) =>
            Effect.fail(new AnalyticsServiceError({ cause: error.cause, message: error.message })),
          ),
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

    return constant({
      getExperimentResults,
      listEventsPage,
      listRecentEvents,
      queryAnalyticsInsights,
      queryProjectAnalyticsInsights,
    });
  }),
}) {
  static readonly layer: Layer.Layer<AnalyticsService, never, Db | AnalyticsEventStore> =
    Layer.effect(AnalyticsService)(AnalyticsService.make);
}
