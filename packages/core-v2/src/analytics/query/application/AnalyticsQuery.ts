import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Order from "effect/Order";
import type { AuthSession, CustomAnalyticsInsightQueryType } from "@voidhash/rpc";

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
import { buildPathsLinkResults, validateExecutablePathsDefinition } from "./CustomAnalytics.ts";
import { SCREEN_PATH_EVENT_NAME, resolvePathsInsight } from "./paths-resolver.ts";
import { isRevenueMoneyEventName } from "../../domain/InternalAnalyticsEvents.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const QUERY_EVENT_LIMIT = 100_000;
const HISTORY_INSIGHTS = HashSet.make(
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
);

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
export type AnalyticsInsightQueryResult = typeof AnalyticsInsightQueryResult.Type;

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
export type AnalyticsEventListItem = typeof AnalyticsEventListItem.Type;

export const ExperimentAnalyticsVariant = Schema.Struct({
  conversionRate: Schema.Number,
  conversions: Schema.Int,
  exposures: Schema.Int,
  revenueUsd: Schema.Number,
  variantKey: Schema.String,
});
export type ExperimentAnalyticsVariant = typeof ExperimentAnalyticsVariant.Type;

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
  /**
   * Executes a paths insight over the project's stored events. `pathItem:
   * "screen_name"` walks `$screen` events by their `$screen_name`;
   * `event_name` (the default) walks event names.
   */
  readonly queryPaths: (input: {
    readonly definition: CustomAnalyticsInsightQueryType;
    readonly projectId: string;
  }) => Effect.Effect<PathsInsightQueryResult, AnalyticsQueryFailure, AuthSession>;
}

export interface PathsInsightQueryResult {
  readonly kind: "paths";
  readonly links: ReadonlyArray<{
    readonly averageTransitionSeconds: number;
    readonly count: number;
    readonly source: string;
    readonly sourceStep: number;
    readonly target: string;
    readonly targetStep: number;
  }>;
  readonly maxDepth: number;
  readonly resolvedTimeRange: { readonly end: Date; readonly start: Date };
  readonly sessionGapSeconds: number;
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

const makeAnalyticsQuery = Effect.fn("makeAnalyticsQuery")(function* () {
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
      yield* ensureNoBreakdowns(Option.fromNullishOr(query.breakdowns));
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
          ...(!HashSet.has(HISTORY_INSIGHTS, query.insightId) && { start: resolvedTimeRange.start }),
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
      if (HashSet.has(RATE_INSIGHTS, query.insightId)) summaryValue = avgDataPoints(series);
      else if (HashSet.has(STOCK_INSIGHTS, query.insightId))
        summaryValue = series[series.length - 1]?.value ?? 0;
      return {
        insightId: query.insightId,
        key: query.key,
        resolvedTimeRange,
        result: {
          kind: "metric",
          sparkline: series,
          summary: {
            ...(HashSet.has(CURRENCY_INSIGHTS, query.insightId) && { currency: "USD" }),
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
      return yield* Effect.forEach(queries, (query) => run(availableProjectIds, query), {
        concurrency: 1,
      });
    });

  const identityKey = (event: typeof StoredAnalyticsEvent.Type) =>
    event.personId ?? event.distinctId;

  const revenueUsd = (event: typeof StoredAnalyticsEvent.Type) => {
    if (!isRevenueMoneyEventName(event.eventName)) return 0;
    const value = event.properties.grossAmountUsd ?? event.properties.amountUsd;
    if (!P.isNumber(value) || !Number.isFinite(value)) return 0;
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
        const exposures = Arr.reduce(
          events,
          HashMap.empty<string, { readonly timestamp: Date; readonly variantKey: string }>(),
          (all, event) => {
          if (event.eventName !== "$experiment.exposed") return all;
          if (event.properties.experimentId !== request.experimentId) return all;
          if (!P.isString(event.properties.variantKey)) return all;
          const key = identityKey(event);
          const current = HashMap.get(all, key);
          if (Option.isNone(current) || event.eventTimestamp < current.value.timestamp) {
            return HashMap.set(all, key, {
              timestamp: event.eventTimestamp,
              variantKey: event.properties.variantKey,
            });
          }
          return all;
        });
        const initialResults = Arr.reduce(
          Arr.fromIterable(HashMap.values(exposures)),
          HashMap.empty<
            string,
            { conversions: HashSet.HashSet<string>; exposures: number; revenueUsd: number }
          >(),
          (all, exposure) => {
            const current = HashMap.get(all, exposure.variantKey);
            return HashMap.set(all, exposure.variantKey, {
              conversions: Option.match(current, {
                onNone: () => HashSet.empty(),
                onSome: (value) => value.conversions,
              }),
              exposures: Option.match(current, {
                onNone: () => 1,
                onSome: (value) => value.exposures + 1,
              }),
              revenueUsd: Option.match(current, {
                onNone: () => 0,
                onSome: (value) => value.revenueUsd,
              }),
            });
          },
        );
        const results = Arr.reduce(events, initialResults, (all, event) => {
          const key = identityKey(event);
          const exposure = HashMap.get(exposures, key);
          if (Option.isNone(exposure) || event.eventTimestamp < exposure.value.timestamp) return all;
          const result = HashMap.get(all, exposure.value.variantKey);
          if (Option.isNone(result)) return all;
          return HashMap.set(all, exposure.value.variantKey, {
            conversions:
              event.eventName === request.primaryMetricEventName
                ? HashSet.add(result.value.conversions, key)
                : result.value.conversions,
            exposures: result.value.exposures,
            revenueUsd: result.value.revenueUsd + revenueUsd(event),
          });
        });
        return {
          variants: Arr.sort(
            Arr.fromIterable(results),
            Order.mapInput(
              Order.String,
              (entry: readonly [string, { conversions: HashSet.HashSet<string>; exposures: number; revenueUsd: number }]) => entry[0],
            ),
          )
            .map(([variantKey, result]) => {
              const conversions = HashSet.size(result.conversions);
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
    queryPaths: (request) =>
      Effect.gen(function* () {
        yield* authorizer
          .requireProject(request.projectId)
          .pipe(Effect.catchTag("AnalyticsPortError", portError));
        const definition = yield* validateExecutablePathsDefinition(request.definition);
        if (Arr.isReadonlyArrayNonEmpty(definition.cohortIds ?? [])) {
          return yield* new InvalidAnalyticsQueryError({
            message: "Cohort filters are not supported for paths yet",
          });
        }
        const resolvedTimeRange = yield* resolveTimeRange(definition.timeRange);
        const sessionGapSeconds = definition.sessionGapSeconds ?? 1_800;
        // Screen paths only ever read `$screen`; event paths narrow the scan
        // to the requested names when an allow-list is given. Start and end
        // markers ride along so they are not silently missing from the scan.
        const eventNames: Option.Option<ReadonlyArray<string>> =
          definition.pathItem === "screen_name"
            ? Option.some([SCREEN_PATH_EVENT_NAME])
            : Arr.match(definition.eventNames, {
                onEmpty: () => Option.none(),
                onNonEmpty: (names) =>
                  Option.some(
                    Arr.dedupe([
                      ...names,
                      ...Arr.fromNullishOr(definition.startEventName),
                      ...Arr.fromNullishOr(definition.endEventName),
                    ]),
                  ),
              });
        const events = yield* store
          .list({
            end: resolvedTimeRange.end,
            ...(Option.isSome(eventNames) && { eventNames: eventNames.value }),
            limit: QUERY_EVENT_LIMIT + 1,
            order: "asc",
            projectIds: [request.projectId],
            start: resolvedTimeRange.start,
          })
          .pipe(Effect.mapError(portError));
        if (events.length > QUERY_EVENT_LIMIT) {
          return yield* new AnalyticsQueryError({
            cause: "query_event_limit_exceeded",
            message: `The selected time range contains more than ${QUERY_EVENT_LIMIT} events; narrow the range instead of relying on partial results`,
          });
        }
        return {
          kind: "paths",
          links: buildPathsLinkResults(resolvePathsInsight({ definition, events })),
          maxDepth: definition.maxDepth,
          resolvedTimeRange,
          sessionGapSeconds,
        } satisfies PathsInsightQueryResult;
      }),
    queryProject: (request) =>
      authorizer.requireProject(request.projectId).pipe(
        Effect.catchTag("AnalyticsPortError", portError),
        Effect.flatMap(() => runMany([request.projectId], request.queries)),
      ),
  } satisfies AnalyticsQueryShape;
})();

/** Analytics query use case whose implementation dependencies are supplied by layers. */
export class AnalyticsQuery extends Context.Service<AnalyticsQuery, AnalyticsQueryShape>()(
  "@voidhash/core-v2/analytics/AnalyticsQuery",
  { make: makeAnalyticsQuery },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(AnalyticsQuery)(AnalyticsQuery.make);
}
