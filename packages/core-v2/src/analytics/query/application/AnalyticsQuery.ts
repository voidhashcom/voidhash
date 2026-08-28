import { Context, Effect, Layer, Schema } from "effect";
import type { AuthSession } from "@voidhash/rpc";

import {
  AnalyticsAuthorizationDeniedError,
  AnalyticsAuthorizer,
  AnalyticsConfig,
  AnalyticsStore,
} from "../../application/ports.ts";
import type { AnalyticsPortError, StoredAnalyticsEvent } from "../../application/ports.ts";
import {
  AnalyticsInsightQuery,
  AnalyticsInsightResult,
  BuiltInInsightId,
  CURRENCY_INSIGHTS,
  type CompiledAnalyticsFilter,
  InvalidAnalyticsQueryError,
  type InvalidTimeRangeError,
  RATE_INSIGHTS,
  STOCK_INSIGHTS,
  type UnknownInsightError,
  type UnsupportedAnalyticsBreakdownError,
  type UnsupportedAnalyticsFilterError,
  avgDataPoints,
  compileAnalyticsFilter,
  ensureNoBreakdowns,
  getBuiltInInsight,
  resolveTimeRange,
  sumDataPoints,
} from "../domain/Analytics.ts";
import { resolvePortableAnalyticsSeries } from "./portable-series-resolver.ts";
import { isRevenueMoneyEventName } from "../../domain/InternalAnalyticsEvents.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const QUERY_EVENT_LIMIT = 100_000;
const HISTORY_INSIGHTS: ReadonlySet<typeof BuiltInInsightId.Type> = new Set([
  "builtin/mrr",
  "builtin/arr",
  "builtin/mrr_growth_rate",
  "builtin/churn_rate",
  "builtin/person_count",
  "builtin/new_persons",
  "builtin/retention",
  "builtin/arpu",
  "builtin/active_subscriptions",
  "builtin/active_trials",
  "builtin/active_subscribers_growth",
  "builtin/subscriber_lifetime_value",
  "builtin/trial_conversions",
  "builtin/trial_conversion_rate",
]);

export class AnalyticsQueryError extends Schema.TaggedErrorClass<AnalyticsQueryError>(
  "AnalyticsQueryError",
)("AnalyticsQueryError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export const AnalyticsInsightRequest = AnalyticsInsightQuery;

export const AnalyticsInsightQueryResult = Schema.Struct({
  insightId: BuiltInInsightId,
  key: Schema.String,
  resolvedTimeRange: Schema.Struct({ start: Schema.Date, end: Schema.Date }),
  result: AnalyticsInsightResult,
});

export const AnalyticsEventListItem = Schema.Struct({
  captureId: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  distinctId: Schema.String,
  eventId: Schema.String,
  eventName: Schema.String,
  identityMode: Schema.Literals(["full", "personless"]),
  personId: Schema.NullOr(Schema.String),
  previousDistinctId: Schema.NullOr(Schema.String),
  processedAt: Schema.Date,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  receivedAt: Schema.Date,
  requestId: Schema.String,
  source: Schema.Literals(["internal", "revenue", "sdk"]),
  timestamp: Schema.Date,
});

export const ExperimentAnalyticsVariant = Schema.Struct({
  conversionRate: Schema.Number,
  conversions: Schema.Int,
  exposures: Schema.Int,
  revenueUsd: Schema.Number,
  variantKey: Schema.String,
});

const listItem = (event: typeof StoredAnalyticsEvent.Type) =>
  ({
    captureId: event.captureId,
    context: event.context,
    distinctId: event.distinctId,
    eventId: event.eventId,
    eventName: event.eventName,
    identityMode: event.identityMode,
    personId: event.personId,
    previousDistinctId: event.previousDistinctId,
    processedAt: event.processedAt,
    properties: event.properties,
    receivedAt: event.receivedAt,
    requestId: event.requestId,
    source: event.source,
    timestamp: event.eventTimestamp,
  }) satisfies typeof AnalyticsEventListItem.Type;

/** Portable analytics query capabilities. */
export interface AnalyticsQueryShape {
  readonly getExperimentResults: (input: {
    readonly end: Date;
    readonly experimentId: string;
    readonly primaryMetricEventName: string;
    readonly projectId: string;
    readonly start: Date;
  }) => Effect.Effect<
    { readonly variants: ReadonlyArray<typeof ExperimentAnalyticsVariant.Type> },
    AnalyticsQueryError | AnalyticsAuthorizationDeniedError,
    AuthSession
  >;
  readonly listEventsPage: (input: {
    readonly afterEventId?: string;
    readonly eventName?: string;
    readonly limit?: number;
    readonly projectId: string;
  }) => Effect.Effect<
    {
      readonly events: ReadonlyArray<typeof AnalyticsEventListItem.Type>;
      readonly hasNextPage: boolean;
    },
    AnalyticsQueryError | AnalyticsAuthorizationDeniedError,
    AuthSession
  >;
  readonly listRecentEvents: (input: {
    readonly limit?: number;
    readonly projectId: string;
  }) => Effect.Effect<
    {
      readonly events: ReadonlyArray<typeof AnalyticsEventListItem.Type>;
      readonly hasMore: boolean;
    },
    AnalyticsQueryError | AnalyticsAuthorizationDeniedError,
    AuthSession
  >;
  readonly queryOrganization: (input: {
    readonly organizationId: string;
    readonly queries: ReadonlyArray<typeof AnalyticsInsightRequest.Type>;
  }) => Effect.Effect<
    ReadonlyArray<typeof AnalyticsInsightQueryResult.Type>,
    AnalyticsQueryFailure,
    AuthSession
  >;
  readonly queryProject: (input: {
    readonly projectId: string;
    readonly queries: ReadonlyArray<typeof AnalyticsInsightRequest.Type>;
  }) => Effect.Effect<
    ReadonlyArray<typeof AnalyticsInsightQueryResult.Type>,
    AnalyticsQueryFailure,
    AuthSession
  >;
}

export type AnalyticsQueryFailure =
  | AnalyticsQueryError
  | AnalyticsAuthorizationDeniedError
  | InvalidAnalyticsQueryError
  | InvalidTimeRangeError
  | UnknownInsightError
  | UnsupportedAnalyticsBreakdownError
  | UnsupportedAnalyticsFilterError;

const MAX_QUERIES_PER_BATCH = 20;

const makeAnalyticsQuery = Effect.gen(function* () {
  const authorizer = yield* AnalyticsAuthorizer;
  const config = yield* AnalyticsConfig;
  const store = yield* AnalyticsStore;
  const portError = (error: AnalyticsPortError) =>
    new AnalyticsQueryError({ cause: String(error.cause), message: error.message });

  const run = (
    availableProjectIds: ReadonlyArray<string>,
    query: typeof AnalyticsInsightRequest.Type,
  ) =>
    Effect.gen(function* () {
      const insight = yield* getBuiltInInsight(query.insightId);
      yield* ensureNoBreakdowns(query.breakdowns);
      if (query.limit !== undefined) {
        return yield* new InvalidAnalyticsQueryError({
          message: "Limit is not supported for metric insights",
        });
      }
      const resolvedTimeRange = yield* resolveTimeRange(query.timeRange);
      const compiledFilter: CompiledAnalyticsFilter = yield* compileAnalyticsFilter({
        availableProjectIds: [...availableProjectIds],
        filter: query.filter,
        supportedFields: insight.supportedFilterFields,
      });
      if (insight.supportedFilterFields.includes("provider.environment")) {
        compiledFilter.providerEnvironments = (
          compiledFilter.providerEnvironments ?? [...config.providerEnvironments]
        ).filter((environment) => config.providerEnvironments.includes(environment));
      }
      const granularity = query.granularity ?? insight.defaultGranularity;
      if (!insight.supportedGranularities.includes(granularity)) {
        return yield* new InvalidAnalyticsQueryError({
          message: `Granularity ${granularity} is not supported for ${query.insightId}`,
        });
      }
      const events = yield* store
        .list({
          end: resolvedTimeRange.end,
          limit: QUERY_EVENT_LIMIT + 1,
          order: "asc",
          projectIds: compiledFilter.projectIds,
          ...(!HISTORY_INSIGHTS.has(query.insightId) && { start: resolvedTimeRange.start }),
        })
        .pipe(Effect.mapError(portError));
      if (events.length > QUERY_EVENT_LIMIT) {
        return yield* new AnalyticsQueryError({
          cause: "query_event_limit_exceeded",
          message: `The selected time range contains more than ${QUERY_EVENT_LIMIT} events; narrow the range or coarsen the granularity instead of relying on partial results`,
        });
      }
      const series = resolvePortableAnalyticsSeries({
        end: resolvedTimeRange.end,
        events,
        filters: compiledFilter,
        granularity,
        insightId: query.insightId,
        start: resolvedTimeRange.start,
      });
      let summaryValue = sumDataPoints(series);
      if (RATE_INSIGHTS.has(query.insightId)) summaryValue = avgDataPoints(series);
      else if (STOCK_INSIGHTS.has(query.insightId))
        summaryValue = series[series.length - 1]?.value ?? 0;
      return {
        insightId: query.insightId,
        key: query.key,
        resolvedTimeRange,
        result: {
          kind: "metric",
          sparkline: series,
          summary: {
            ...(CURRENCY_INSIGHTS.has(query.insightId) && { currency: "USD" }),
            value: summaryValue,
          },
        },
      } satisfies typeof AnalyticsInsightQueryResult.Type;
    });

  const runMany = (
    availableProjectIds: ReadonlyArray<string>,
    queries: ReadonlyArray<typeof AnalyticsInsightRequest.Type>,
  ) =>
    Effect.gen(function* () {
      if (queries.length > MAX_QUERIES_PER_BATCH) {
        return yield* new InvalidAnalyticsQueryError({
          message: `At most ${MAX_QUERIES_PER_BATCH} insight queries are allowed per batch`,
        });
      }
      return yield* Effect.forEach(queries, (query) => run(availableProjectIds, query));
    });

  const identityKey = (event: typeof StoredAnalyticsEvent.Type) =>
    event.personId ?? event.distinctId;

  const revenueUsd = (event: typeof StoredAnalyticsEvent.Type) => {
    if (!isRevenueMoneyEventName(event.eventName)) return 0;
    const value = event.properties.grossAmountUsd ?? event.properties.amountUsd;
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return value / 100;
  };

  return {
    getExperimentResults: (request) =>
      Effect.gen(function* () {
        yield* authorizer
          .requireProject(request.projectId)
          .pipe(Effect.catchTag("AnalyticsPortError", portError));
        const events = yield* store
          .list({
            end: request.end,
            limit: QUERY_EVENT_LIMIT + 1,
            order: "asc",
            projectIds: [request.projectId],
            start: request.start,
          })
          .pipe(Effect.mapError(portError));
        if (events.length > QUERY_EVENT_LIMIT) {
          return yield* new AnalyticsQueryError({
            cause: "query_event_limit_exceeded",
            message: `The selected time range contains more than ${QUERY_EVENT_LIMIT} events; narrow the range instead of relying on partial results`,
          });
        }
        const exposures = new Map<
          string,
          { readonly timestamp: Date; readonly variantKey: string }
        >();
        for (const event of events) {
          if (event.eventName !== "$experiment.exposed") continue;
          if (event.properties.experimentId !== request.experimentId) continue;
          if (typeof event.properties.variantKey !== "string") continue;
          const key = identityKey(event);
          const current = exposures.get(key);
          if (!current || event.eventTimestamp < current.timestamp) {
            exposures.set(key, {
              timestamp: event.eventTimestamp,
              variantKey: event.properties.variantKey,
            });
          }
        }
        const results = new Map<
          string,
          { conversions: Set<string>; exposures: number; revenueUsd: number }
        >();
        for (const exposure of exposures.values()) {
          const current = results.get(exposure.variantKey);
          if (current) current.exposures += 1;
          else {
            results.set(exposure.variantKey, {
              conversions: new Set(),
              exposures: 1,
              revenueUsd: 0,
            });
          }
        }
        for (const event of events) {
          const key = identityKey(event);
          const exposure = exposures.get(key);
          if (!exposure || event.eventTimestamp < exposure.timestamp) continue;
          const result = results.get(exposure.variantKey);
          if (!result) continue;
          if (event.eventName === request.primaryMetricEventName) result.conversions.add(key);
          result.revenueUsd += revenueUsd(event);
        }
        return {
          variants: [...results.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([variantKey, result]) => {
              const conversions = result.conversions.size;
              let conversionRate = 0;
              if (result.exposures > 0) conversionRate = conversions / result.exposures;
              return {
                conversionRate,
                conversions,
                exposures: result.exposures,
                revenueUsd: result.revenueUsd,
                variantKey,
              };
            }),
        };
      }),
    listEventsPage: (request) =>
      Effect.gen(function* () {
        yield* authorizer
          .requireProject(request.projectId)
          .pipe(Effect.catchTag("AnalyticsPortError", portError));
        const limit = Math.min(Math.max(request.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
        const eventNames: string[] = [];
        if (request.eventName) eventNames.push(request.eventName);
        const page = yield* store
          .listPage({
            afterEventId: request.afterEventId,
            eventNames,
            limit,
            projectIds: [request.projectId],
          })
          .pipe(Effect.mapError(portError));
        return { events: page.events.map(listItem), hasNextPage: page.hasNextPage };
      }),
    listRecentEvents: (request) =>
      Effect.gen(function* () {
        yield* authorizer
          .requireProject(request.projectId)
          .pipe(Effect.catchTag("AnalyticsPortError", portError));
        const limit = Math.min(Math.max(request.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
        const events = yield* store
          .list({ limit: limit + 1, order: "desc", projectIds: [request.projectId] })
          .pipe(Effect.mapError(portError));
        return { events: events.slice(0, limit).map(listItem), hasMore: events.length > limit };
      }),
    queryOrganization: (request) =>
      authorizer.organizationProjects(request.organizationId).pipe(
        Effect.catchTag("AnalyticsPortError", portError),
        Effect.flatMap((projectIds) => runMany(projectIds, request.queries)),
      ),
    queryProject: (request) =>
      authorizer.requireProject(request.projectId).pipe(
        Effect.catchTag("AnalyticsPortError", portError),
        Effect.flatMap(() => runMany([request.projectId], request.queries)),
      ),
  } satisfies AnalyticsQueryShape;
});

/** Analytics query use case whose implementation dependencies are supplied by layers. */
export class AnalyticsQuery extends Context.Service<AnalyticsQuery, AnalyticsQueryShape>()(
  "@voidhash/core-v2/analytics/AnalyticsQuery",
  { make: makeAnalyticsQuery },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(AnalyticsQuery)(AnalyticsQuery.make);
}
