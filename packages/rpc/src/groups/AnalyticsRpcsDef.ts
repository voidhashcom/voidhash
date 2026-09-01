import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import {
  RpcAnalyticsServiceError,
  RpcInvalidAnalyticsQueryError,
  RpcInvalidTimeRangeError,
  RpcUnknownInsightError,
  RpcUnsupportedAnalyticsBreakdownError,
  RpcUnsupportedAnalyticsFilterError,
} from "../errors/analytics.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import { AuthMiddleware } from "../middlewares.ts";
import { SavedVoidQlInsight } from "./VoidQlRpcsDef.ts";

export const AnalyticsContext = Schema.Struct({
  organizationId: Schema.String,
});
export type AnalyticsContext = typeof AnalyticsContext.Type;
export type AnalyticsContextType = typeof AnalyticsContext.Type;

export const AnalyticsGranularity = Schema.Union([
  Schema.Literal("hour"),
  Schema.Literal("day"),
  Schema.Literal("week"),
  Schema.Literal("month"),
  Schema.Literal("quarter"),
  Schema.Literal("year"),
]);
export type AnalyticsGranularity = typeof AnalyticsGranularity.Type;
export type AnalyticsGranularityType = typeof AnalyticsGranularity.Type;

export const AnalyticsTimeRangePreset = Schema.Union([
  Schema.Literal("today"),
  Schema.Literal("last_7d"),
  Schema.Literal("last_30d"),
  Schema.Literal("last_90d"),
  Schema.Literal("last_365d"),
  Schema.Literal("mtd"),
  Schema.Literal("qtd"),
  Schema.Literal("ytd"),
]);
export type AnalyticsTimeRangePreset = typeof AnalyticsTimeRangePreset.Type;

export const AnalyticsTimeRange = Schema.Union([
  Schema.Struct({
    preset: AnalyticsTimeRangePreset,
  }),
  Schema.Struct({
    end: Schema.Date,
    preset: Schema.Literal("custom"),
    start: Schema.Date,
  }),
]);
export type AnalyticsTimeRange = typeof AnalyticsTimeRange.Type;
export type AnalyticsTimeRangeType = typeof AnalyticsTimeRange.Type;

export const AnalyticsFieldRef = Schema.String;
export type AnalyticsFieldRef = typeof AnalyticsFieldRef.Type;
export type AnalyticsFieldRefType = typeof AnalyticsFieldRef.Type;

const AnalyticsFieldValuePrimitive = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]);

export const AnalyticsFieldValue = Schema.Union([
  AnalyticsFieldValuePrimitive,
  Schema.Array(AnalyticsFieldValuePrimitive),
]);
export type AnalyticsFieldValue = typeof AnalyticsFieldValue.Type;
export type AnalyticsFieldValueType = typeof AnalyticsFieldValue.Type;

export const AnalyticsFilterPredicate = Schema.Struct({
  field: AnalyticsFieldRef,
  op: Schema.Union([
    Schema.Literal("eq"),
    Schema.Literal("neq"),
    Schema.Literal("in"),
    Schema.Literal("not_in"),
    Schema.Literal("gt"),
    Schema.Literal("gte"),
    Schema.Literal("lt"),
    Schema.Literal("lte"),
    Schema.Literal("contains"),
    Schema.Literal("exists"),
  ]),
  type: Schema.Literal("predicate"),
  value: Schema.optional(AnalyticsFieldValue),
});
export type AnalyticsFilterPredicate = typeof AnalyticsFilterPredicate.Type;

export type AnalyticsFilterType =
  | typeof AnalyticsFilterPredicate.Type
  | {
      readonly filters: ReadonlyArray<AnalyticsFilterType>;
      readonly type: "and" | "or";
    }
  | {
      readonly filter: AnalyticsFilterType;
      readonly type: "not";
    };

// `Schema.Schema<T>` extends `Top` which has `unknown` for `DecodingServices`
// and `EncodingServices`. Annotating with `Schema.Codec<T, T, never, never>`
// keeps those service requirements as `never` so they don't pollute callers.
type AnalyticsFilterCodec = Schema.Codec<AnalyticsFilterType, AnalyticsFilterType, never, never>;

export const AnalyticsFilter: AnalyticsFilterCodec = Schema.Union([
  AnalyticsFilterPredicate,
  Schema.Struct({
    filters: Schema.Array(Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter)),
    type: Schema.Literal("and"),
  }),
  Schema.Struct({
    filters: Schema.Array(Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter)),
    type: Schema.Literal("or"),
  }),
  Schema.Struct({
    filter: Schema.suspend((): AnalyticsFilterCodec => AnalyticsFilter),
    type: Schema.Literal("not"),
  }),
]);
export type AnalyticsFilter = typeof AnalyticsFilter.Type;

export const AnalyticsBreakdown = Schema.Struct({
  field: AnalyticsFieldRef,
  limit: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  order: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
});
export type AnalyticsBreakdown = typeof AnalyticsBreakdown.Type;
export type AnalyticsBreakdownType = typeof AnalyticsBreakdown.Type;

export const AnalyticsActor = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("person") }),
  Schema.Struct({
    kind: Schema.Literal("group"),
    property: Schema.String.check(Schema.isMaxLength(128)),
  }),
]);
export type AnalyticsActor = typeof AnalyticsActor.Type;
export type AnalyticsActorType = typeof AnalyticsActor.Type;

const AnalyticsCohortIds = Schema.Array(Schema.String).check(Schema.isMaxLength(20));

export const CustomAnalyticsInsightKind = Schema.Union([
  Schema.Literal("trends"),
  Schema.Literal("funnels"),
  Schema.Literal("retention"),
  Schema.Literal("paths"),
  Schema.Literal("stickiness"),
  Schema.Literal("lifecycle"),
]);
export type CustomAnalyticsInsightKind = typeof CustomAnalyticsInsightKind.Type;
export type CustomAnalyticsInsightKindType = typeof CustomAnalyticsInsightKind.Type;

export const AnalyticsEventSeries = Schema.Struct({
  aggregation: Schema.Union([
    Schema.Literal("total_events"),
    Schema.Literal("unique_users"),
    Schema.Literal("property_sum"),
    Schema.Literal("property_average"),
    Schema.Literal("property_minimum"),
    Schema.Literal("property_maximum"),
    Schema.Literal("property_median"),
    Schema.Literal("property_p75"),
    Schema.Literal("property_p90"),
    Schema.Literal("property_p95"),
    Schema.Literal("property_p99"),
  ]),
  eventNames: Schema.NonEmptyArray(Schema.String.check(Schema.isMaxLength(255))),
  filters: Schema.optional(AnalyticsFilter),
  key: Schema.String.check(Schema.isMaxLength(64)),
  label: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  mathProperty: Schema.optional(Schema.String.check(Schema.isMaxLength(128))),
});
export type AnalyticsEventSeries = typeof AnalyticsEventSeries.Type;
export type AnalyticsEventSeriesType = typeof AnalyticsEventSeries.Type;

export const AnalyticsTrendsComparison = Schema.Union([
  Schema.Literal("previous_period"),
  Schema.Literal("previous_year"),
]);
export type AnalyticsTrendsComparison = typeof AnalyticsTrendsComparison.Type;
export type AnalyticsTrendsComparisonType = typeof AnalyticsTrendsComparison.Type;

export const AnalyticsTrendsFormula = Schema.Struct({
  expression: Schema.String.check(Schema.isMaxLength(512)),
  key: Schema.String.check(Schema.isMaxLength(64)),
  label: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type AnalyticsTrendsFormula = typeof AnalyticsTrendsFormula.Type;
export type AnalyticsTrendsFormulaType = typeof AnalyticsTrendsFormula.Type;

export const TrendsInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  breakdown: Schema.optional(AnalyticsBreakdown),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  comparison: Schema.optional(AnalyticsTrendsComparison),
  cumulative: Schema.optional(Schema.Boolean),
  display: Schema.Union([
    Schema.Literal("line"),
    Schema.Literal("bar"),
    Schema.Literal("area"),
    Schema.Literal("number"),
  ]),
  formulas: Schema.optional(Schema.Array(AnalyticsTrendsFormula)),
  granularity: AnalyticsGranularity,
  kind: Schema.Literal("trends"),
  hideWeekends: Schema.optional(Schema.Boolean),
  series: Schema.NonEmptyArray(AnalyticsEventSeries),
  smoothingWindow: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(28)),
  ),
  timeRange: AnalyticsTimeRange,
});
export type TrendsInsightQuery = typeof TrendsInsightQuery.Type;
export type TrendsInsightQueryType = typeof TrendsInsightQuery.Type;

export const FunnelStep = Schema.Struct({
  eventNames: Schema.NonEmptyArray(Schema.String.check(Schema.isMaxLength(255))),
  filters: Schema.optional(AnalyticsFilter),
  key: Schema.String.check(Schema.isMaxLength(64)),
  label: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type FunnelStep = typeof FunnelStep.Type;

export const FunnelsInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  breakdown: Schema.optional(AnalyticsBreakdown),
  breakdownAttributionStep: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(20)),
  ),
  conversionWindowSeconds: Schema.Number.check(Schema.isGreaterThan(0)),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  kind: Schema.Literal("funnels"),
  order: Schema.Union([
    Schema.Literal("sequential"),
    Schema.Literal("strict"),
    Schema.Literal("any"),
  ]),
  steps: Schema.NonEmptyArray(FunnelStep),
  timeRange: AnalyticsTimeRange,
});
export type FunnelsInsightQuery = typeof FunnelsInsightQuery.Type;
export type FunnelsInsightQueryType = typeof FunnelsInsightQuery.Type;

export const RetentionInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  cumulative: Schema.optional(Schema.Boolean),
  intervals: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(24)),
  ),
  kind: Schema.Literal("retention"),
  period: Schema.Union([Schema.Literal("day"), Schema.Literal("week"), Schema.Literal("month")]),
  reference: Schema.optional(Schema.Union([Schema.Literal("cohort"), Schema.Literal("previous")])),
  returning: AnalyticsEventSeries,
  retentionType: Schema.optional(
    Schema.Union([Schema.Literal("recurring"), Schema.Literal("first_time")]),
  ),
  start: AnalyticsEventSeries,
  timeRange: AnalyticsTimeRange,
});
export type RetentionInsightQuery = typeof RetentionInsightQuery.Type;
export type RetentionInsightQueryType = typeof RetentionInsightQuery.Type;

export const PathsInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  collapseRepeated: Schema.optional(Schema.Boolean),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  edgeLimit: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(200)),
  ),
  endEventName: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  eventNames: Schema.Array(Schema.String.check(Schema.isMaxLength(255))),
  excludeEventNames: Schema.optional(Schema.Array(Schema.String.check(Schema.isMaxLength(255)))),
  filters: Schema.optional(AnalyticsFilter),
  kind: Schema.Literal("paths"),
  maxDepth: Schema.Number.check(Schema.isGreaterThanOrEqualTo(2), Schema.isLessThanOrEqualTo(20)),
  maxEdgeCount: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(1))),
  minEdgeCount: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(1))),
  pathItem: Schema.optional(
    Schema.Union([Schema.Literal("event_name"), Schema.Literal("screen_name")]),
  ),
  sessionGapSeconds: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(60), Schema.isLessThanOrEqualTo(86_400)),
  ),
  startEventName: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  timeRange: AnalyticsTimeRange,
});
export type PathsInsightQuery = typeof PathsInsightQuery.Type;
export type PathsInsightQueryType = typeof PathsInsightQuery.Type;

export const StickinessInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  computation: Schema.optional(
    Schema.Union([Schema.Literal("exact"), Schema.Literal("cumulative")]),
  ),
  display: Schema.optional(Schema.Union([Schema.Literal("line"), Schema.Literal("bar")])),
  interval: Schema.Union([
    Schema.Literal("hour"),
    Schema.Literal("day"),
    Schema.Literal("week"),
    Schema.Literal("month"),
  ]),
  kind: Schema.Literal("stickiness"),
  occurrenceCriteria: Schema.optional(
    Schema.Struct({
      operator: Schema.Union([
        Schema.Literal("exact"),
        Schema.Literal("gte"),
        Schema.Literal("lte"),
      ]),
      value: Schema.Number.check(
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(10_000),
      ),
    }),
  ),
  series: Schema.NonEmptyArray(AnalyticsEventSeries),
  timeRange: AnalyticsTimeRange,
});
export type StickinessInsightQuery = typeof StickinessInsightQuery.Type;
export type StickinessInsightQueryType = typeof StickinessInsightQuery.Type;

export const LifecycleInsightQuery = Schema.Struct({
  actor: Schema.optional(AnalyticsActor),
  cohortIds: Schema.optional(AnalyticsCohortIds),
  display: Schema.optional(Schema.Union([Schema.Literal("stacked_area"), Schema.Literal("line")])),
  granularity: Schema.Union([
    Schema.Literal("hour"),
    Schema.Literal("day"),
    Schema.Literal("week"),
    Schema.Literal("month"),
  ]),
  kind: Schema.Literal("lifecycle"),
  series: AnalyticsEventSeries,
  statuses: Schema.optional(
    Schema.NonEmptyArray(
      Schema.Union([
        Schema.Literal("new"),
        Schema.Literal("returning"),
        Schema.Literal("resurrecting"),
        Schema.Literal("dormant"),
      ]),
    ),
  ),
  timeRange: AnalyticsTimeRange,
  valueMode: Schema.optional(Schema.Union([Schema.Literal("count"), Schema.Literal("percentage")])),
});
export type LifecycleInsightQuery = typeof LifecycleInsightQuery.Type;
export type LifecycleInsightQueryType = typeof LifecycleInsightQuery.Type;

export const CustomAnalyticsInsightQuery = Schema.Union([
  TrendsInsightQuery,
  FunnelsInsightQuery,
  RetentionInsightQuery,
  PathsInsightQuery,
  StickinessInsightQuery,
  LifecycleInsightQuery,
]);
export type CustomAnalyticsInsightQuery = typeof CustomAnalyticsInsightQuery.Type;
export type CustomAnalyticsInsightQueryType = typeof CustomAnalyticsInsightQuery.Type;

export const SavedAnalyticsInsight = Schema.Struct({
  createdAt: Schema.Date,
  createdBy: Schema.String,
  definition: CustomAnalyticsInsightQuery,
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  kind: CustomAnalyticsInsightKind,
  name: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  updatedAt: Schema.Date,
});
export type SavedAnalyticsInsight = typeof SavedAnalyticsInsight.Type;
export type SavedAnalyticsInsightType = typeof SavedAnalyticsInsight.Type;

export const AnalyticsTrendSeriesResult = Schema.Struct({
  comparison: Schema.optional(
    Schema.Union([
      Schema.Literal("current"),
      Schema.Literal("previous_period"),
      Schema.Literal("previous_year"),
    ]),
  ),
  key: Schema.String,
  label: Schema.String,
  points: Schema.Array(
    Schema.Struct({
      timestamp: Schema.Date,
      value: Schema.Number,
    }),
  ),
});
export type AnalyticsTrendSeriesResult = typeof AnalyticsTrendSeriesResult.Type;

export const QueryCustomAnalyticsInsightRequest = Schema.Struct({
  definition: CustomAnalyticsInsightQuery,
  projectId: Schema.String,
});
export type QueryCustomAnalyticsInsightRequest = typeof QueryCustomAnalyticsInsightRequest.Type;
export type QueryCustomAnalyticsInsightRequestType = typeof QueryCustomAnalyticsInsightRequest.Type;

export const QueryCustomAnalyticsPersonsRequest = Schema.Struct({
  cohortIds: Schema.optional(AnalyticsCohortIds),
  eventNames: Schema.NonEmptyArray(Schema.String).check(Schema.isMaxLength(20)),
  filters: Schema.optional(AnalyticsFilter),
  group: Schema.optional(
    Schema.Struct({
      property: Schema.String.check(Schema.isMaxLength(128)),
      value: Schema.String.check(Schema.isMaxLength(512)),
    }),
  ),
  limit: Schema.optional(
    Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  projectId: Schema.String,
  timeRange: AnalyticsTimeRange,
});
export type QueryCustomAnalyticsPersonsRequest = typeof QueryCustomAnalyticsPersonsRequest.Type;
export type QueryCustomAnalyticsPersonsRequestType = typeof QueryCustomAnalyticsPersonsRequest.Type;

export const AnalyticsDrilldownPerson = Schema.Struct({
  email: Schema.NullOr(Schema.String),
  eventCount: Schema.Number,
  lastSeenAt: Schema.Date,
  name: Schema.NullOr(Schema.String),
  personId: Schema.String,
});
export type AnalyticsDrilldownPerson = typeof AnalyticsDrilldownPerson.Type;

export const QueryCustomAnalyticsPersonsResponse = Schema.Struct({
  people: Schema.Array(AnalyticsDrilldownPerson),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
});
export type QueryCustomAnalyticsPersonsResponse = typeof QueryCustomAnalyticsPersonsResponse.Type;
export type QueryCustomAnalyticsPersonsResponseType =
  typeof QueryCustomAnalyticsPersonsResponse.Type;

export const AnalyticsTrendsInsightResult = Schema.Struct({
  comparisonTimeRange: Schema.optional(Schema.Struct({ end: Schema.Date, start: Schema.Date })),
  kind: Schema.Literal("trends"),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
  series: Schema.Array(AnalyticsTrendSeriesResult),
});
export type AnalyticsTrendsInsightResult = typeof AnalyticsTrendsInsightResult.Type;

export const AnalyticsFunnelStepResult = Schema.Struct({
  conversionRate: Schema.Number,
  count: Schema.Number,
  dropoffCount: Schema.Number,
  dropoffRate: Schema.Number,
  key: Schema.String,
  label: Schema.String,
  step: Schema.Number,
});
export type AnalyticsFunnelStepResult = typeof AnalyticsFunnelStepResult.Type;

export const AnalyticsFunnelBreakdownResult = Schema.Struct({
  breakdownValue: Schema.String,
  steps: Schema.Array(AnalyticsFunnelStepResult),
  totalConversionRate: Schema.Number,
});
export type AnalyticsFunnelBreakdownResult = typeof AnalyticsFunnelBreakdownResult.Type;

export const AnalyticsFunnelsInsightResult = Schema.Struct({
  breakdowns: Schema.optional(Schema.Array(AnalyticsFunnelBreakdownResult)),
  kind: Schema.Literal("funnels"),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
  steps: Schema.Array(AnalyticsFunnelStepResult),
  totalConversionRate: Schema.Number,
});
export type AnalyticsFunnelsInsightResult = typeof AnalyticsFunnelsInsightResult.Type;

export const AnalyticsRetentionCell = Schema.Struct({
  count: Schema.Number,
  interval: Schema.Number,
  rate: Schema.Number,
});
export type AnalyticsRetentionCell = typeof AnalyticsRetentionCell.Type;

export const AnalyticsRetentionCohort = Schema.Struct({
  cells: Schema.Array(AnalyticsRetentionCell),
  cohortSize: Schema.Number,
  cohortStart: Schema.Date,
});
export type AnalyticsRetentionCohort = typeof AnalyticsRetentionCohort.Type;

export const AnalyticsRetentionInsightResult = Schema.Struct({
  cohorts: Schema.Array(AnalyticsRetentionCohort),
  kind: Schema.Literal("retention"),
  period: Schema.Union([Schema.Literal("day"), Schema.Literal("week"), Schema.Literal("month")]),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
});
export type AnalyticsRetentionInsightResult = typeof AnalyticsRetentionInsightResult.Type;

export const AnalyticsStickinessBucket = Schema.Struct({
  count: Schema.Number,
  intervals: Schema.Number,
});
export type AnalyticsStickinessBucket = typeof AnalyticsStickinessBucket.Type;

export const AnalyticsStickinessSeriesResult = Schema.Struct({
  buckets: Schema.Array(AnalyticsStickinessBucket),
  key: Schema.String,
  label: Schema.String,
});
export type AnalyticsStickinessSeriesResult = typeof AnalyticsStickinessSeriesResult.Type;

export const AnalyticsStickinessInsightResult = Schema.Struct({
  computation: Schema.Union([Schema.Literal("exact"), Schema.Literal("cumulative")]),
  interval: Schema.Union([
    Schema.Literal("hour"),
    Schema.Literal("day"),
    Schema.Literal("week"),
    Schema.Literal("month"),
  ]),
  kind: Schema.Literal("stickiness"),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
  series: Schema.Array(AnalyticsStickinessSeriesResult),
});
export type AnalyticsStickinessInsightResult = typeof AnalyticsStickinessInsightResult.Type;

export const AnalyticsPathsLink = Schema.Struct({
  averageTransitionSeconds: Schema.Number,
  count: Schema.Number,
  source: Schema.String,
  sourceStep: Schema.Number,
  target: Schema.String,
  targetStep: Schema.Number,
});
export type AnalyticsPathsLink = typeof AnalyticsPathsLink.Type;

export const AnalyticsPathsInsightResult = Schema.Struct({
  kind: Schema.Literal("paths"),
  links: Schema.Array(AnalyticsPathsLink),
  maxDepth: Schema.Number,
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
  sessionGapSeconds: Schema.Number,
});
export type AnalyticsPathsInsightResult = typeof AnalyticsPathsInsightResult.Type;

export const AnalyticsLifecycleStatusSeries = Schema.Struct({
  points: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      timestamp: Schema.Date,
    }),
  ),
  status: Schema.Union([
    Schema.Literal("new"),
    Schema.Literal("returning"),
    Schema.Literal("resurrecting"),
    Schema.Literal("dormant"),
  ]),
});
export type AnalyticsLifecycleStatusSeries = typeof AnalyticsLifecycleStatusSeries.Type;

export const AnalyticsLifecycleInsightResult = Schema.Struct({
  granularity: Schema.Union([
    Schema.Literal("hour"),
    Schema.Literal("day"),
    Schema.Literal("week"),
    Schema.Literal("month"),
  ]),
  kind: Schema.Literal("lifecycle"),
  resolvedTimeRange: Schema.Struct({ end: Schema.Date, start: Schema.Date }),
  series: Schema.Array(AnalyticsLifecycleStatusSeries),
});
export type AnalyticsLifecycleInsightResult = typeof AnalyticsLifecycleInsightResult.Type;

export const QueryCustomAnalyticsInsightResponse = Schema.Union([
  AnalyticsTrendsInsightResult,
  AnalyticsFunnelsInsightResult,
  AnalyticsRetentionInsightResult,
  AnalyticsPathsInsightResult,
  AnalyticsStickinessInsightResult,
  AnalyticsLifecycleInsightResult,
]);
export type QueryCustomAnalyticsInsightResponse = typeof QueryCustomAnalyticsInsightResponse.Type;
export type QueryCustomAnalyticsInsightResponseType =
  typeof QueryCustomAnalyticsInsightResponse.Type;

export const ListAnalyticsInsightsRequest = Schema.Struct({
  projectId: Schema.String,
});
export type ListAnalyticsInsightsRequest = typeof ListAnalyticsInsightsRequest.Type;
export const ListAnalyticsInsightsResponse = Schema.Struct({
  insights: Schema.Array(SavedAnalyticsInsight),
});
export type ListAnalyticsInsightsResponse = typeof ListAnalyticsInsightsResponse.Type;

export const CreateAnalyticsInsightRequest = Schema.Struct({
  definition: CustomAnalyticsInsightQuery,
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(4000))),
  name: Schema.String.check(Schema.isMaxLength(255)),
  projectId: Schema.String,
});
export type CreateAnalyticsInsightRequest = typeof CreateAnalyticsInsightRequest.Type;

export const UpdateAnalyticsInsightRequest = Schema.Struct({
  definition: Schema.optional(CustomAnalyticsInsightQuery),
  description: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(4000)))),
  id: Schema.String,
  name: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type UpdateAnalyticsInsightRequest = typeof UpdateAnalyticsInsightRequest.Type;

export const AnalyticsDashboardItemLayout = Schema.Struct({
  height: Schema.Number.check(Schema.isGreaterThan(0)),
  width: Schema.Number.check(Schema.isGreaterThan(0)),
  x: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  y: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type AnalyticsDashboardItemLayout = typeof AnalyticsDashboardItemLayout.Type;
export type AnalyticsDashboardItemLayoutType = typeof AnalyticsDashboardItemLayout.Type;

export const AnalyticsInsightDashboardItem = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("insight"),
  insight: SavedAnalyticsInsight,
  layout: AnalyticsDashboardItemLayout,
  position: Schema.Number,
});
export type AnalyticsInsightDashboardItem = typeof AnalyticsInsightDashboardItem.Type;

export const AnalyticsVoidQlDashboardItem = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("voidql"),
  layout: AnalyticsDashboardItemLayout,
  position: Schema.Number,
  query: SavedVoidQlInsight,
});
export type AnalyticsVoidQlDashboardItem = typeof AnalyticsVoidQlDashboardItem.Type;

export const AnalyticsDashboardItem = Schema.Union([
  AnalyticsInsightDashboardItem,
  AnalyticsVoidQlDashboardItem,
]);
export type AnalyticsDashboardItem = typeof AnalyticsDashboardItem.Type;

export const AnalyticsDashboard = Schema.Struct({
  createdAt: Schema.Date,
  createdBy: Schema.String,
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  items: Schema.Array(AnalyticsDashboardItem),
  name: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  updatedAt: Schema.Date,
});
export type AnalyticsDashboard = typeof AnalyticsDashboard.Type;
export type AnalyticsDashboardType = typeof AnalyticsDashboard.Type;

export const ListAnalyticsDashboardsRequest = Schema.Struct({
  projectId: Schema.String,
});
export type ListAnalyticsDashboardsRequest = typeof ListAnalyticsDashboardsRequest.Type;
export const ListAnalyticsDashboardsResponse = Schema.Struct({
  dashboards: Schema.Array(AnalyticsDashboard),
});
export type ListAnalyticsDashboardsResponse = typeof ListAnalyticsDashboardsResponse.Type;

export const CreateAnalyticsDashboardRequest = Schema.Struct({
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(4000))),
  name: Schema.String.check(Schema.isMaxLength(255)),
  projectId: Schema.String,
});
export type CreateAnalyticsDashboardRequest = typeof CreateAnalyticsDashboardRequest.Type;

export const DuplicateAnalyticsDashboardRequest = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type DuplicateAnalyticsDashboardRequest = typeof DuplicateAnalyticsDashboardRequest.Type;

export const UpdateAnalyticsDashboardRequest = Schema.Struct({
  description: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(4000)))),
  id: Schema.String,
  name: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type UpdateAnalyticsDashboardRequest = typeof UpdateAnalyticsDashboardRequest.Type;

export const PutAnalyticsDashboardItemRequest = Schema.Struct({
  dashboardId: Schema.String,
  layout: AnalyticsDashboardItemLayout,
  position: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  source: Schema.Union([
    Schema.Struct({ id: Schema.String, kind: Schema.Literal("insight") }),
    Schema.Struct({ id: Schema.String, kind: Schema.Literal("voidql") }),
  ]),
});
export type PutAnalyticsDashboardItemRequest = typeof PutAnalyticsDashboardItemRequest.Type;

export const ReorderAnalyticsDashboardItemsRequest = Schema.Struct({
  dashboardId: Schema.String,
  itemIds: Schema.NonEmptyArray(Schema.String).check(Schema.isMaxLength(100)),
});
export type ReorderAnalyticsDashboardItemsRequest =
  typeof ReorderAnalyticsDashboardItemsRequest.Type;

export const AnalyticsCohort = Schema.Struct({
  createdAt: Schema.Date,
  createdBy: Schema.String,
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  memberCount: Schema.Number,
  memberPersonIds: Schema.Array(Schema.String),
  name: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  updatedAt: Schema.Date,
});
export type AnalyticsCohort = typeof AnalyticsCohort.Type;
export type AnalyticsCohortType = typeof AnalyticsCohort.Type;

export const ListAnalyticsCohortsRequest = Schema.Struct({ projectId: Schema.String });
export type ListAnalyticsCohortsRequest = typeof ListAnalyticsCohortsRequest.Type;
export const ListAnalyticsCohortsResponse = Schema.Struct({
  cohorts: Schema.Array(AnalyticsCohort),
});
export type ListAnalyticsCohortsResponse = typeof ListAnalyticsCohortsResponse.Type;

export const CreateAnalyticsCohortRequest = Schema.Struct({
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(4000))),
  memberPersonIds: Schema.Array(Schema.String).check(Schema.isMaxLength(10_000)),
  name: Schema.String.check(Schema.isMaxLength(255)),
  projectId: Schema.String,
});
export type CreateAnalyticsCohortRequest = typeof CreateAnalyticsCohortRequest.Type;

export const UpdateAnalyticsCohortRequest = Schema.Struct({
  description: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(4000)))),
  id: Schema.String,
  memberPersonIds: Schema.optional(Schema.Array(Schema.String).check(Schema.isMaxLength(10_000))),
  name: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type UpdateAnalyticsCohortRequest = typeof UpdateAnalyticsCohortRequest.Type;

export const BuiltInInsightId = Schema.Union([
  Schema.Literal("builtin/revenue"),
  Schema.Literal("builtin/mrr"),
  Schema.Literal("builtin/arr"),
  Schema.Literal("builtin/mrr_growth_rate"),
  Schema.Literal("builtin/churn_rate"),
  Schema.Literal("builtin/churned_revenue"),
  Schema.Literal("builtin/person_count"),
  Schema.Literal("builtin/new_persons"),
  Schema.Literal("builtin/retention"),
  Schema.Literal("builtin/arpu"),
  Schema.Literal("builtin/arppu"),
  Schema.Literal("builtin/active_subscriptions"),
  Schema.Literal("builtin/active_trials"),
  Schema.Literal("builtin/active_subscribers_growth"),
  Schema.Literal("builtin/new_subscriptions"),
  Schema.Literal("builtin/churned_subscriptions"),
  Schema.Literal("builtin/subscriber_lifetime_value"),
  Schema.Literal("builtin/trials"),
  Schema.Literal("builtin/trial_conversions"),
  Schema.Literal("builtin/trial_conversion_rate"),
]);
export type BuiltInInsightId = typeof BuiltInInsightId.Type;
export type BuiltInInsightIdType = typeof BuiltInInsightId.Type;

export const AnalyticsInsightQuery = Schema.Struct({
  breakdowns: Schema.optional(Schema.Array(AnalyticsBreakdown)),
  context: AnalyticsContext,
  filter: Schema.optional(AnalyticsFilter),
  granularity: Schema.optional(AnalyticsGranularity),
  insightId: BuiltInInsightId,
  key: Schema.String,
  limit: Schema.optional(Schema.Number),
  timeRange: AnalyticsTimeRange,
});
export type AnalyticsInsightQuery = typeof AnalyticsInsightQuery.Type;
export type AnalyticsInsightQueryType = typeof AnalyticsInsightQuery.Type;

export const QueryAnalyticsInsightsRequest = Schema.Struct({
  queries: Schema.NonEmptyArray(AnalyticsInsightQuery),
});
export type QueryAnalyticsInsightsRequest = typeof QueryAnalyticsInsightsRequest.Type;
export type QueryAnalyticsInsightsRequestType = typeof QueryAnalyticsInsightsRequest.Type;

export const AnalyticsDataPoint = Schema.Struct({
  timestamp: Schema.Date,
  value: Schema.Number,
});
export type AnalyticsDataPoint = typeof AnalyticsDataPoint.Type;
export type AnalyticsDataPointType = typeof AnalyticsDataPoint.Type;

export const AnalyticsSummary = Schema.Struct({
  currency: Schema.optional(Schema.String),
  value: Schema.Number,
});
export type AnalyticsSummary = typeof AnalyticsSummary.Type;
export type AnalyticsSummaryType = typeof AnalyticsSummary.Type;

export const AnalyticsMetricResult = Schema.Struct({
  kind: Schema.Literal("metric"),
  sparkline: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});
export type AnalyticsMetricResult = typeof AnalyticsMetricResult.Type;

export const AnalyticsTimeseriesResult = Schema.Struct({
  kind: Schema.Literal("timeseries"),
  series: Schema.Array(AnalyticsDataPoint),
  summary: AnalyticsSummary,
});
export type AnalyticsTimeseriesResult = typeof AnalyticsTimeseriesResult.Type;

export const AnalyticsBreakdownRow = Schema.Struct({
  key: Schema.String,
  label: Schema.String,
  value: Schema.Number,
});
export type AnalyticsBreakdownRow = typeof AnalyticsBreakdownRow.Type;

export const AnalyticsBreakdownResult = Schema.Struct({
  kind: Schema.Literal("breakdown"),
  rows: Schema.Array(AnalyticsBreakdownRow),
  summary: Schema.optional(AnalyticsSummary),
});
export type AnalyticsBreakdownResult = typeof AnalyticsBreakdownResult.Type;

export const AnalyticsInsightResult = Schema.Union([
  AnalyticsMetricResult,
  AnalyticsTimeseriesResult,
  AnalyticsBreakdownResult,
]);
export type AnalyticsInsightResult = typeof AnalyticsInsightResult.Type;
export type AnalyticsInsightResultType = typeof AnalyticsInsightResult.Type;

export const AnalyticsInsightResponseItem = Schema.Struct({
  insightId: BuiltInInsightId,
  key: Schema.String,
  resolvedTimeRange: Schema.Struct({
    end: Schema.Date,
    start: Schema.Date,
  }),
  result: AnalyticsInsightResult,
});
export type AnalyticsInsightResponseItem = typeof AnalyticsInsightResponseItem.Type;
export type AnalyticsInsightResponseItemType = typeof AnalyticsInsightResponseItem.Type;

export const QueryAnalyticsInsightsResponse = Schema.Struct({
  results: Schema.Array(AnalyticsInsightResponseItem),
});
export type QueryAnalyticsInsightsResponse = typeof QueryAnalyticsInsightsResponse.Type;
export type QueryAnalyticsInsightsResponseType = typeof QueryAnalyticsInsightsResponse.Type;

export const RecentAnalyticsEvent = Schema.Struct({
  captureId: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  eventId: Schema.String,
  eventName: Schema.String,
  identityMode: Schema.String,
  personDistinctId: Schema.NullOr(Schema.String),
  personEmail: Schema.NullOr(Schema.String),
  personId: Schema.NullOr(Schema.String),
  personName: Schema.NullOr(Schema.String),
  previousDistinctId: Schema.NullOr(Schema.String),
  /** When the event row was inserted into the analytics store. */
  processedAt: Schema.Date,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  /** When the capture endpoint accepted the event into the processing pipeline. */
  receivedAt: Schema.Date,
  requestId: Schema.String,
  /** The event's own client-reported timestamp; may differ from `receivedAt` under clock skew. */
  timestamp: Schema.Date,
});
export type RecentAnalyticsEvent = typeof RecentAnalyticsEvent.Type;
export type RecentAnalyticsEventType = typeof RecentAnalyticsEvent.Type;

export const ListRecentAnalyticsEventsRequest = Schema.Struct({
  limit: Schema.optional(Schema.Number),
  projectId: Schema.String,
});
export type ListRecentAnalyticsEventsRequest = typeof ListRecentAnalyticsEventsRequest.Type;
export type ListRecentAnalyticsEventsRequestType = typeof ListRecentAnalyticsEventsRequest.Type;

export const ListRecentAnalyticsEventsResponse = Schema.Struct({
  events: Schema.Array(RecentAnalyticsEvent),
  hasMore: Schema.Boolean,
});
export type ListRecentAnalyticsEventsResponse = typeof ListRecentAnalyticsEventsResponse.Type;
export type ListRecentAnalyticsEventsResponseType = typeof ListRecentAnalyticsEventsResponse.Type;

export class AnalyticsRpcsDef extends RpcGroup.make(
  Rpc.make("ListRecentAnalyticsEvents", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ListRecentAnalyticsEventsRequest,
    success: ListRecentAnalyticsEventsResponse,
  }),
  Rpc.make("QueryAnalyticsInsights", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcAnalyticsServiceError,
      RpcInvalidAnalyticsQueryError,
      RpcInvalidTimeRangeError,
      RpcUnknownInsightError,
      RpcUnsupportedAnalyticsBreakdownError,
      RpcUnsupportedAnalyticsFilterError,
    ]),
    payload: QueryAnalyticsInsightsRequest,
    success: QueryAnalyticsInsightsResponse,
  }),
).middleware(AuthMiddleware) {}

/** Hosted custom insights, cohorts, and dashboards RPC surface. */
export class AdvancedAnalyticsRpcsDef extends RpcGroup.make(
  Rpc.make("QueryCustomAnalyticsInsight", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcAnalyticsServiceError,
      RpcInvalidAnalyticsQueryError,
      RpcInvalidTimeRangeError,
    ]),
    payload: QueryCustomAnalyticsInsightRequest,
    success: QueryCustomAnalyticsInsightResponse,
  }),
  Rpc.make("QueryCustomAnalyticsPersons", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcAnalyticsServiceError,
      RpcInvalidAnalyticsQueryError,
      RpcInvalidTimeRangeError,
    ]),
    payload: QueryCustomAnalyticsPersonsRequest,
    success: QueryCustomAnalyticsPersonsResponse,
  }),
  Rpc.make("ListAnalyticsInsights", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ListAnalyticsInsightsRequest,
    success: ListAnalyticsInsightsResponse,
  }),
  Rpc.make("CreateAnalyticsInsight", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: CreateAnalyticsInsightRequest,
    success: SavedAnalyticsInsight,
  }),
  Rpc.make("UpdateAnalyticsInsight", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: UpdateAnalyticsInsightRequest,
    success: SavedAnalyticsInsight,
  }),
  Rpc.make("DeleteAnalyticsInsight", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ isDeleted: Schema.Boolean }).pipe(
      Schema.encodeKeys({ isDeleted: "deleted" }),
    ),
  }),
  Rpc.make("ListAnalyticsCohorts", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ListAnalyticsCohortsRequest,
    success: ListAnalyticsCohortsResponse,
  }),
  Rpc.make("CreateAnalyticsCohort", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: CreateAnalyticsCohortRequest,
    success: AnalyticsCohort,
  }),
  Rpc.make("UpdateAnalyticsCohort", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: UpdateAnalyticsCohortRequest,
    success: AnalyticsCohort,
  }),
  Rpc.make("DeleteAnalyticsCohort", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ isDeleted: Schema.Boolean }).pipe(
      Schema.encodeKeys({ isDeleted: "deleted" }),
    ),
  }),
  Rpc.make("ListAnalyticsDashboards", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ListAnalyticsDashboardsRequest,
    success: ListAnalyticsDashboardsResponse,
  }),
  Rpc.make("CreateAnalyticsDashboard", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: CreateAnalyticsDashboardRequest,
    success: AnalyticsDashboard,
  }),
  Rpc.make("DuplicateAnalyticsDashboard", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: DuplicateAnalyticsDashboardRequest,
    success: AnalyticsDashboard,
  }),
  Rpc.make("UpdateAnalyticsDashboard", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: UpdateAnalyticsDashboardRequest,
    success: AnalyticsDashboard,
  }),
  Rpc.make("DeleteAnalyticsDashboard", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ isDeleted: Schema.Boolean }).pipe(
      Schema.encodeKeys({ isDeleted: "deleted" }),
    ),
  }),
  Rpc.make("PutAnalyticsDashboardItem", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: PutAnalyticsDashboardItemRequest,
    success: AnalyticsDashboard,
  }),
  Rpc.make("ReorderAnalyticsDashboardItems", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: ReorderAnalyticsDashboardItemsRequest,
    success: AnalyticsDashboard,
  }),
  Rpc.make("RemoveAnalyticsDashboardItem", {
    error: Schema.Union([RpcActionForbiddenError, RpcAnalyticsServiceError]),
    payload: Schema.Struct({
      dashboardId: Schema.String,
      itemId: Schema.String,
    }),
    success: AnalyticsDashboard,
  }),
).middleware(AuthMiddleware) {}
