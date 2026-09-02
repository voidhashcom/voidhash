import type * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

export type AnalyticsBreakdownLimitEnum = "Infinity" | "-Infinity" | "NaN";

export type AnalyticsBreakdownOrderEnum = "asc" | "desc";

export interface AnalyticsBreakdown {
  readonly field: string;
  readonly limit?: AnalyticsBreakdownLimitEnum | AnalyticsBreakdownLimitEnum | null | undefined;
  readonly order?: AnalyticsBreakdownOrderEnum | null | undefined;
}

export type AnalyticsFilterPredicateOp =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "exists";

export type AnalyticsFilterPredicateType = "predicate";

export interface AnalyticsFilterPredicate {
  readonly field: string;
  readonly op: AnalyticsFilterPredicateOp;
  readonly type: AnalyticsFilterPredicateType;
  readonly value?:
    | string
    | number
    | boolean
    | null
    | ReadonlyArray<string | number | boolean | null>
    | null
    | undefined;
}

export type UnionEnumType = "not";

export type Union =
  | AnalyticsFilterPredicate
  | {
      readonly filters: ReadonlyArray<Union>;
      readonly type: UnionEnumType;
    }
  | {
      readonly filters: ReadonlyArray<Union>;
      readonly type: UnionEnumType;
    }
  | {
      readonly filter: Union;
      readonly type: UnionEnumType;
    };

export type AnalyticsInsightQueryGranularityEnum =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export type AnalyticsInsightQueryInsightId =
  | "builtin/revenue"
  | "builtin/mrr"
  | "builtin/arr"
  | "builtin/mrr_growth_rate"
  | "builtin/churn_rate"
  | "builtin/churned_revenue"
  | "builtin/person_count"
  | "builtin/new_persons"
  | "builtin/retention"
  | "builtin/arpu"
  | "builtin/arppu"
  | "builtin/active_subscriptions"
  | "builtin/active_trials"
  | "builtin/active_subscribers_growth"
  | "builtin/new_subscriptions"
  | "builtin/churned_subscriptions"
  | "builtin/subscriber_lifetime_value"
  | "builtin/trials"
  | "builtin/trial_conversions"
  | "builtin/trial_conversion_rate";

export type AnalyticsInsightQueryLimitEnum = "Infinity" | "-Infinity" | "NaN";

export type AnalyticsInsightQueryTimeRangeEnumPreset = "custom";

export interface AnalyticsInsightQuery {
  readonly breakdowns?: ReadonlyArray<AnalyticsBreakdown> | null | undefined;
  readonly filter?: Union | null | undefined;
  readonly granularity?: AnalyticsInsightQueryGranularityEnum | null | undefined;
  readonly insightId: AnalyticsInsightQueryInsightId;
  readonly key: string;
  readonly limit?: number | AnalyticsInsightQueryLimitEnum | null | undefined;
  readonly timeRange:
    | {
        readonly preset: AnalyticsInsightQueryTimeRangeEnumPreset;
      }
    | {
        readonly end: string;
        readonly preset: AnalyticsInsightQueryTimeRangeEnumPreset;
        readonly start: string;
      };
}

export interface QueryInsightsBodyJsonEncoding {
  readonly projectId?: string | null | undefined;
  readonly queries: ReadonlyArray<AnalyticsInsightQuery>;
}

export type AnalyticsInsightResponseItemInsightId =
  | "builtin/revenue"
  | "builtin/mrr"
  | "builtin/arr"
  | "builtin/mrr_growth_rate"
  | "builtin/churn_rate"
  | "builtin/churned_revenue"
  | "builtin/person_count"
  | "builtin/new_persons"
  | "builtin/retention"
  | "builtin/arpu"
  | "builtin/arppu"
  | "builtin/active_subscriptions"
  | "builtin/active_trials"
  | "builtin/active_subscribers_growth"
  | "builtin/new_subscriptions"
  | "builtin/churned_subscriptions"
  | "builtin/subscriber_lifetime_value"
  | "builtin/trials"
  | "builtin/trial_conversions"
  | "builtin/trial_conversion_rate";

export type AnalyticsInsightResponseItemResultEnumKind = "breakdown";

export type AnalyticsDataPointValueEnum = "Infinity" | "-Infinity" | "NaN";

export interface AnalyticsDataPoint {
  readonly timestamp: string;
  readonly value: number | AnalyticsDataPointValueEnum;
}

export type AnalyticsSummaryValueEnum = "Infinity" | "-Infinity" | "NaN";

export interface AnalyticsSummary {
  readonly currency?: string | null | undefined;
  readonly value: number | AnalyticsSummaryValueEnum;
}

export interface AnalyticsInsightResponseItem {
  readonly insightId: AnalyticsInsightResponseItemInsightId;
  readonly key: string;
  readonly resolvedTimeRange: {
    readonly end: string;
    readonly start: string;
  };
  readonly result:
    | {
        readonly kind: AnalyticsInsightResponseItemResultEnumKind;
        readonly sparkline: ReadonlyArray<AnalyticsDataPoint>;
        readonly summary: AnalyticsSummary;
      }
    | {
        readonly kind: AnalyticsInsightResponseItemResultEnumKind;
        readonly series: ReadonlyArray<AnalyticsDataPoint>;
        readonly summary: AnalyticsSummary;
      }
    | {
        readonly kind: AnalyticsInsightResponseItemResultEnumKind;
        readonly rows: ReadonlyArray<{
          readonly key: string;
          readonly label: string;
          readonly value: number | "Infinity" | "-Infinity" | "NaN";
        }>;
        readonly summary?: AnalyticsSummary | null | undefined;
      };
}

export interface QueryInsightsResultJsonEncoding {
  readonly results: ReadonlyArray<AnalyticsInsightResponseItem>;
}

export type ApiInvalidMetricErrorJsonEncodingTag = "Api/InvalidMetricError";

export interface ApiInvalidMetricErrorJsonEncoding {
  readonly _tag: ApiInvalidMetricErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiInvalidTimeRangeErrorJsonEncodingTag = "Api/InvalidTimeRangeError";

export interface ApiInvalidTimeRangeErrorJsonEncoding {
  readonly _tag: ApiInvalidTimeRangeErrorJsonEncodingTag;
  readonly message: string;
}

export type AnalyticsQueryInsights400 =
  | ApiInvalidMetricErrorJsonEncoding
  | ApiInvalidTimeRangeErrorJsonEncoding;

export type ApiAuthenticationErrorJsonEncodingTag = "Api/AuthenticationError";

export interface ApiAuthenticationErrorJsonEncoding {
  readonly _tag: ApiAuthenticationErrorJsonEncodingTag;
  readonly cause: string;
  readonly message: string;
}

export type ApiNotAuthenticatedErrorJsonEncodingTag = "Api/NotAuthenticatedError";

export interface ApiNotAuthenticatedErrorJsonEncoding {
  readonly _tag: ApiNotAuthenticatedErrorJsonEncodingTag;
  readonly message: string;
}

export type AnalyticsQueryInsights401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiActionForbiddenErrorJsonEncodingTag = "Api/ActionForbiddenError";

export interface ApiActionForbiddenErrorJsonEncoding {
  readonly _tag: ApiActionForbiddenErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiUnknownInsightErrorJsonEncodingTag = "Api/UnknownInsightError";

export interface ApiUnknownInsightErrorJsonEncoding {
  readonly _tag: ApiUnknownInsightErrorJsonEncodingTag;
  readonly insightId: string;
  readonly message: string;
}

export type ApiAnalyticsServiceErrorJsonEncodingTag = "Api/AnalyticsServiceError";

export interface ApiAnalyticsServiceErrorJsonEncoding {
  readonly _tag: ApiAnalyticsServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type ApiAuthServiceErrorJsonEncodingTag = "Api/AuthServiceError";

export interface ApiAuthServiceErrorJsonEncoding {
  readonly _tag: ApiAuthServiceErrorJsonEncodingTag;
  readonly cause: string;
  readonly message: string;
}

export type AnalyticsQueryInsights500 =
  | ApiAnalyticsServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface ApiKeysListApiKeysParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface ApiKeyJsonEncoding {
  readonly end: string;
  readonly id: string;
  readonly isPublic: boolean;
  readonly name: string;
  readonly prefix: string;
  readonly projectId: string;
  readonly rawKey?: string | null | undefined;
}

export interface PageInfo {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
}

export interface ApiKeysListApiKeys200 {
  readonly data: ReadonlyArray<ApiKeyJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type ApiKeysListApiKeys401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiApiKeyServiceErrorJsonEncodingTag = "Api/ApiKeyServiceError";

export interface ApiApiKeyServiceErrorJsonEncoding {
  readonly _tag: ApiApiKeyServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type ApiKeysListApiKeys500 =
  | ApiApiKeyServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreateSecretKeyBodyJsonEncoding {
  readonly name: string;
  readonly projectId: string;
}

export interface ApiKeyWithRawKeyJsonEncoding {
  readonly end: string;
  readonly id: string;
  readonly isPublic: boolean;
  readonly name: string;
  readonly prefix: string;
  readonly projectId: string;
  readonly rawKey: string;
}

export type ApiKeysCreateSecretKey401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiKeysCreateSecretKey500 =
  | ApiApiKeyServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ApiKeysGetApiKeyById401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiApiKeyNotFoundErrorJsonEncodingTag = "Api/ApiKeyNotFoundError";

export interface ApiApiKeyNotFoundErrorJsonEncoding {
  readonly _tag: ApiApiKeyNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiKeysGetApiKeyById500 =
  | ApiApiKeyServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ApiKeysDeleteApiKey401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiKeysDeleteApiKey500 =
  | ApiApiKeyServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ApiKeysRotateSecretKey401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiKeysRotateSecretKey500 =
  | ApiApiKeyServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type AuthSession200Method = "api-key" | "publishable-key" | "secret-key";

export interface AuthSession200 {
  readonly method: AuthSession200Method;
  readonly name: string;
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly organizationId: string;
    readonly slug: string;
  }>;
}

export type AuthSession401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface DevelopmentGetDevelopmentSettingsParams {
  readonly projectId?: string | null | undefined;
}

export interface DevelopmentSettings {
  readonly developmentPurchasesEnabled: boolean;
}

export type DevelopmentGetDevelopmentSettings401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiDevelopmentEnvironmentRequiredErrorJsonEncodingTag =
  "Api/DevelopmentEnvironmentRequiredError";

export interface ApiDevelopmentEnvironmentRequiredErrorJsonEncoding {
  readonly _tag: ApiDevelopmentEnvironmentRequiredErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiDevelopmentModeServiceErrorJsonEncodingTag = "Api/DevelopmentModeServiceError";

export interface ApiDevelopmentModeServiceErrorJsonEncoding {
  readonly _tag: ApiDevelopmentModeServiceErrorJsonEncodingTag;
  readonly message: string;
}

export type DevelopmentGetDevelopmentSettings500 =
  | ApiDevelopmentModeServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdateDevelopmentSettingsBody {
  readonly developmentPurchasesEnabled: boolean;
  readonly projectId?: string | null | undefined;
}

export type DevelopmentUpdateDevelopmentSettings401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type DevelopmentUpdateDevelopmentSettings500 =
  | ApiDevelopmentModeServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface DevelopmentGetDevelopmentStateParams {
  readonly personId: string;
  readonly projectId?: string | null | undefined;
}

export interface DevelopmentState {
  readonly developmentPurchasesEnabled: boolean;
  readonly grants: ReadonlyArray<{
    readonly expiresAt: string | null;
    readonly id: string;
    readonly perkId: string;
    readonly status: number | "Infinity" | "-Infinity" | "NaN";
  }>;
  readonly purchases: ReadonlyArray<{
    readonly createdAt: string | null;
    readonly id: string;
    readonly productId: string;
    readonly productName: string;
    readonly productSlug: string;
    readonly refundedAt: string | null;
    readonly revokedAt: string | null;
  }>;
  readonly subscriptions: ReadonlyArray<{
    readonly canceledAt: string | null;
    readonly expiresAt: string | null;
    readonly gracePeriodExpiresAt: string | null;
    readonly id: string;
    readonly productId: string;
    readonly productName: string;
    readonly productSlug: string;
    readonly startsAt: string;
    readonly status: number | "Infinity" | "-Infinity" | "NaN";
  }>;
}

export type DevelopmentGetDevelopmentState401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type DevelopmentGetDevelopmentState500 =
  | ApiDevelopmentModeServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type DevelopmentLifecycleActionBodyAction =
  | "expire"
  | "revoke"
  | "renew"
  | "refund"
  | "grace_period";

export type DevelopmentLifecycleActionBodyTargetType = "subscription" | "purchase";

export interface DevelopmentLifecycleActionBody {
  readonly action: DevelopmentLifecycleActionBodyAction;
  readonly actionId: string;
  readonly projectId?: string | null | undefined;
  readonly targetId: string;
  readonly targetType: DevelopmentLifecycleActionBodyTargetType;
}

export interface DevelopmentApplyDevelopmentLifecycleAction202 {
  readonly actionId: string;
}

export type DevelopmentApplyDevelopmentLifecycleAction401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type DevelopmentApplyDevelopmentLifecycleAction500 =
  | ApiDevelopmentModeServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface DevelopmentResetDevelopmentDataParams {
  readonly projectId?: string | null | undefined;
}

export type DevelopmentResetDevelopmentData401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type DevelopmentResetDevelopmentData500 =
  | ApiDevelopmentModeServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface EventsListEventsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly eventName?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface AnalyticsEventJsonEncoding {
  readonly captureId: string;
  readonly context: Record<string, unknown>;
  readonly distinctId: string | null;
  readonly eventId: string;
  readonly eventName: string;
  readonly identityMode: string;
  readonly personId: string | null;
  readonly previousDistinctId: string | null;
  readonly processedAt: string;
  readonly properties: Record<string, unknown>;
  readonly receivedAt: string;
  readonly requestId: string;
  readonly source: string;
  readonly timestamp: string;
}

export interface EventsListEvents200 {
  readonly data: ReadonlyArray<AnalyticsEventJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type EventsListEvents401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type EventsListEvents500 =
  | ApiAnalyticsServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentsListExperimentsParamsIncludeArchivedEnum = "true" | "false";

export type ExperimentsListExperimentsParamsStatusEnum =
  | "draft"
  | "running"
  | "paused"
  | "concluded";

export interface ExperimentsListExperimentsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly includeArchived?: ExperimentsListExperimentsParamsIncludeArchivedEnum | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly status?: ExperimentsListExperimentsParamsStatusEnum | null | undefined;
}

export type ExperimentListItemJsonEncodingStatus = "draft" | "running" | "paused" | "concluded";

export type ExperimentListItemJsonEncodingVariantCountEnum = "Infinity" | "-Infinity" | "NaN";

export type ExperimentListItemJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentListItemJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly createdByUserId: string | null;
  readonly description: string | null;
  readonly endedAt: string | null;
  readonly featureFlagId: string;
  readonly hypothesis: string | null;
  readonly id: string;
  readonly name: string;
  readonly paywallLocationIds: ReadonlyArray<string>;
  readonly primaryMetricEventName: string | null;
  readonly projectId: string;
  readonly secondaryMetricEventNames: ReadonlyArray<string> | null;
  readonly startedAt: string | null;
  readonly status: ExperimentListItemJsonEncodingStatus;
  readonly updatedAt: string | null;
  readonly updatedByUserId: string | null;
  readonly variantCount: number | ExperimentListItemJsonEncodingVariantCountEnum;
  readonly version: number | ExperimentListItemJsonEncodingVersionEnum;
  readonly winningVariantId: string | null;
}

export interface ExperimentsListExperiments200 {
  readonly data: ReadonlyArray<ExperimentListItemJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type ExperimentsListExperiments401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiExperimentServiceErrorJsonEncodingTag = "Api/ExperimentServiceError";

export interface ApiExperimentServiceErrorJsonEncoding {
  readonly _tag: ApiExperimentServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type ExperimentsListExperiments500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreateExperimentBodyJsonEncoding {
  readonly name: string;
  readonly projectId?: string | null | undefined;
}

export type ExperimentBackingFlagJsonEncodingRolloutBpsEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentBackingFlagJsonEncoding {
  readonly enabled: boolean;
  readonly id: string;
  readonly key: string;
  readonly rolloutBps: number | ExperimentBackingFlagJsonEncodingRolloutBpsEnum;
}

export type Union1 = ReadonlyArray<string> | null;

export type ExperimentJsonEncodingStatus = "draft" | "running" | "paused" | "concluded";

export interface ExperimentTreatmentJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly experimentId: string;
  readonly id: string;
  readonly treatmentType: string;
  readonly updatedAt: string | null;
  readonly variantId: string;
}

export type Arrays = ReadonlyArray<ExperimentTreatmentJsonEncoding>;

export type ExperimentVariantJsonEncodingWeightBpsEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentVariantJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly experimentId: string;
  readonly id: string;
  readonly isControl: boolean;
  readonly name: string;
  readonly updatedAt: string | null;
  readonly weightBps: number | ExperimentVariantJsonEncodingWeightBpsEnum;
}

export type Arrays1 = ReadonlyArray<ExperimentVariantJsonEncoding>;

export type ExperimentJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentJsonEncoding {
  readonly archivedAt: string | null;
  readonly backingFlag: ExperimentBackingFlagJsonEncoding | null;
  readonly createdAt: string | null;
  readonly createdByUserId: string | null;
  readonly description: string | null;
  readonly endedAt: string | null;
  readonly featureFlagId: string;
  readonly hypothesis: string | null;
  readonly id: string;
  readonly name: string;
  readonly primaryMetricEventName: string | null;
  readonly projectId: string;
  readonly secondaryMetricEventNames: ReadonlyArray<string> | null;
  readonly startedAt: string | null;
  readonly status: ExperimentJsonEncodingStatus;
  readonly treatments: Arrays;
  readonly updatedAt: string | null;
  readonly updatedByUserId: string | null;
  readonly variants: Arrays1;
  readonly version: number | ExperimentJsonEncodingVersionEnum;
  readonly winningVariantId: string | null;
}

export type ExperimentsCreateExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsCreateExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentJsonEncoding1Status = "draft" | "running" | "paused" | "concluded";

export type ExperimentJsonEncoding1VersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentJsonEncoding1 {
  readonly archivedAt: string | null;
  readonly backingFlag: ExperimentBackingFlagJsonEncoding | null;
  readonly createdAt: string | null;
  readonly createdByUserId: string | null;
  readonly description: string | null;
  readonly endedAt: string | null;
  readonly featureFlagId: string;
  readonly hypothesis: string | null;
  readonly id: string;
  readonly name: string;
  readonly primaryMetricEventName: string | null;
  readonly projectId: string;
  readonly secondaryMetricEventNames: ReadonlyArray<string> | null;
  readonly startedAt: string | null;
  readonly status: ExperimentJsonEncoding1Status;
  readonly treatments: Arrays;
  readonly updatedAt: string | null;
  readonly updatedByUserId: string | null;
  readonly variants: Arrays1;
  readonly version: number | ExperimentJsonEncoding1VersionEnum;
  readonly winningVariantId: string | null;
}

export type ExperimentsGetExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiExperimentNotFoundErrorJsonEncodingTag = "Api/ExperimentNotFoundError";

export interface ApiExperimentNotFoundErrorJsonEncoding {
  readonly _tag: ApiExperimentNotFoundErrorJsonEncodingTag;
  readonly experimentId: string;
}

export type ExperimentsGetExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentsArchiveExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsArchiveExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdateExperimentBodyJsonEncoding {
  readonly description?: string | null | null | undefined;
  readonly hypothesis?: string | null | null | undefined;
  readonly name?: string | null | undefined;
  readonly primaryMetricEventName?: string | null | null | undefined;
  readonly secondaryMetricEventNames?: ReadonlyArray<string> | null | null | undefined;
  readonly variants?:
    | ReadonlyArray<{
        readonly id?: string | null | undefined;
        readonly isControl: boolean;
        readonly name: string;
        readonly treatments: ReadonlyArray<{
          readonly paywallId: string;
          readonly paywallLocationId: string;
        }>;
        readonly weightBps: number | "Infinity" | "-Infinity" | "NaN";
      }>
    | null
    | undefined;
}

export type ApiExperimentValidationErrorJsonEncodingTag = "Api/ExperimentValidationError";

export interface ApiExperimentValidationErrorJsonEncoding {
  readonly _tag: ApiExperimentValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type ExperimentsUpdateExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiExperimentVariantNotFoundErrorJsonEncodingTag = "Api/ExperimentVariantNotFoundError";

export interface ApiExperimentVariantNotFoundErrorJsonEncoding {
  readonly _tag: ApiExperimentVariantNotFoundErrorJsonEncodingTag;
  readonly variantId: string;
}

export type ExperimentsUpdateExperiment404 =
  | ApiExperimentNotFoundErrorJsonEncoding
  | ApiExperimentVariantNotFoundErrorJsonEncoding;

export type ApiExperimentConflictErrorJsonEncodingTag = "Api/ExperimentConflictError";

export interface ApiExperimentConflictErrorJsonEncoding {
  readonly _tag: ApiExperimentConflictErrorJsonEncodingTag;
  readonly message: string;
}

export type ExperimentsUpdateExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentsRestoreExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsRestoreExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentsStartExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsStartExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ExperimentsPauseExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsPauseExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface ConcludeExperimentBodyJsonEncoding {
  readonly winningVariantId?: string | null | undefined;
}

export type ExperimentsConcludeExperiment401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsConcludeExperiment404 =
  | ApiExperimentNotFoundErrorJsonEncoding
  | ApiExperimentVariantNotFoundErrorJsonEncoding;

export type ExperimentsConcludeExperiment500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface ExperimentsGetExperimentResultsParams {
  readonly days?: string | null | undefined;
}

export type ExperimentVariantResultJsonEncodingConversionRateEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type ExperimentVariantResultJsonEncodingConversionsEnum = "Infinity" | "-Infinity" | "NaN";

export type ExperimentVariantResultJsonEncodingExposuresEnum = "Infinity" | "-Infinity" | "NaN";

export type ExperimentVariantResultJsonEncodingRevenueUsdEnum = "Infinity" | "-Infinity" | "NaN";

export interface ExperimentVariantResultJsonEncoding {
  readonly conversionRate: number | ExperimentVariantResultJsonEncodingConversionRateEnum;
  readonly conversions: number | ExperimentVariantResultJsonEncodingConversionsEnum;
  readonly exposures: number | ExperimentVariantResultJsonEncodingExposuresEnum;
  readonly revenueUsd: number | ExperimentVariantResultJsonEncodingRevenueUsdEnum;
  readonly variantKey: string;
}

export interface ExperimentResultsJsonEncoding {
  readonly variants: ReadonlyArray<ExperimentVariantResultJsonEncoding>;
}

export type ExperimentsGetExperimentResults401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ExperimentsGetExperimentResults500 =
  | ApiExperimentServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface FeatureFlagOverridesListFeatureFlagOverridesParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly featureFlagId?: string | null | undefined;
  readonly identityType?: string | null | undefined;
  readonly identityValue?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export type FeatureFlagOverrideJsonEncodingIdentityTypeEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagOverrideJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly featureFlagId: string;
  readonly forcedEnabled: boolean | null;
  readonly forcedVariantKey: string | null;
  readonly id: string;
  readonly identityType: number | FeatureFlagOverrideJsonEncodingIdentityTypeEnum;
  readonly identityValue: string;
  readonly note: string | null;
  readonly updatedAt: string | null;
}

export interface FeatureFlagOverridesListFeatureFlagOverrides200 {
  readonly data: ReadonlyArray<FeatureFlagOverrideJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type FeatureFlagOverridesListFeatureFlagOverrides401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiFeatureFlagNotFoundErrorJsonEncodingTag = "Api/FeatureFlagNotFoundError";

export interface ApiFeatureFlagNotFoundErrorJsonEncoding {
  readonly _tag: ApiFeatureFlagNotFoundErrorJsonEncodingTag;
  readonly featureFlagId: string;
}

export type ApiFeatureFlagServiceErrorJsonEncodingTag = "Api/FeatureFlagServiceError";

export interface ApiFeatureFlagServiceErrorJsonEncoding {
  readonly _tag: ApiFeatureFlagServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type FeatureFlagOverridesListFeatureFlagOverrides500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type UpsertFeatureFlagOverrideBodyJsonEncodingIdentityType = 1 | 2 | 3 | 4;

export interface UpsertFeatureFlagOverrideBodyJsonEncoding {
  readonly featureFlagId: string;
  readonly forcedEnabled?: boolean | null | null | undefined;
  readonly forcedVariantKey?: string | null | null | undefined;
  readonly identityType: UpsertFeatureFlagOverrideBodyJsonEncodingIdentityType;
  readonly identityValue: string;
  readonly note?: string | null | undefined;
}

export type FeatureFlagOverrideJsonEncoding1IdentityTypeEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagOverrideJsonEncoding1 {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly featureFlagId: string;
  readonly forcedEnabled: boolean | null;
  readonly forcedVariantKey: string | null;
  readonly id: string;
  readonly identityType: number | FeatureFlagOverrideJsonEncoding1IdentityTypeEnum;
  readonly identityValue: string;
  readonly note: string | null;
  readonly updatedAt: string | null;
}

export type FeatureFlagOverridesUpsertFeatureFlagOverride401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiFeatureFlagOverrideNotFoundErrorJsonEncodingTag =
  "Api/FeatureFlagOverrideNotFoundError";

export interface ApiFeatureFlagOverrideNotFoundErrorJsonEncoding {
  readonly _tag: ApiFeatureFlagOverrideNotFoundErrorJsonEncodingTag;
  readonly overrideId: string;
}

export type FeatureFlagOverridesUpsertFeatureFlagOverride404 =
  | ApiFeatureFlagNotFoundErrorJsonEncoding
  | ApiFeatureFlagOverrideNotFoundErrorJsonEncoding;

export type FeatureFlagOverridesUpsertFeatureFlagOverride500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagOverridesArchiveFeatureFlagOverride401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagOverridesArchiveFeatureFlagOverride500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface FeatureFlagTargetsListFeatureFlagTargetsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly featureFlagId: string;
  readonly listType?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export type FeatureFlagTargetJsonEncodingIdentityTypeEnum = "Infinity" | "-Infinity" | "NaN";

export type FeatureFlagTargetJsonEncodingListTypeEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagTargetJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly featureFlagId: string;
  readonly id: string;
  readonly identityType: number | FeatureFlagTargetJsonEncodingIdentityTypeEnum;
  readonly identityValue: string;
  readonly listType: number | FeatureFlagTargetJsonEncodingListTypeEnum;
  readonly updatedAt: string | null;
}

export interface FeatureFlagTargetsListFeatureFlagTargets200 {
  readonly data: ReadonlyArray<FeatureFlagTargetJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type FeatureFlagTargetsListFeatureFlagTargets401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagTargetsListFeatureFlagTargets500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type UpsertFeatureFlagTargetBodyJsonEncodingIdentityType = 1 | 2 | 3 | 4;

export type UpsertFeatureFlagTargetBodyJsonEncodingListType = 1 | 2;

export interface UpsertFeatureFlagTargetBodyJsonEncoding {
  readonly featureFlagId: string;
  readonly identityType: UpsertFeatureFlagTargetBodyJsonEncodingIdentityType;
  readonly identityValue: string;
  readonly listType: UpsertFeatureFlagTargetBodyJsonEncodingListType;
}

export type FeatureFlagTargetJsonEncoding1IdentityTypeEnum = "Infinity" | "-Infinity" | "NaN";

export type FeatureFlagTargetJsonEncoding1ListTypeEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagTargetJsonEncoding1 {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly featureFlagId: string;
  readonly id: string;
  readonly identityType: number | FeatureFlagTargetJsonEncoding1IdentityTypeEnum;
  readonly identityValue: string;
  readonly listType: number | FeatureFlagTargetJsonEncoding1ListTypeEnum;
  readonly updatedAt: string | null;
}

export type FeatureFlagTargetsUpsertFeatureFlagTarget401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiFeatureFlagTargetNotFoundErrorJsonEncodingTag = "Api/FeatureFlagTargetNotFoundError";

export interface ApiFeatureFlagTargetNotFoundErrorJsonEncoding {
  readonly _tag: ApiFeatureFlagTargetNotFoundErrorJsonEncodingTag;
  readonly targetId: string;
}

export type FeatureFlagTargetsUpsertFeatureFlagTarget404 =
  | ApiFeatureFlagNotFoundErrorJsonEncoding
  | ApiFeatureFlagTargetNotFoundErrorJsonEncoding;

export type FeatureFlagTargetsUpsertFeatureFlagTarget500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagTargetsArchiveFeatureFlagTarget401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagTargetsArchiveFeatureFlagTarget500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagsListFeatureFlagsParamsIncludeArchivedEnum = "true" | "false";

export interface FeatureFlagsListFeatureFlagsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly includeArchived?:
    | FeatureFlagsListFeatureFlagsParamsIncludeArchivedEnum
    | null
    | undefined;
  readonly projectId?: string | null | undefined;
}

export type FeatureFlagListItemJsonEncodingRolloutBpsEnum = "Infinity" | "-Infinity" | "NaN";

export type FeatureFlagListItemJsonEncodingType = "boolean" | "string" | "number" | "json";

export type FeatureFlagListItemJsonEncodingVariantCountEnum = "Infinity" | "-Infinity" | "NaN";

export type FeatureFlagListItemJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagListItemJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly projectId: string;
  readonly rolloutBps: number | FeatureFlagListItemJsonEncodingRolloutBpsEnum;
  readonly slug: string;
  readonly type: FeatureFlagListItemJsonEncodingType;
  readonly updatedAt: string | null;
  readonly variantCount: number | FeatureFlagListItemJsonEncodingVariantCountEnum;
  readonly version: number | FeatureFlagListItemJsonEncodingVersionEnum;
}

export interface FeatureFlagsListFeatureFlags200 {
  readonly data: ReadonlyArray<FeatureFlagListItemJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type FeatureFlagsListFeatureFlags401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsListFeatureFlags500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type CreateFeatureFlagBodyJsonEncodingTypeEnum = "boolean" | "string" | "number" | "json";

export interface CreateFeatureFlagBodyJsonEncoding {
  readonly description?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly slug: string;
  readonly type?: CreateFeatureFlagBodyJsonEncodingTypeEnum | null | undefined;
  readonly variants?:
    | ReadonlyArray<{
        readonly label?: string | null | undefined;
        readonly weightBps?: number | "Infinity" | "-Infinity" | "NaN" | null | undefined;
      }>
    | null
    | undefined;
}

export type Arrays2 = ReadonlyArray<FeatureFlagOverrideJsonEncoding>;

export type FeatureFlagJsonEncodingRolloutBpsEnum = "Infinity" | "-Infinity" | "NaN";

export type Arrays3 = ReadonlyArray<FeatureFlagTargetJsonEncoding>;

export type FeatureFlagJsonEncodingType = "boolean" | "string" | "number" | "json";

export type FeatureFlagVariantJsonEncodingWeightBpsEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagVariantJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly featureFlagId: string;
  readonly id: string;
  readonly key: string;
  readonly label: string | null;
  readonly updatedAt: string | null;
  readonly weightBps: number | FeatureFlagVariantJsonEncodingWeightBpsEnum;
}

export type Arrays4 = ReadonlyArray<FeatureFlagVariantJsonEncoding>;

export type FeatureFlagJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly overrides: Arrays2;
  readonly projectId: string;
  readonly rolloutBps: number | FeatureFlagJsonEncodingRolloutBpsEnum;
  readonly slug: string;
  readonly targets: Arrays3;
  readonly type: FeatureFlagJsonEncodingType;
  readonly updatedAt: string | null;
  readonly variants: Arrays4;
  readonly version: number | FeatureFlagJsonEncodingVersionEnum;
}

export type FeatureFlagsCreateFeatureFlag401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiFeatureFlagKeyAlreadyExistsErrorJsonEncodingTag =
  "Api/FeatureFlagKeyAlreadyExistsError";

export interface ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiFeatureFlagKeyAlreadyExistsErrorJsonEncodingTag;
  readonly key: string;
}

export type FeatureFlagsCreateFeatureFlag500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagJsonEncoding1RolloutBpsEnum = "Infinity" | "-Infinity" | "NaN";

export type FeatureFlagJsonEncoding1Type = "boolean" | "string" | "number" | "json";

export type FeatureFlagJsonEncoding1VersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface FeatureFlagJsonEncoding1 {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly overrides: Arrays2;
  readonly projectId: string;
  readonly rolloutBps: number | FeatureFlagJsonEncoding1RolloutBpsEnum;
  readonly slug: string;
  readonly targets: Arrays3;
  readonly type: FeatureFlagJsonEncoding1Type;
  readonly updatedAt: string | null;
  readonly variants: Arrays4;
  readonly version: number | FeatureFlagJsonEncoding1VersionEnum;
}

export type FeatureFlagsGetFeatureFlag401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsGetFeatureFlag500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagsArchiveFeatureFlag401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsArchiveFeatureFlag500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type UpdateFeatureFlagBodyJsonEncodingRolloutBpsEnum = "Infinity" | "-Infinity" | "NaN";

export interface UpdateFeatureFlagBodyJsonEncoding {
  readonly description?: string | null | null | undefined;
  readonly enabled?: boolean | null | undefined;
  readonly rolloutBps?: number | UpdateFeatureFlagBodyJsonEncodingRolloutBpsEnum | null | undefined;
  readonly slug?: string | null | undefined;
}

export type FeatureFlagsUpdateFeatureFlag401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsUpdateFeatureFlag500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FeatureFlagsRestoreFeatureFlag401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsRestoreFeatureFlag500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface ReplaceFeatureFlagVariantsBodyJsonEncoding {
  readonly variants: ReadonlyArray<{
    readonly id?: string | null | undefined;
    readonly label?: string | null | undefined;
    readonly weightBps?: number | "Infinity" | "-Infinity" | "NaN" | null | undefined;
  }>;
}

export type FeatureFlagsReplaceFeatureFlagVariants401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsReplaceFeatureFlagVariants500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface EvaluateProjectFeatureFlagsBodyJsonEncoding {
  readonly distinctId?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly externalIds?: ReadonlyArray<string> | null | undefined;
  readonly keys?: ReadonlyArray<string> | null | undefined;
  readonly personId?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface SdkFeatureFlagResultJsonEncoding {
  readonly enabled: boolean;
  readonly key: string;
  readonly variantKey: string | null;
}

export interface SdkFeatureFlagsResponseJsonEncoding {
  readonly flags: ReadonlyArray<SdkFeatureFlagResultJsonEncoding>;
}

export type FeatureFlagsEvaluateProjectFeatureFlags401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type FeatureFlagsEvaluateProjectFeatureFlags500 =
  | ApiFeatureFlagServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface IngestPolicyGetIngestPolicyParams {
  readonly projectId?: string | null | undefined;
}

export interface BuiltinEventAdmission {
  readonly defaultEnabled: boolean;
  readonly description: string;
  readonly enabled: boolean;
  readonly eventNames: ReadonlyArray<string>;
  readonly key: string;
  readonly name: string;
  readonly override: boolean | null;
  readonly warning: string | null;
}

export interface EventAdmissionPolicyJsonEncoding {
  readonly builtinEvents: ReadonlyArray<BuiltinEventAdmission>;
  readonly customEventBlocklist: ReadonlyArray<string>;
}

export type ApiEventAdmissionErrorJsonEncodingTag = "Api/EventAdmissionError";

export interface ApiEventAdmissionErrorJsonEncoding {
  readonly _tag: ApiEventAdmissionErrorJsonEncodingTag;
  readonly message: string;
}

export type IngestPolicyGetIngestPolicy401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface SetBuiltinEventAdmissionBodyJsonEncoding {
  readonly enabled: boolean;
  readonly projectId?: string | null | undefined;
}

export type IngestPolicySetBuiltinEventAdmission401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface SetCustomEventBlockedBodyJsonEncoding {
  readonly blocked: boolean;
  readonly projectId?: string | null | undefined;
}

export type IngestPolicySetCustomEventBlocked401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface NotificationSendsListNotificationSendsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export type PushNotificationSendDeviceCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationSendFailedCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationSendRequestedDistinctIdCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationSendRequestedPersonCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationSendSkippedCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationSendSucceededCountEnum = "Infinity" | "-Infinity" | "NaN";

export interface PushNotificationSend {
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly deviceCount: number | PushNotificationSendDeviceCountEnum;
  readonly failedCount: number | PushNotificationSendFailedCountEnum;
  readonly id: string;
  readonly idempotencyKey: string | null;
  readonly message: Record<string, unknown>;
  readonly messagePurged: boolean;
  readonly requestedDistinctIdCount: number | PushNotificationSendRequestedDistinctIdCountEnum;
  readonly requestedPersonCount: number | PushNotificationSendRequestedPersonCountEnum;
  readonly skippedCount: number | PushNotificationSendSkippedCountEnum;
  readonly status: string;
  readonly succeededCount: number | PushNotificationSendSucceededCountEnum;
  readonly unresolvedDistinctIds: ReadonlyArray<string>;
}

export interface NotificationSendsListNotificationSends200 {
  readonly data: ReadonlyArray<PushNotificationSend>;
  readonly pageInfo: PageInfo;
}

export type NotificationSendsListNotificationSends401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushNotificationSendServiceErrorJsonEncodingTag =
  "Api/PushNotificationSendServiceError";

export interface ApiPushNotificationSendServiceErrorJsonEncoding {
  readonly _tag: ApiPushNotificationSendServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type NotificationSendsListNotificationSends500 =
  | ApiPushNotificationSendServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface NotificationSendsListNotificationSendDeliveriesParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly status?: string | null | undefined;
}

export type PushNotificationDeliveryAttemptCountEnum = "Infinity" | "-Infinity" | "NaN";

export type PushNotificationDeliveryMaxAttemptsEnum = "Infinity" | "-Infinity" | "NaN";

export interface PushNotificationDelivery {
  readonly attemptCount: number | PushNotificationDeliveryAttemptCountEnum;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly id: string;
  readonly lastError: string | null;
  readonly maxAttempts: number | PushNotificationDeliveryMaxAttemptsEnum;
  readonly nextAttemptAt: string | null;
  readonly personId: string;
  readonly provider: string;
  readonly providerMessageId: string | null;
  readonly status: string;
}

export interface NotificationSendsListNotificationSendDeliveries200 {
  readonly data: ReadonlyArray<PushNotificationDelivery>;
  readonly pageInfo: PageInfo;
}

export type NotificationSendsListNotificationSendDeliveries401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushNotificationSendNotFoundErrorJsonEncodingTag =
  "Api/PushNotificationSendNotFoundError";

export interface ApiPushNotificationSendNotFoundErrorJsonEncoding {
  readonly _tag: ApiPushNotificationSendNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type NotificationSendsListNotificationSendDeliveries500 =
  | ApiPushNotificationSendServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface NotificationsCreateNotificationParams {
  readonly "idempotency-key"?: string | null | undefined;
}

export type SendNotificationBodyJsonEncodingBadgeEnum = "Infinity" | "-Infinity" | "NaN";

export type SendNotificationBodyJsonEncodingPriorityEnum = "default" | "high";

export type SendNotificationBodyJsonEncodingTtlEnum = "Infinity" | "-Infinity" | "NaN";

export interface SendNotificationBodyJsonEncoding {
  readonly projectId?: string | null | undefined;
  readonly personIds?: ReadonlyArray<string> | null | undefined;
  readonly distinctIds?: ReadonlyArray<string> | null | undefined;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown> | null | undefined;
  readonly sound?: string | null | undefined;
  readonly badge?: number | SendNotificationBodyJsonEncodingBadgeEnum | null | undefined;
  readonly priority?: SendNotificationBodyJsonEncodingPriorityEnum | null | undefined;
  readonly ttl?: number | SendNotificationBodyJsonEncodingTtlEnum | null | undefined;
  readonly channelId?: string | null | undefined;
  readonly collapseId?: string | null | undefined;
  readonly idempotencyKey?: string | null | undefined;
}

export type SendNotificationResponseJsonEncodingDeviceCountEnum = "Infinity" | "-Infinity" | "NaN";

export type SendNotificationResponseJsonEncodingStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "partial_failed"
  | "failed"
  | "no_recipients";

export interface SendNotificationResponseJsonEncoding {
  readonly pushNotificationSendId: string;
  readonly deviceCount: number | SendNotificationResponseJsonEncodingDeviceCountEnum;
  readonly status: SendNotificationResponseJsonEncodingStatus;
  readonly unresolvedDistinctIds: ReadonlyArray<string>;
}

export type ApiPushDeviceValidationErrorJsonEncodingTag = "Api/PushDeviceValidationError";

export interface ApiPushDeviceValidationErrorJsonEncoding {
  readonly _tag: ApiPushDeviceValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type NotificationsCreateNotification401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushSendNotEnabledErrorJsonEncodingTag = "Api/PushSendNotEnabledError";

export interface ApiPushSendNotEnabledErrorJsonEncoding {
  readonly _tag: ApiPushSendNotEnabledErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiPushSendServiceErrorJsonEncodingTag = "Api/PushSendServiceError";

export interface ApiPushSendServiceErrorJsonEncoding {
  readonly _tag: ApiPushSendServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type NotificationsCreateNotification500 =
  | ApiAuthServiceErrorJsonEncoding
  | ApiPushSendServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface OrganizationsListOrganizationsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
}

export interface OrganizationJsonEncoding1 {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface OrganizationsListOrganizations200 {
  readonly data: ReadonlyArray<OrganizationJsonEncoding1>;
  readonly pageInfo: PageInfo;
}

export type OrganizationsListOrganizations401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface CreateOrganizationBodyJsonEncoding {
  readonly name: string;
}

export interface OrganizationJsonEncoding {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type OrganizationsCreateOrganization401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiOrganizationServiceErrorJsonEncodingTag = "Api/OrganizationServiceError";

export interface ApiOrganizationServiceErrorJsonEncoding {
  readonly _tag: ApiOrganizationServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type OrganizationsCreateOrganization500 =
  | ApiOrganizationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type OrganizationsGetOrganization401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiOrganizationNotFoundErrorJsonEncodingTag = "Api/OrganizationNotFoundError";

export interface ApiOrganizationNotFoundErrorJsonEncoding {
  readonly _tag: ApiOrganizationNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type OrganizationsGetOrganization500 =
  | ApiOrganizationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdateOrganizationBodyJsonEncoding {
  readonly name?: string | null | undefined;
}

export type OrganizationsUpdateOrganization401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type OrganizationsUpdateOrganization500 =
  | ApiOrganizationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface OrganizationsListOrganizationProjectsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
}

export interface ProjectJsonEncoding {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface OrganizationsListOrganizationProjects200 {
  readonly data: ReadonlyArray<ProjectJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type OrganizationsListOrganizationProjects401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProjectServiceErrorJsonEncodingTag = "Api/ProjectServiceError";

export interface ApiProjectServiceErrorJsonEncoding {
  readonly _tag: ApiProjectServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type OrganizationsListOrganizationProjects500 =
  | ApiProjectServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaymentProviderConfigurationsListPaymentProviderConfigurationsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly providerId?: string | null | undefined;
}

export type Objects1 = Record<string, unknown>;

export interface Objects {
  readonly activeProviderId: string | null;
  readonly configurationPresence: Objects1;
  readonly createdAt: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly paymentProviderKey: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly updatedAt: string | null;
}

export interface PaymentProviderConfigurationsListPaymentProviderConfigurations200 {
  readonly data: ReadonlyArray<Objects>;
  readonly pageInfo: PageInfo;
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaymentProviderConfigurationServiceErrorJsonEncodingTag =
  "Api/PaymentProviderConfigurationServiceError";

export interface ApiPaymentProviderConfigurationServiceErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderConfigurationServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations500 =
  | ApiPaymentProviderConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePaymentProviderConfigurationBody {
  readonly projectId?: string | null | undefined;
  readonly providerId: string;
}

export interface PaymentProviderConfigurationsCreatePaymentProviderConfiguration201 {
  readonly activeProviderId: string | null;
  readonly configurationPresence: Objects1;
  readonly createdAt: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly paymentProviderKey: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly updatedAt: string | null;
}

export type ApiPaymentProviderConfigurationValidationErrorJsonEncodingTag =
  "Api/PaymentProviderConfigurationValidationError";

export interface ApiPaymentProviderConfigurationValidationErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderConfigurationValidationErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaymentProviderConfigurationsCreatePaymentProviderConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaymentProviderConfigurationNotFoundErrorJsonEncodingTag =
  "Api/PaymentProviderConfigurationNotFoundError";

export interface ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderConfigurationNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiPaymentProviderAlreadyExistsErrorJsonEncodingTag =
  "Api/PaymentProviderAlreadyExistsError";

export interface ApiPaymentProviderAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderAlreadyExistsErrorJsonEncodingTag;
  readonly message: string;
}

export type PaymentProviderConfigurationsCreatePaymentProviderConfiguration500 =
  | ApiPaymentProviderConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaymentProviderConfigurationsGetPaymentProviderConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderConfigurationsGetPaymentProviderConfiguration500 =
  | ApiPaymentProviderConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaymentProviderConfigurationsDeletePaymentProviderConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaymentProviderConfigurationInUseErrorJsonEncodingTag =
  "Api/PaymentProviderConfigurationInUseError";

export interface ApiPaymentProviderConfigurationInUseErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderConfigurationInUseErrorJsonEncodingTag;
  readonly message: string;
}

export type PaymentProviderConfigurationsDeletePaymentProviderConfiguration500 =
  | ApiPaymentProviderConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePaymentProviderConfigurationBody {
  readonly configuration?: Record<string, unknown> | null | undefined;
  readonly enabled?: boolean | null | undefined;
  readonly name?: string | null | undefined;
}

export type ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncodingTag =
  "Api/PaymentProviderConfigurationKeyUnavailableError";

export interface ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncodingTag;
  readonly message: string;
}

export type PaymentProviderConfigurationsUpdatePaymentProviderConfiguration400 =
  | ApiPaymentProviderConfigurationKeyUnavailableErrorJsonEncoding
  | ApiPaymentProviderConfigurationValidationErrorJsonEncoding;

export type PaymentProviderConfigurationsUpdatePaymentProviderConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderConfigurationsUpdatePaymentProviderConfiguration500 =
  | ApiPaymentProviderConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaymentProviderProductsListPaymentProviderProductsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly paymentProviderConfigurationId?: string | null | undefined;
  readonly productId?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PaymentProviderProductJsonEncoding {
  readonly configuration: Record<string, unknown>;
  readonly id: string;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerId: string;
}

export interface PaymentProviderProductsListPaymentProviderProducts200 {
  readonly data: ReadonlyArray<PaymentProviderProductJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaymentProviderProductsListPaymentProviderProducts401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaymentProviderProductServiceErrorJsonEncodingTag =
  "Api/PaymentProviderProductServiceError";

export interface ApiPaymentProviderProductServiceErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderProductServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaymentProviderProductsListPaymentProviderProducts500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePaymentProviderProductBody {
  readonly configuration: Record<string, unknown>;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
}

export type Objects2 = Record<string, unknown>;

export interface PaymentProviderProductsCreatePaymentProviderProduct201 {
  readonly configuration: Objects2;
  readonly createdAt: string | null;
  readonly id: string;
  readonly isActive: boolean;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerProductKey: string;
  readonly updatedAt: string | null;
}

export type ApiPaymentProviderProductValidationErrorJsonEncodingTag =
  "Api/PaymentProviderProductValidationError";

export interface ApiPaymentProviderProductValidationErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderProductValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type PaymentProviderProductsCreatePaymentProviderProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaymentProviderProductNotFoundErrorJsonEncodingTag =
  "Api/PaymentProviderProductNotFoundError";

export interface ApiPaymentProviderProductNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaymentProviderProductNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type PaymentProviderProductsCreatePaymentProviderProduct500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface Objects3 {
  readonly configuration: Objects2;
  readonly createdAt: string | null;
  readonly id: string;
  readonly isActive: boolean;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerProductKey: string;
  readonly updatedAt: string | null;
}

export type PaymentProviderProductsGetPaymentProviderProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderProductsGetPaymentProviderProduct500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaymentProviderProductsDeletePaymentProviderProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderProductsDeletePaymentProviderProduct500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePaymentProviderProductBody {
  readonly configuration: Record<string, unknown>;
}

export type PaymentProviderProductsUpdatePaymentProviderProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderProductsUpdatePaymentProviderProduct500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaymentProviderProductsActivatePaymentProviderProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaymentProviderProductsActivatePaymentProviderProduct500 =
  | ApiPaymentProviderProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallDeploysListDeploysParamsStatusEnum = "pending" | "ready";

export interface PaywallDeploysListDeploysParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly status?: PaywallDeploysListDeploysParamsStatusEnum | null | undefined;
}

export type PaywallDeployJsonEncodingSchemaVersionEnum = "Infinity" | "-Infinity" | "NaN";

export type PaywallDeployJsonEncodingStatus = "pending" | "ready";

export interface PaywallDeployJsonEncoding {
  readonly cliVersion: string;
  readonly components: ReadonlyArray<{
    readonly componentId: string | null;
    readonly contentHash: string;
    readonly slug: string;
    readonly version: number | "Infinity" | "-Infinity" | "NaN" | null;
  }>;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly id: string;
  readonly paywalls: ReadonlyArray<{
    readonly contentHash: string;
    readonly releaseId: string | null;
    readonly slug: string;
    readonly version: number | "Infinity" | "-Infinity" | "NaN" | null;
  }>;
  readonly runtimeVersion: string;
  readonly schemaVersion: number | PaywallDeployJsonEncodingSchemaVersionEnum;
  readonly status: PaywallDeployJsonEncodingStatus;
}

export interface PaywallDeploysListDeploys200 {
  readonly data: ReadonlyArray<PaywallDeployJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaywallDeploysListDeploys401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallDeployServiceErrorJsonEncodingTag = "Api/PaywallDeployServiceError";

export interface ApiPaywallDeployServiceErrorJsonEncoding {
  readonly _tag: ApiPaywallDeployServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaywallDeploysListDeploys500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaywallDeploysCreateDeployRequest {}

export interface CreatePaywallDeployResponseJsonEncoding {
  readonly deployId: string;
  readonly missing: ReadonlyArray<string>;
}

export type ApiPaywallDeployUpgradeRequiredErrorJsonEncodingTag =
  "Api/PaywallDeployUpgradeRequiredError";

export type ApiPaywallDeployUpgradeRequiredErrorJsonEncodingSchemaVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export interface ApiPaywallDeployUpgradeRequiredErrorJsonEncoding {
  readonly _tag: ApiPaywallDeployUpgradeRequiredErrorJsonEncodingTag;
  readonly message: string;
  readonly schemaVersion:
    | number
    | ApiPaywallDeployUpgradeRequiredErrorJsonEncodingSchemaVersionEnum
    | null;
}

export type PaywallDeploysCreateDeploy401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallDeployValidationErrorJsonEncodingTag = "Api/PaywallDeployValidationError";

export interface ApiPaywallDeployValidationErrorJsonEncoding {
  readonly _tag: ApiPaywallDeployValidationErrorJsonEncodingTag;
  readonly message: string;
  readonly violations: ReadonlyArray<string>;
}

export type PaywallDeploysCreateDeploy500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaywallDeploysGetDeployParams {
  readonly projectId?: string | null | undefined;
}

export type PaywallDeploysGetDeploy401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallDeployNotFoundErrorJsonEncodingTag = "Api/PaywallDeployNotFoundError";

export interface ApiPaywallDeployNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaywallDeployNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallDeploysGetDeploy500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type UploadPaywallDeployBlobResponseJsonEncoding = Record<string, unknown>;

export type PaywallDeploysUploadBlob401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiDeployBlobNotDeclaredErrorJsonEncodingTag = "Api/DeployBlobNotDeclaredError";

export interface ApiDeployBlobNotDeclaredErrorJsonEncoding {
  readonly _tag: ApiDeployBlobNotDeclaredErrorJsonEncodingTag;
  readonly sha256: string;
}

export type PaywallDeploysUploadBlob404 =
  | ApiDeployBlobNotDeclaredErrorJsonEncoding
  | ApiPaywallDeployNotFoundErrorJsonEncoding;

export type ApiPaywallDeployNotPendingErrorJsonEncodingTag = "Api/PaywallDeployNotPendingError";

export interface ApiPaywallDeployNotPendingErrorJsonEncoding {
  readonly _tag: ApiPaywallDeployNotPendingErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiDeployBlobHashMismatchErrorJsonEncodingTag = "Api/DeployBlobHashMismatchError";

export interface ApiDeployBlobHashMismatchErrorJsonEncoding {
  readonly _tag: ApiDeployBlobHashMismatchErrorJsonEncodingTag;
  readonly actualSha256: string;
  readonly expectedSha256: string;
}

export type PaywallDeploysUploadBlob422 =
  | ApiDeployBlobHashMismatchErrorJsonEncoding
  | ApiPaywallDeployValidationErrorJsonEncoding;

export type PaywallDeploysUploadBlob500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type FinalizedPaywallDeployComponentJsonEncodingVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export interface FinalizedPaywallDeployComponentJsonEncoding {
  readonly componentId: string;
  readonly contentHash: string;
  readonly id: string;
  readonly version: number | FinalizedPaywallDeployComponentJsonEncodingVersionEnum;
}

export type FinalizedPaywallDeployPaywallJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface FinalizedPaywallDeployPaywallJsonEncoding {
  readonly contentHash: string;
  readonly id: string;
  readonly paywallId: string;
  readonly releaseId: string;
  readonly url: string;
  readonly version: number | FinalizedPaywallDeployPaywallJsonEncodingVersionEnum;
}

export type FinalizePaywallDeployResponseJsonEncodingStatus = "ready";

export interface FinalizePaywallDeployResponseJsonEncoding {
  readonly components: ReadonlyArray<FinalizedPaywallDeployComponentJsonEncoding>;
  readonly deployId: string;
  readonly paywalls: ReadonlyArray<FinalizedPaywallDeployPaywallJsonEncoding>;
  readonly status: FinalizePaywallDeployResponseJsonEncodingStatus;
}

export type PaywallDeploysFinalizeDeploy401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiIncompleteDeployErrorJsonEncodingTag = "Api/IncompleteDeployError";

export interface ApiIncompleteDeployErrorJsonEncoding {
  readonly _tag: ApiIncompleteDeployErrorJsonEncodingTag;
  readonly missing: ReadonlyArray<string>;
}

export type PaywallDeploysFinalizeDeploy500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallLocationsListPaywallLocationsParamsIncludeArchivedEnum = "true" | "false";

export interface PaywallLocationsListPaywallLocationsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly includeArchived?:
    | PaywallLocationsListPaywallLocationsParamsIncludeArchivedEnum
    | null
    | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PaywallLocationJsonEncoding {
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export interface PaywallLocationsListPaywallLocations200 {
  readonly data: ReadonlyArray<PaywallLocationJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaywallLocationsListPaywallLocations401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallLocationServiceErrorJsonEncodingTag = "Api/PaywallLocationServiceError";

export interface ApiPaywallLocationServiceErrorJsonEncoding {
  readonly _tag: ApiPaywallLocationServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaywallLocationsListPaywallLocations500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePaywallLocationBodyJsonEncoding {
  readonly description?: string | null | undefined;
  readonly name: string;
  readonly projectId?: string | null | undefined;
  readonly slug: string;
}

export interface PaywallLocationJsonEncoding1 {
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export type PaywallLocationsCreatePaywallLocation401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallLocationSlugAlreadyExistsErrorJsonEncodingTag =
  "Api/PaywallLocationSlugAlreadyExistsError";

export interface ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiPaywallLocationSlugAlreadyExistsErrorJsonEncodingTag;
  readonly slug: string;
}

export type PaywallLocationsCreatePaywallLocation500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaywallLocationsGetPaywallLocationParams {
  readonly projectId?: string | null | undefined;
}

export type PaywallLocationsGetPaywallLocation401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallLocationNotFoundErrorJsonEncodingTag = "Api/PaywallLocationNotFoundError";

export interface ApiPaywallLocationNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaywallLocationNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallLocationsGetPaywallLocation500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallLocationsArchivePaywallLocation401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallLocationsArchivePaywallLocation500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePaywallLocationBodyJsonEncoding {
  readonly description?: string | null | null | undefined;
  readonly name?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export type PaywallLocationsUpdatePaywallLocation401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallLocationsUpdatePaywallLocation500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SetPaywallLocationShowingBodyJsonEncodingType = "paywall_release" | "feature_flag";

export interface SetPaywallLocationShowingBodyJsonEncoding {
  readonly featureFlagId?: string | null | undefined;
  readonly paywallId?: string | null | undefined;
  readonly type: SetPaywallLocationShowingBodyJsonEncodingType;
}

export type PaywallLocationShowingJsonEncodingPaywallReleaseEnumVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type PaywallLocationShowingJsonEncodingType = "paywall_release" | "feature_flag";

export interface PaywallLocationShowingJsonEncoding {
  readonly createdAt: string | null;
  readonly createdByUserId: string | null;
  readonly endedAt: string | null;
  readonly featureFlagId: string | null;
  readonly id: string;
  readonly paywall: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly paywallId: string | null;
  readonly paywallLocationId: string;
  readonly paywallRelease: {
    readonly htmlUrl: string;
    readonly publishedAt: string | null;
    readonly releaseId: string;
    readonly version: number | "Infinity" | "-Infinity" | "NaN";
  } | null;
  readonly paywallReleaseId: string | null;
  readonly projectId: string;
  readonly startedAt: string;
  readonly type: PaywallLocationShowingJsonEncodingType;
  readonly updatedAt: string | null;
}

export type ApiPaywallLocationShowingValidationErrorJsonEncodingTag =
  "Api/PaywallLocationShowingValidationError";

export interface ApiPaywallLocationShowingValidationErrorJsonEncoding {
  readonly _tag: ApiPaywallLocationShowingValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallLocationsSetPaywallLocationShowing401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallNotFoundErrorJsonEncodingTag = "Api/PaywallNotFoundError";

export interface ApiPaywallNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaywallNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallLocationsSetPaywallLocationShowing404 =
  | ApiPaywallLocationNotFoundErrorJsonEncoding
  | ApiPaywallNotFoundErrorJsonEncoding;

export type PaywallLocationsSetPaywallLocationShowing500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallLocationsClearPaywallLocationShowing401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallLocationsClearPaywallLocationShowing500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PaywallLocationsListPaywallLocationShowingsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
}

export interface PaywallLocationsListPaywallLocationShowings200 {
  readonly data: ReadonlyArray<PaywallLocationShowingJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaywallLocationsListPaywallLocationShowings401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallLocationsListPaywallLocationShowings500 =
  | ApiPaywallLocationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsListPaywallsParamsIncludeArchivedEnum = "true" | "false";

export interface PaywallsListPaywallsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly includeArchived?: PaywallsListPaywallsParamsIncludeArchivedEnum | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PaywallJsonEncoding {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly thumbnailUrl: string | null;
}

export interface PaywallsListPaywalls200 {
  readonly data: ReadonlyArray<PaywallJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaywallsListPaywalls401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallServiceErrorJsonEncodingTag = "Api/PaywallServiceError";

export interface ApiPaywallServiceErrorJsonEncoding {
  readonly _tag: ApiPaywallServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PaywallsListPaywalls500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePaywallBodyJsonEncoding {
  readonly name: string;
  readonly projectId?: string | null | undefined;
  readonly slug: string;
}

export interface PaywallJsonEncoding1 {
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly thumbnailUrl: string | null;
}

export type PaywallsCreatePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallSlugAlreadyExistsErrorJsonEncodingTag = "Api/PaywallSlugAlreadyExistsError";

export interface ApiPaywallSlugAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiPaywallSlugAlreadyExistsErrorJsonEncodingTag;
  readonly slug: string;
}

export type PaywallsCreatePaywall500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsGetPaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsGetPaywall500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsArchivePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsArchivePaywall500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePaywallBodyJsonEncoding {
  readonly name?: string | null | undefined;
}

export type PaywallsUpdatePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsUpdatePaywall500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsRestorePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsRestorePaywall500 =
  | ApiPaywallServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsListPaywallReleasesParamsStatusEnum = "draft";

export interface PaywallsListPaywallReleasesParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly status?: PaywallsListPaywallReleasesParamsStatusEnum | null | undefined;
}

export type PaywallReleaseJsonEncodingStatus = "draft" | "published";

export type PaywallReleaseJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface PaywallReleaseJsonEncoding {
  readonly createdAt: string | null;
  readonly paywallId: string;
  readonly publishedAt: string | null;
  readonly releaseId: string;
  readonly status: PaywallReleaseJsonEncodingStatus;
  readonly url: string;
  readonly version: number | PaywallReleaseJsonEncodingVersionEnum;
}

export interface PaywallsListPaywallReleases200 {
  readonly data: ReadonlyArray<PaywallReleaseJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PaywallsListPaywallReleases401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallReleaseErrorJsonEncodingTag = "Api/PaywallReleaseError";

export interface ApiPaywallReleaseErrorJsonEncoding {
  readonly _tag: ApiPaywallReleaseErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallsListPaywallReleases500 =
  | ApiPaywallReleaseErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallReleaseJsonEncoding1Status = "draft" | "published";

export type PaywallReleaseJsonEncoding1VersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface PaywallReleaseJsonEncoding1 {
  readonly createdAt: string | null;
  readonly paywallId: string;
  readonly publishedAt: string | null;
  readonly releaseId: string;
  readonly status: PaywallReleaseJsonEncoding1Status;
  readonly url: string;
  readonly version: number | PaywallReleaseJsonEncoding1VersionEnum;
}

export type PaywallsCreatePaywallRelease401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsCreatePaywallRelease500 =
  | ApiPaywallReleaseErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PaywallsPublishPaywallRelease401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPaywallReleaseNotFoundErrorJsonEncodingTag = "Api/PaywallReleaseNotFoundError";

export interface ApiPaywallReleaseNotFoundErrorJsonEncoding {
  readonly _tag: ApiPaywallReleaseNotFoundErrorJsonEncodingTag;
  readonly releaseId: string;
}

export type PaywallsPublishPaywallRelease404 =
  | ApiPaywallNotFoundErrorJsonEncoding
  | ApiPaywallReleaseNotFoundErrorJsonEncoding;

export type ApiPaywallPublishErrorJsonEncodingTag = "Api/PaywallPublishError";

export interface ApiPaywallPublishErrorJsonEncoding {
  readonly _tag: ApiPaywallPublishErrorJsonEncodingTag;
  readonly message: string;
}

export type PaywallsPublishPaywallRelease500 =
  | ApiPaywallPublishErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ActivatedPaywallReleaseJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN";

export interface ActivatedPaywallReleaseJsonEncoding {
  readonly releaseId: string;
  readonly version: number | ActivatedPaywallReleaseJsonEncodingVersionEnum;
}

export type PaywallsActivatePaywallRelease401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PaywallsActivatePaywallRelease500 =
  | ApiPaywallDeployServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PerksListPerksParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PerkJsonEncoding {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export interface PerksListPerks200 {
  readonly data: ReadonlyArray<PerkJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type PerksListPerks401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPerkServiceErrorJsonEncodingTag = "Api/PerkServiceError";

export interface ApiPerkServiceErrorJsonEncoding {
  readonly _tag: ApiPerkServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PerksListPerks500 = ApiPerkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export interface CreatePerkBodyJsonEncoding {
  readonly name: string;
  readonly projectId?: string | null | undefined;
  readonly slug: string;
}

export interface PerkJsonEncoding1 {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export type PerksCreatePerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPerkSlugAlreadyExistsErrorJsonEncodingTag = "Api/PerkSlugAlreadyExistsError";

export interface ApiPerkSlugAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiPerkSlugAlreadyExistsErrorJsonEncodingTag;
  readonly slug: string;
}

export type PerksCreatePerk500 = ApiPerkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export type PerksGetPerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPerkNotFoundErrorJsonEncodingTag = "Api/PerkNotFoundError";

export interface ApiPerkNotFoundErrorJsonEncoding {
  readonly _tag: ApiPerkNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type PerksGetPerk500 = ApiPerkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export type PerksDeletePerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PerksDeletePerk500 = ApiPerkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePerkBodyJsonEncoding {
  readonly name?: string | null | undefined;
  readonly slug?: string | null | undefined;
}

export type PerksUpdatePerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PerksUpdatePerk500 = ApiPerkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export interface PersonsListPersonsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly distinctId?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PersonJsonEncoding1 {
  readonly personId: string;
  readonly distinctId: string;
  readonly email: string | null;
  readonly name: string | null;
}

export interface PersonsListPersons200 {
  readonly data: ReadonlyArray<PersonJsonEncoding1>;
  readonly pageInfo: PageInfo;
}

export type PersonsListPersons401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPersonServiceErrorJsonEncodingTag = "Api/PersonServiceError";

export interface ApiPersonServiceErrorJsonEncoding {
  readonly _tag: ApiPersonServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PersonsListPersons500 =
  | ApiPersonServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePersonRequestBodyJsonEncoding {
  readonly distinctId: string;
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface PersonJsonEncoding {
  readonly personId: string;
  readonly distinctId: string;
  readonly email: string | null;
  readonly name: string | null;
}

export type PersonsCreatePerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PersonsCreatePerson500 =
  | ApiPersonServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PersonsGetPersonById401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPersonNotFoundErrorJsonEncodingTag = "Api/PersonNotFoundError";

export interface ApiPersonNotFoundErrorJsonEncoding {
  readonly _tag: ApiPersonNotFoundErrorJsonEncodingTag;
  readonly id: string;
}

export type PersonsGetPersonById500 =
  | ApiPersonServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type Objects4 = Record<string, unknown>;

export interface UpdatePersonBodyJsonEncoding {
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly setOnce?: Objects4 | null | undefined;
  readonly traits?: Objects4 | null | undefined;
}

export type PersonsUpdatePerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PersonsUpdatePerson500 =
  | ApiPersonServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkEntitlementGrantJsonEncodingSource = "subscription" | "purchase" | "manual";

export type SdkEntitlementGrantJsonEncodingStatus = "active" | "expired";

export interface SdkEntitlementGrantJsonEncoding {
  readonly expiresAt: string | null;
  readonly perkId: string;
  readonly source: SdkEntitlementGrantJsonEncodingSource;
  readonly sourceId: string | null;
  readonly sourcePersonId: string;
  readonly status: SdkEntitlementGrantJsonEncodingStatus;
}

export interface PersonEntitlementsResponseJsonEncoding {
  readonly grants: ReadonlyArray<SdkEntitlementGrantJsonEncoding>;
}

export type PersonsGetPersonEntitlements401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPerkGrantServiceErrorJsonEncodingTag = "Api/PerkGrantServiceError";

export interface ApiPerkGrantServiceErrorJsonEncoding {
  readonly _tag: ApiPerkGrantServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PersonsGetPersonEntitlements500 =
  | ApiPerkGrantServiceErrorJsonEncoding
  | ApiPersonServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProductsListProductsParamsTypeEnum =
  | "subscription"
  | "one-time"
  | "one-time-consumable";

export interface ProductsListProductsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly type?: ProductsListProductsParamsTypeEnum | null | undefined;
}

export type ProductJsonEncodingDurationEnum = "Infinity" | "-Infinity" | "NaN";

export type ProductJsonEncodingType = "subscription" | "one-time" | "one-time-consumable";

export interface ProductJsonEncoding {
  readonly duration: number | ProductJsonEncodingDurationEnum | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly type: ProductJsonEncodingType;
}

export interface ProductsListProducts200 {
  readonly data: ReadonlyArray<ProductJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type ProductsListProducts401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductServiceErrorJsonEncodingTag = "Api/ProductServiceError";

export interface ApiProductServiceErrorJsonEncoding {
  readonly _tag: ApiProductServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type ProductsListProducts500 =
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type CreateProductBodyJsonEncodingDurationEnum = "Infinity" | "-Infinity" | "NaN";

export type CreateProductBodyJsonEncodingType = "subscription" | "one-time" | "one-time-consumable";

export interface CreateProductBodyJsonEncoding {
  readonly duration?: number | CreateProductBodyJsonEncodingDurationEnum | null | undefined;
  readonly name: string;
  readonly projectId?: string | null | undefined;
  readonly slug: string;
  readonly type: CreateProductBodyJsonEncodingType;
}

export type ProductJsonEncoding1DurationEnum = "Infinity" | "-Infinity" | "NaN";

export type ProductJsonEncoding1Type = "subscription" | "one-time" | "one-time-consumable";

export interface ProductJsonEncoding1 {
  readonly duration: number | ProductJsonEncoding1DurationEnum | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly type: ProductJsonEncoding1Type;
}

export type ApiProductValidationErrorJsonEncodingTag = "Api/ProductValidationError";

export interface ApiProductValidationErrorJsonEncoding {
  readonly _tag: ApiProductValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type ProductsCreateProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductSlugAlreadyExistsErrorJsonEncodingTag = "Api/ProductSlugAlreadyExistsError";

export interface ApiProductSlugAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiProductSlugAlreadyExistsErrorJsonEncodingTag;
  readonly slug: string;
}

export type ProductsCreateProduct500 =
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProductsGetProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductNotFoundErrorJsonEncodingTag = "Api/ProductNotFoundError";

export interface ApiProductNotFoundErrorJsonEncoding {
  readonly _tag: ApiProductNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ProductsGetProduct500 =
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProductsDeleteProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ProductsDeleteProduct500 =
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdateProductBodyJsonEncoding {
  readonly name?: string | null | undefined;
  readonly slug?: string | null | undefined;
}

export type ProductsUpdateProduct401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ProductsUpdateProduct500 =
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface ProductsListProductPerksParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
}

export interface ProductPerkJsonEncoding {
  readonly id: string;
  readonly perkId: string;
  readonly productId: string;
}

export interface ProductsListProductPerks200 {
  readonly data: ReadonlyArray<ProductPerkJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type ApiProductPerkValidationErrorJsonEncodingTag = "Api/ProductPerkValidationError";

export interface ApiProductPerkValidationErrorJsonEncoding {
  readonly _tag: ApiProductPerkValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type ProductsListProductPerks401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductPerkServiceErrorJsonEncodingTag = "Api/ProductPerkServiceError";

export interface ApiProductPerkServiceErrorJsonEncoding {
  readonly _tag: ApiProductPerkServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type ProductsListProductPerks500 =
  | ApiProductPerkServiceErrorJsonEncoding
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface AttachProductPerkBodyJsonEncoding {
  readonly perkId: string;
}

export interface ProductPerkJsonEncoding1 {
  readonly id: string;
  readonly perkId: string;
  readonly productId: string;
}

export type ProductsAttachProductPerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductPerkAlreadyExistsErrorJsonEncodingTag = "Api/ProductPerkAlreadyExistsError";

export interface ApiProductPerkAlreadyExistsErrorJsonEncoding {
  readonly _tag: ApiProductPerkAlreadyExistsErrorJsonEncodingTag;
  readonly perkId: string;
  readonly productId: string;
}

export type ProductsAttachProductPerk500 =
  | ApiProductPerkServiceErrorJsonEncoding
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProductsDetachProductPerk401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProductPerkNotFoundErrorJsonEncodingTag = "Api/ProductPerkNotFoundError";

export interface ApiProductPerkNotFoundErrorJsonEncoding {
  readonly _tag: ApiProductPerkNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ProductsDetachProductPerk404 =
  | ApiProductNotFoundErrorJsonEncoding
  | ApiProductPerkNotFoundErrorJsonEncoding;

export type ProductsDetachProductPerk500 =
  | ApiProductPerkServiceErrorJsonEncoding
  | ApiProductServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreateProjectBodyJsonEncoding {
  readonly name: string;
  readonly organizationId: string;
}

export interface ProjectJsonEncoding1 {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type ProjectsCreateProject401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ProjectsCreateProject500 =
  | ApiProjectServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProjectsGetProjectById401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiProjectNotFoundErrorJsonEncodingTag = "Api/ProjectNotFoundError";

export interface ApiProjectNotFoundErrorJsonEncoding {
  readonly _tag: ApiProjectNotFoundErrorJsonEncodingTag;
  readonly projectId: string;
}

export type ProjectsGetProjectById500 =
  | ApiProjectServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type ProjectsDeleteProject401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ProjectsDeleteProject500 =
  | ApiProjectServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdateProjectBodyJsonEncoding {
  readonly name?: string | null | undefined;
}

export type ProjectsUpdateProject401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ProjectsUpdateProject500 =
  | ApiProjectServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface PushNotificationConfigurationsListPushNotificationConfigurationsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
  readonly providerId?: string | null | undefined;
}

export type Objects6 = Record<string, unknown>;

export interface Objects5 {
  readonly activeProviderId: string | null;
  readonly configuration: Objects6;
  readonly createdAt: string | null;
  readonly deletedAt: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly pushProviderKey: string;
  readonly updatedAt: string | null;
}

export interface PushNotificationConfigurationsListPushNotificationConfigurations200 {
  readonly data: ReadonlyArray<Objects5>;
  readonly pageInfo: PageInfo;
}

export type PushNotificationConfigurationsListPushNotificationConfigurations401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushNotificationConfigurationServiceErrorJsonEncodingTag =
  "Api/PushNotificationConfigurationServiceError";

export interface ApiPushNotificationConfigurationServiceErrorJsonEncoding {
  readonly _tag: ApiPushNotificationConfigurationServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type PushNotificationConfigurationsListPushNotificationConfigurations500 =
  | ApiPushNotificationConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreatePushNotificationConfigurationBody {
  readonly projectId?: string | null | undefined;
  readonly providerId: string;
}

export interface PushNotificationConfigurationsCreatePushNotificationConfiguration201 {
  readonly activeProviderId: string | null;
  readonly configuration: Objects6;
  readonly createdAt: string | null;
  readonly deletedAt: string | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly pushProviderKey: string;
  readonly updatedAt: string | null;
}

export type PushNotificationConfigurationsCreatePushNotificationConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushNotificationConfigurationNotFoundErrorJsonEncodingTag =
  "Api/PushNotificationConfigurationNotFoundError";

export interface ApiPushNotificationConfigurationNotFoundErrorJsonEncoding {
  readonly _tag: ApiPushNotificationConfigurationNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncodingTag =
  "Api/PushNotificationConfigurationKeyUnavailableError";

export interface ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding {
  readonly _tag: ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncodingTag;
  readonly message: string;
}

export type PushNotificationConfigurationsCreatePushNotificationConfiguration500 =
  | ApiPushNotificationConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PushNotificationConfigurationsGetPushNotificationConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PushNotificationConfigurationsGetPushNotificationConfiguration500 =
  | ApiPushNotificationConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type PushNotificationConfigurationsDeletePushNotificationConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PushNotificationConfigurationsDeletePushNotificationConfiguration500 =
  | ApiPushNotificationConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UpdatePushNotificationConfigurationBody {
  readonly configuration?: Record<string, unknown> | null | undefined;
  readonly enabled?: boolean | null | undefined;
  readonly name?: string | null | undefined;
}

export type ApiPushNotificationConfigurationValidationErrorJsonEncodingTag =
  "Api/PushNotificationConfigurationValidationError";

export interface ApiPushNotificationConfigurationValidationErrorJsonEncoding {
  readonly _tag: ApiPushNotificationConfigurationValidationErrorJsonEncodingTag;
  readonly cause: string;
}

export type PushNotificationConfigurationsUpdatePushNotificationConfiguration401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type PushNotificationConfigurationsUpdatePushNotificationConfiguration500 =
  | ApiPushNotificationConfigurationServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface SchemaGetSchemaParams {
  readonly projectId?: string | null | undefined;
}

export interface SchemaLocationJsonEncoding {
  readonly description: string | null;
  readonly name: string;
  readonly slug: string;
}

export interface SchemaPerkJsonEncoding {
  readonly name: string;
  readonly slug: string;
}

export type SchemaProductJsonEncodingDurationEnum =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semi-annual"
  | "annual";

export type Objects7 = Record<string, unknown>;

export type SchemaProductProviderJsonEncodingProviderId = "appleAppStore" | "googlePlay";

export interface SchemaProductProviderJsonEncoding {
  readonly configuration: Objects7;
  readonly providerId: SchemaProductProviderJsonEncodingProviderId;
}

export type SchemaProductJsonEncodingType = "subscription" | "one-time" | "one-time-consumable";

export interface SchemaProductJsonEncoding {
  readonly duration: SchemaProductJsonEncodingDurationEnum | null;
  readonly name: string;
  readonly perks: ReadonlyArray<string>;
  readonly providers: ReadonlyArray<SchemaProductProviderJsonEncoding>;
  readonly slug: string;
  readonly type: SchemaProductJsonEncodingType;
}

export interface ProjectSchemaResponseJsonEncoding {
  readonly enabledProviders: ReadonlyArray<"appleAppStore" | "googlePlay">;
  readonly locations: ReadonlyArray<SchemaLocationJsonEncoding>;
  readonly perks: ReadonlyArray<SchemaPerkJsonEncoding>;
  readonly products: ReadonlyArray<SchemaProductJsonEncoding>;
  readonly version: string;
}

export type SchemaGetSchema401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiSchemaServiceErrorJsonEncodingTag = "Api/SchemaServiceError";

export interface ApiSchemaServiceErrorJsonEncoding {
  readonly _tag: ApiSchemaServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type SchemaGetSchema500 =
  | ApiSchemaServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface SchemaGetSchemaVersionParams {
  readonly projectId?: string | null | undefined;
}

export interface SchemaVersionJsonEncoding {
  readonly version: string;
}

export type SchemaGetSchemaVersion401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SchemaGetSchemaVersion500 =
  | ApiSchemaServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkGetPersonParamsXIsBackgrounded = "false";

export type SdkGetPersonParamsXIsDebugBuild = "true" | "false";

export type SdkGetPersonParamsXObserverMode = "true" | "false";

export type SdkGetPersonParamsXPlatformFlavor = "native" | "browser";

export type SdkGetPersonParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkGetPersonParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkGetPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkGetPersonParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkGetPersonParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkGetPersonParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetPersonParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkGetPersonParamsXEnvironmentEnum | null | undefined;
}

export type SdkPurchaseHistoryEntryJsonEncodingType = "one_time" | "subscription";

export interface SdkPurchaseHistoryEntryJsonEncoding {
  readonly createdAt: string;
  readonly productId: string | null;
  readonly providerKey: string;
  readonly purchaseId: string;
  readonly sourcePersonId: string;
  readonly type: SdkPurchaseHistoryEntryJsonEncodingType;
}

export type SdkPersonJsonEncodingSnapshotContextMode = "persisted" | "temporary_pending_transfer";

export type SdkCurrentSubscriptionJsonEncodingStatus =
  | "none"
  | "active"
  | "canceled"
  | "past_due"
  | "trialing";

export interface SdkCurrentSubscriptionJsonEncoding {
  readonly expiresAt: string | null;
  readonly productId: string | null;
  readonly status: SdkCurrentSubscriptionJsonEncodingStatus;
  readonly subscriptionId: string | null;
}

export type SdkSubscriptionHistoryEntryJsonEncodingStatus =
  | "active"
  | "canceled"
  | "expired"
  | "trialing"
  | "past_due";

export interface SdkSubscriptionHistoryEntryJsonEncoding {
  readonly canceledAt: string | null;
  readonly expiresAt: string | null;
  readonly isTrial: boolean;
  readonly productId: string | null;
  readonly sourcePersonId: string;
  readonly startsAt: string;
  readonly status: SdkSubscriptionHistoryEntryJsonEncodingStatus;
  readonly subscriptionId: string;
}

export interface SdkPersonJsonEncoding {
  readonly distinctId: string;
  readonly email: string | null;
  readonly entitlements: {
    readonly grants: ReadonlyArray<SdkEntitlementGrantJsonEncoding>;
  };
  readonly name: string | null;
  readonly personId: string;
  readonly purchases: {
    readonly history: ReadonlyArray<SdkPurchaseHistoryEntryJsonEncoding>;
  };
  readonly snapshotContext: {
    readonly includedPersonIds: ReadonlyArray<string>;
    readonly migrationJobId: string | null;
    readonly mode: SdkPersonJsonEncodingSnapshotContextMode;
  };
  readonly subscriptions: {
    readonly current: SdkCurrentSubscriptionJsonEncoding | null;
    readonly history: ReadonlyArray<SdkSubscriptionHistoryEntryJsonEncoding>;
  };
}

export type ApiSdkValidationErrorJsonEncodingTag = "Api/SdkValidationError";

export interface ApiSdkValidationErrorJsonEncoding {
  readonly _tag: ApiSdkValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type SdkGetPerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiSdkPersonNotFoundErrorJsonEncodingTag = "Api/SdkPersonNotFoundError";

export interface ApiSdkPersonNotFoundErrorJsonEncoding {
  readonly _tag: ApiSdkPersonNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiSdkServiceErrorJsonEncodingTag = "Api/SdkServiceError";

export interface ApiSdkServiceErrorJsonEncoding {
  readonly _tag: ApiSdkServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type SdkGetPerson500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export type SdkIdentifyPersonParamsXIsBackgrounded = "false";

export type SdkIdentifyPersonParamsXIsDebugBuild = "true" | "false";

export type SdkIdentifyPersonParamsXObserverMode = "true" | "false";

export type SdkIdentifyPersonParamsXPlatformFlavor = "native" | "browser";

export type SdkIdentifyPersonParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkIdentifyPersonParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkIdentifyPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkIdentifyPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkIdentifyPersonParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkIdentifyPersonParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkIdentifyPersonParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkIdentifyPersonParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkIdentifyPersonParamsXEnvironmentEnum | null | undefined;
}

export interface SdkIdentifyBodyJsonEncoding {
  readonly distinctId: string;
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly traits?: Objects4 | null | undefined;
}

export type SdkIdentifyPerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag =
  "Api/SdkPersonAlreadyIdentifiedError";

export interface ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding {
  readonly _tag: ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag;
  readonly distinctId: string;
}

export type SdkIdentifyPerson500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export type SdkSyncPersonAttributesParamsXIsBackgrounded = "false";

export type SdkSyncPersonAttributesParamsXIsDebugBuild = "true" | "false";

export type SdkSyncPersonAttributesParamsXObserverMode = "true" | "false";

export type SdkSyncPersonAttributesParamsXPlatformFlavor = "native" | "browser";

export type SdkSyncPersonAttributesParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkSyncPersonAttributesParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkSyncPersonAttributesParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncPersonAttributesParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncPersonAttributesParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncPersonAttributesParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncPersonAttributesParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncPersonAttributesParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkSyncPersonAttributesParamsXEnvironmentEnum | null | undefined;
}

export interface SdkSyncPersonAttributesBodyJsonEncoding {
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly traits?: Objects4 | null | undefined;
  readonly setOnce?: Objects4 | null | undefined;
  readonly clientEventId?: string | null | undefined;
}

export type SdkSyncPersonAttributes401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkSyncPersonAttributes500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkSyncTransactionParamsXIsBackgrounded = "false";

export type SdkSyncTransactionParamsXIsDebugBuild = "true" | "false";

export type SdkSyncTransactionParamsXObserverMode = "true" | "false";

export type SdkSyncTransactionParamsXPlatformFlavor = "native" | "browser";

export type SdkSyncTransactionParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkSyncTransactionParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkSyncTransactionParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncTransactionParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncTransactionParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncTransactionParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncTransactionParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncTransactionParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkSyncTransactionParamsXEnvironmentEnum | null | undefined;
}

export type SdkSyncTransactionRequestPlatform = "ios" | "android";

export type SdkSyncTransactionRequestPurchaseDateEnum = "Infinity" | "-Infinity" | "NaN";

export type SdkSyncTransactionRequestQuantityEnum = "Infinity" | "-Infinity" | "NaN";

export interface SdkSyncTransactionRequest {
  readonly appAccountToken?: string | null | undefined;
  readonly platform: SdkSyncTransactionRequestPlatform;
  readonly providerProductId?: string | null | undefined;
  readonly productSlug: string;
  readonly purchaseDate: number | SdkSyncTransactionRequestPurchaseDateEnum;
  readonly purchaseToken?: string | null | undefined;
  readonly quantity: number | SdkSyncTransactionRequestQuantityEnum;
  readonly receipt?: string | null | undefined;
  readonly transactionId: string;
}

export interface SdkSyncTransactionResponseJsonEncoding {
  readonly accepted: boolean;
}

export type SdkSyncTransaction401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkSyncTransaction500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkDevelopmentPurchaseParamsXIsBackgrounded = "false";

export type SdkDevelopmentPurchaseParamsXIsDebugBuild = "true" | "false";

export type SdkDevelopmentPurchaseParamsXObserverMode = "true" | "false";

export type SdkDevelopmentPurchaseParamsXPlatformFlavor = "native" | "browser";

export type SdkDevelopmentPurchaseParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkDevelopmentPurchaseParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkDevelopmentPurchaseParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkDevelopmentPurchaseParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkDevelopmentPurchaseParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkDevelopmentPurchaseParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkDevelopmentPurchaseParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkDevelopmentPurchaseParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkDevelopmentPurchaseParamsXEnvironmentEnum | null | undefined;
}

export type SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum = "Infinity" | "-Infinity" | "NaN";

export interface SdkDevelopmentPurchaseBodyJsonEncoding {
  readonly devTransactionId: string;
  readonly productSlug: string;
  readonly purchaseDate: number | SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum;
  readonly quantity?:
    | number
    | SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum
    | null
    | undefined;
}

export interface SdkDevelopmentPurchaseResponseJsonEncoding {
  readonly accepted: boolean;
  readonly warning: string | null;
}

export type SdkDevelopmentPurchase401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkDevelopmentPurchase500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkEvaluateFeatureFlagsParamsXIsBackgrounded = "false";

export type SdkEvaluateFeatureFlagsParamsXIsDebugBuild = "true" | "false";

export type SdkEvaluateFeatureFlagsParamsXObserverMode = "true" | "false";

export type SdkEvaluateFeatureFlagsParamsXPlatformFlavor = "native" | "browser";

export type SdkEvaluateFeatureFlagsParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkEvaluateFeatureFlagsParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkEvaluateFeatureFlagsParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkEvaluateFeatureFlagsParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkEvaluateFeatureFlagsParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkEvaluateFeatureFlagsParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkEvaluateFeatureFlagsParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkEvaluateFeatureFlagsParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkEvaluateFeatureFlagsParamsXEnvironmentEnum | null | undefined;
}

export interface EvaluateFeatureFlagsBodyJsonEncoding {
  readonly flagKeys?: ReadonlyArray<string> | null | undefined;
}

export type SdkEvaluateFeatureFlags401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkEvaluateFeatureFlags500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkResolvePaywallParamsXIsBackgrounded = "false";

export type SdkResolvePaywallParamsXIsDebugBuild = "true" | "false";

export type SdkResolvePaywallParamsXObserverMode = "true" | "false";

export type SdkResolvePaywallParamsXPlatformFlavor = "native" | "browser";

export type SdkResolvePaywallParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkResolvePaywallParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkResolvePaywallParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkResolvePaywallParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkResolvePaywallParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkResolvePaywallParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkResolvePaywallParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkResolvePaywallParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkResolvePaywallParamsXEnvironmentEnum | null | undefined;
}

export interface SdkResolvePaywallBodyJsonEncoding {
  readonly locationSlug: string;
}

export type SdkResolvedPaywallShowingJsonEncodingPaywallReleaseEnumVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkResolvedPaywallShowingJsonEncodingType = "paywall_release" | "feature_flag";

export interface SdkResolvedPaywallShowingJsonEncoding {
  readonly id: string;
  readonly paywall: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly paywallId: string | null;
  readonly paywallRelease: {
    readonly htmlUrl: string;
    readonly publishedAt: string | null;
    readonly releaseId: string;
    readonly runtime: {
      readonly contentHash: string;
      readonly productSlugs: ReadonlyArray<string>;
      readonly variables: Record<string, unknown>;
    } | null;
    readonly version: number | "Infinity" | "-Infinity" | "NaN";
  } | null;
  readonly paywallReleaseId: string | null;
  readonly startedAt: string;
  readonly type: SdkResolvedPaywallShowingJsonEncodingType;
}

export interface SdkResolvedPaywallJsonEncoding {
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly showing: SdkResolvedPaywallShowingJsonEncoding;
}

export type SdkResolvePaywall200 = SdkResolvedPaywallJsonEncoding | null;

export type SdkResolvePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkResolvePaywall500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

export type SdkGetSdkSchemaParamsXIsBackgrounded = "false";

export type SdkGetSdkSchemaParamsXIsDebugBuild = "true" | "false";

export type SdkGetSdkSchemaParamsXObserverMode = "true" | "false";

export type SdkGetSdkSchemaParamsXPlatformFlavor = "native" | "browser";

export type SdkGetSdkSchemaParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkGetSdkSchemaParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkGetSdkSchemaParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetSdkSchemaParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkGetSdkSchemaParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkGetSdkSchemaParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkGetSdkSchemaParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetSdkSchemaParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkGetSdkSchemaParamsXEnvironmentEnum | null | undefined;
}

export interface SdkSchemaJsonEncoding {
  readonly locations: Record<string, unknown>;
  readonly perks: Record<string, unknown>;
  readonly products: Record<string, unknown>;
  readonly version: string;
}

export type SdkGetSdkSchema401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkGetSdkSchema500 =
  | ApiSchemaServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkRegisterDeviceParamsXIsBackgrounded = "false";

export type SdkRegisterDeviceParamsXIsDebugBuild = "true" | "false";

export type SdkRegisterDeviceParamsXObserverMode = "true" | "false";

export type SdkRegisterDeviceParamsXPlatformFlavor = "native" | "browser";

export type SdkRegisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkRegisterDeviceParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkRegisterDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkRegisterDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkRegisterDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkRegisterDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkRegisterDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkRegisterDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkRegisterDeviceParamsXEnvironmentEnum | null | undefined;
}

export type RegisterDeviceBodyJsonEncodingPlatform = "ios" | "android";

export type RegisterDeviceBodyJsonEncodingProvider = "fcm" | "apns";

export type RegisterDeviceBodyJsonEncodingEnvironmentEnum = "sandbox" | "production";

export interface RegisterDeviceBodyJsonEncoding {
  readonly platform: RegisterDeviceBodyJsonEncodingPlatform;
  readonly provider: RegisterDeviceBodyJsonEncodingProvider;
  readonly platformToken: string;
  readonly bundleId?: string | null | undefined;
  readonly environment?: RegisterDeviceBodyJsonEncodingEnvironmentEnum | null | undefined;
  readonly previousPushDeviceTokenId?: string | null | undefined;
}

export interface RegisterDeviceResponseJsonEncoding {
  readonly pushDeviceTokenId: string;
}

export type SdkRegisterDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiPushDeviceNotFoundErrorJsonEncodingTag = "Api/PushDeviceNotFoundError";

export interface ApiPushDeviceNotFoundErrorJsonEncoding {
  readonly _tag: ApiPushDeviceNotFoundErrorJsonEncodingTag;
  readonly message: string;
}

export type ApiPushDeviceServiceErrorJsonEncodingTag = "Api/PushDeviceServiceError";

export interface ApiPushDeviceServiceErrorJsonEncoding {
  readonly _tag: ApiPushDeviceServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type SdkRegisterDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkRefreshDeviceParamsXIsBackgrounded = "false";

export type SdkRefreshDeviceParamsXIsDebugBuild = "true" | "false";

export type SdkRefreshDeviceParamsXObserverMode = "true" | "false";

export type SdkRefreshDeviceParamsXPlatformFlavor = "native" | "browser";

export type SdkRefreshDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkRefreshDeviceParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkRefreshDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkRefreshDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkRefreshDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkRefreshDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkRefreshDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkRefreshDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkRefreshDeviceParamsXEnvironmentEnum | null | undefined;
}

export interface RefreshDeviceBodyJsonEncoding {
  readonly pushDeviceTokenId: string;
  readonly platformToken: string;
}

export type SdkRefreshDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkRefreshDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export type SdkUnregisterDeviceParamsXIsBackgrounded = "false";

export type SdkUnregisterDeviceParamsXIsDebugBuild = "true" | "false";

export type SdkUnregisterDeviceParamsXObserverMode = "true" | "false";

export type SdkUnregisterDeviceParamsXPlatformFlavor = "native" | "browser";

export type SdkUnregisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export type SdkUnregisterDeviceParamsXEnvironmentEnum = "production" | "development" | "all";

export interface SdkUnregisterDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkUnregisterDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkUnregisterDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkUnregisterDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkUnregisterDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkUnregisterDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkUnregisterDeviceParamsXEnvironmentEnum | null | undefined;
}

export interface UnregisterDeviceBodyJsonEncoding {
  readonly pushDeviceTokenId: string;
}

export type SdkUnregisterDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkUnregisterDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface UserJsonEncoding {
  readonly createdAt: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly slug: string;
    readonly workosOrganizationId: string | null;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly organizationId: string;
    readonly slug: string;
  }>;
  readonly updatedAt: string;
}

export type UsersGetUser401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export interface WebhooksListWebhookEndpointsParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export type WebhookEndpointJsonEncodingConsecutiveFailuresEnum = "Infinity" | "-Infinity" | "NaN";

export type WebhookEndpointJsonEncodingStatus = "active" | "disabled" | "failed";

export interface WebhookEndpointJsonEncoding {
  readonly consecutiveFailures: number | WebhookEndpointJsonEncodingConsecutiveFailuresEnum;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly events: ReadonlyArray<
    | "person.created"
    | "person.updated"
    | "person.deleted"
    | "subscription.created"
    | "subscription.renewed"
    | "subscription.cancelled"
    | "subscription.expired"
    | "purchase.completed"
    | "purchase.refunded"
  >;
  readonly id: string;
  readonly lastSuccessAt: string | null;
  readonly name: string;
  readonly projectId: string;
  readonly status: WebhookEndpointJsonEncodingStatus;
  readonly url: string;
}

export interface WebhooksListWebhookEndpoints200 {
  readonly data: ReadonlyArray<WebhookEndpointJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type WebhooksListWebhookEndpoints401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiWebhookServiceErrorJsonEncodingTag = "Api/WebhookServiceError";

export interface ApiWebhookServiceErrorJsonEncoding {
  readonly _tag: ApiWebhookServiceErrorJsonEncodingTag;
  readonly cause: string;
}

export type WebhooksListWebhookEndpoints500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface CreateWebhookEndpointBodyJsonEncoding {
  readonly description?: string | null | undefined;
  readonly events: ReadonlyArray<string>;
  readonly name: string;
  readonly projectId?: string | null | undefined;
  readonly url: string;
}

export type WebhookEndpointWithSecretJsonEncodingConsecutiveFailuresEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type Arrays5 = ReadonlyArray<
  | "person.created"
  | "person.updated"
  | "person.deleted"
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "subscription.expired"
  | "purchase.completed"
  | "purchase.refunded"
>;

export type WebhookEndpointWithSecretJsonEncodingStatus = "active" | "disabled" | "failed";

export interface WebhookEndpointWithSecretJsonEncoding {
  readonly consecutiveFailures:
    | number
    | WebhookEndpointWithSecretJsonEncodingConsecutiveFailuresEnum;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly events: Arrays5;
  readonly id: string;
  readonly lastSuccessAt: string | null;
  readonly name: string;
  readonly projectId: string;
  readonly secret: string;
  readonly status: WebhookEndpointWithSecretJsonEncodingStatus;
  readonly url: string;
}

export type ApiWebhookValidationErrorJsonEncodingTag = "Api/WebhookValidationError";

export interface ApiWebhookValidationErrorJsonEncoding {
  readonly _tag: ApiWebhookValidationErrorJsonEncodingTag;
  readonly message: string;
}

export type WebhooksCreateWebhookEndpoint401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksCreateWebhookEndpoint500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksGetWebhookEndpointParams {
  readonly projectId?: string | null | undefined;
}

export type WebhooksGetWebhookEndpoint401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiWebhookEndpointNotFoundErrorJsonEncodingTag = "Api/WebhookEndpointNotFoundError";

export interface ApiWebhookEndpointNotFoundErrorJsonEncoding {
  readonly _tag: ApiWebhookEndpointNotFoundErrorJsonEncodingTag;
  readonly endpointId: string;
}

export type WebhooksGetWebhookEndpoint500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksDeleteWebhookEndpointParams {
  readonly projectId?: string | null | undefined;
}

export type WebhooksDeleteWebhookEndpoint401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksDeleteWebhookEndpoint500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksUpdateWebhookEndpointParams {
  readonly projectId?: string | null | undefined;
}

export type UpdateWebhookEndpointBodyJsonEncodingStatusEnum = "active" | "disabled";

export interface UpdateWebhookEndpointBodyJsonEncoding {
  readonly description?: string | null | null | undefined;
  readonly events?: ReadonlyArray<string> | null | undefined;
  readonly name?: string | null | undefined;
  readonly status?: UpdateWebhookEndpointBodyJsonEncodingStatusEnum | null | undefined;
  readonly url?: string | null | undefined;
}

export type WebhooksUpdateWebhookEndpoint401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksUpdateWebhookEndpoint500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksRotateWebhookSecretParams {
  readonly projectId?: string | null | undefined;
}

export type WebhookEndpointWithSecretJsonEncoding1ConsecutiveFailuresEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type WebhookEndpointWithSecretJsonEncoding1Status = "active" | "disabled" | "failed";

export interface WebhookEndpointWithSecretJsonEncoding1 {
  readonly consecutiveFailures:
    | number
    | WebhookEndpointWithSecretJsonEncoding1ConsecutiveFailuresEnum;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly events: Arrays5;
  readonly id: string;
  readonly lastSuccessAt: string | null;
  readonly name: string;
  readonly projectId: string;
  readonly secret: string;
  readonly status: WebhookEndpointWithSecretJsonEncoding1Status;
  readonly url: string;
}

export type WebhooksRotateWebhookSecret401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksRotateWebhookSecret500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksTestWebhookEndpointParams {
  readonly projectId?: string | null | undefined;
}

export type WebhookDeliveryJsonEncodingAttemptCountEnum = "Infinity" | "-Infinity" | "NaN";

export type WebhookDeliveryJsonEncodingMaxAttemptsEnum = "Infinity" | "-Infinity" | "NaN";

export type WebhookDeliveryJsonEncodingStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "exhausted";

export interface WebhookDeliveryJsonEncoding {
  readonly attemptCount: number | WebhookDeliveryJsonEncodingAttemptCountEnum;
  readonly completedAt: string | null;
  readonly createdAt: string | null;
  readonly eventOccurredAt: string;
  readonly eventType: string;
  readonly id: string;
  readonly maxAttempts: number | WebhookDeliveryJsonEncodingMaxAttemptsEnum;
  readonly nextAttemptAt: string | null;
  readonly projectId: string;
  readonly status: WebhookDeliveryJsonEncodingStatus;
  readonly webhookEndpointId: string;
}

export type WebhooksTestWebhookEndpoint401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksTestWebhookEndpoint500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksListWebhookDeliveriesParams {
  readonly cursor?: string | null | undefined;
  readonly limit?: string | null | undefined;
  readonly endpointId?: string | null | undefined;
  readonly projectId?: string | null | undefined;
}

export interface WebhooksListWebhookDeliveries200 {
  readonly data: ReadonlyArray<WebhookDeliveryJsonEncoding>;
  readonly pageInfo: PageInfo;
}

export type WebhooksListWebhookDeliveries401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksListWebhookDeliveries500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksGetWebhookDeliveryParams {
  readonly projectId?: string | null | undefined;
}

export type WebhookDeliveryWithAttemptsJsonEncodingAttemptCountEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type WebhookDeliveryAttemptJsonEncodingAttemptNumberEnum = "Infinity" | "-Infinity" | "NaN";

export type WebhookDeliveryAttemptJsonEncodingDurationMsEnum = "Infinity" | "-Infinity" | "NaN";

export type WebhookDeliveryAttemptJsonEncodingStatusCodeEnum = "Infinity" | "-Infinity" | "NaN";

export interface WebhookDeliveryAttemptJsonEncoding {
  readonly attemptNumber: number | WebhookDeliveryAttemptJsonEncodingAttemptNumberEnum;
  readonly createdAt: string | null;
  readonly durationMs: number | WebhookDeliveryAttemptJsonEncodingDurationMsEnum | null;
  readonly errorMessage: string | null;
  readonly id: string;
  readonly responseBody: string | null;
  readonly statusCode: number | WebhookDeliveryAttemptJsonEncodingStatusCodeEnum | null;
  readonly succeeded: boolean;
}

export type WebhookDeliveryWithAttemptsJsonEncodingMaxAttemptsEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type WebhookDeliveryWithAttemptsJsonEncodingStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "exhausted";

export interface WebhookDeliveryWithAttemptsJsonEncoding {
  readonly attemptCount: number | WebhookDeliveryWithAttemptsJsonEncodingAttemptCountEnum;
  readonly attempts: ReadonlyArray<WebhookDeliveryAttemptJsonEncoding>;
  readonly completedAt: string | null;
  readonly createdAt: string | null;
  readonly eventOccurredAt: string;
  readonly eventType: string;
  readonly id: string;
  readonly maxAttempts: number | WebhookDeliveryWithAttemptsJsonEncodingMaxAttemptsEnum;
  readonly nextAttemptAt: string | null;
  readonly projectId: string;
  readonly status: WebhookDeliveryWithAttemptsJsonEncodingStatus;
  readonly webhookEndpointId: string;
}

export type WebhooksGetWebhookDelivery401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type ApiWebhookDeliveryNotFoundErrorJsonEncodingTag = "Api/WebhookDeliveryNotFoundError";

export interface ApiWebhookDeliveryNotFoundErrorJsonEncoding {
  readonly _tag: ApiWebhookDeliveryNotFoundErrorJsonEncodingTag;
  readonly deliveryId: string;
}

export type WebhooksGetWebhookDelivery500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export interface WebhooksRetryWebhookDeliveryParams {
  readonly projectId?: string | null | undefined;
}

export type WebhooksRetryWebhookDelivery401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type WebhooksRetryWebhookDelivery500 =
  | ApiWebhookServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?:
      | ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>)
      | undefined;
  } = {},
): VoidhashCoreClient => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description:
                typeof description === "string" ? description : JSON.stringify(description),
            }),
          }),
        ),
    );
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<any, any> =
    options.transformClient
      ? (f) => (request) =>
          Effect.flatMap(
            Effect.flatMap(options.transformClient!(httpClient), (client) =>
              client.execute(request),
            ),
            f,
          )
      : (f) => (request) => Effect.flatMap(httpClient.execute(request), f);
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.HttpClientError>;
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) => Effect.void;
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<never, VoidhashCoreClientError<Tag, E> | HttpClientError.HttpClientError> =>
      Effect.flatMap(response.json as Effect.Effect<E, HttpClientError.HttpClientError>, (cause) =>
        Effect.fail(VoidhashCoreClientError(tag, cause, response)),
      );
  const onRequest = (successCodes: ReadonlyArray<string>, errorCodes?: Record<string, string>) => {
    const cases: any = { orElse: unexpectedStatus };
    for (const code of successCodes) {
      cases[code] = decodeSuccess;
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag);
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid;
    }
    return withResponse(HttpClientResponse.matchStatus(cases) as any);
  };
  return {
    httpClient,
    analyticsQueryInsights: (options) =>
      HttpClientRequest.post(`/api/v1/analytics/queries/insights`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "AnalyticsQueryInsights400",
          "401": "AnalyticsQueryInsights401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "422": "ApiUnknownInsightErrorJsonEncoding",
          "500": "AnalyticsQueryInsights500",
        }),
      ),
    apiKeysListApiKeys: (options) =>
      HttpClientRequest.get(`/api/v1/api-keys`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "ApiKeysListApiKeys401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiKeysListApiKeys500",
        }),
      ),
    apiKeysCreateSecretKey: (options) =>
      HttpClientRequest.post(`/api/v1/api-keys`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ApiKeysCreateSecretKey401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiKeysCreateSecretKey500",
        }),
      ),
    apiKeysGetApiKeyById: (apiKeyId) =>
      HttpClientRequest.get(`/api/v1/api-keys/${apiKeyId}`).pipe(
        onRequest(["2xx"], {
          "401": "ApiKeysGetApiKeyById401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiApiKeyNotFoundErrorJsonEncoding",
          "500": "ApiKeysGetApiKeyById500",
        }),
      ),
    apiKeysDeleteApiKey: (apiKeyId) =>
      HttpClientRequest.delete(`/api/v1/api-keys/${apiKeyId}`).pipe(
        onRequest([], {
          "401": "ApiKeysDeleteApiKey401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiApiKeyNotFoundErrorJsonEncoding",
          "500": "ApiKeysDeleteApiKey500",
        }),
      ),
    apiKeysRotateSecretKey: (apiKeyId) =>
      HttpClientRequest.post(`/api/v1/api-keys/${apiKeyId}/rotate`).pipe(
        onRequest(["2xx"], {
          "401": "ApiKeysRotateSecretKey401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiApiKeyNotFoundErrorJsonEncoding",
          "500": "ApiKeysRotateSecretKey500",
        }),
      ),
    authSession: () =>
      HttpClientRequest.get(`/api/v1/auth/session`).pipe(
        onRequest(["2xx"], {
          "401": "AuthSession401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiAuthServiceErrorJsonEncoding",
        }),
      ),
    developmentGetDevelopmentSettings: (options) =>
      HttpClientRequest.get(`/api/v1/development/settings`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "DevelopmentGetDevelopmentSettings401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
          "500": "DevelopmentGetDevelopmentSettings500",
        }),
      ),
    developmentUpdateDevelopmentSettings: (options) =>
      HttpClientRequest.patch(`/api/v1/development/settings`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "DevelopmentUpdateDevelopmentSettings401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
          "500": "DevelopmentUpdateDevelopmentSettings500",
        }),
      ),
    developmentGetDevelopmentState: (options) =>
      HttpClientRequest.get(`/api/v1/development/state`).pipe(
        HttpClientRequest.setUrlParams({
          personId: options?.["personId"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "DevelopmentGetDevelopmentState401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
          "500": "DevelopmentGetDevelopmentState500",
        }),
      ),
    developmentApplyDevelopmentLifecycleAction: (options) =>
      HttpClientRequest.post(`/api/v1/development/lifecycle-actions`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "DevelopmentApplyDevelopmentLifecycleAction401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
          "500": "DevelopmentApplyDevelopmentLifecycleAction500",
        }),
      ),
    developmentResetDevelopmentData: (options) =>
      HttpClientRequest.delete(`/api/v1/development/data`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest([], {
          "401": "DevelopmentResetDevelopmentData401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
          "500": "DevelopmentResetDevelopmentData500",
        }),
      ),
    eventsListEvents: (options) =>
      HttpClientRequest.get(`/api/v1/events`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          eventName: options?.["eventName"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "EventsListEvents401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "EventsListEvents500",
        }),
      ),
    experimentsListExperiments: (options) =>
      HttpClientRequest.get(`/api/v1/experiments`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          includeArchived: options?.["includeArchived"] as any,
          projectId: options?.["projectId"] as any,
          status: options?.["status"] as any,
        }),
        onRequest(["2xx"], {
          "401": "ExperimentsListExperiments401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ExperimentsListExperiments500",
        }),
      ),
    experimentsCreateExperiment: (options) =>
      HttpClientRequest.post(`/api/v1/experiments`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ExperimentsCreateExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ExperimentsCreateExperiment500",
        }),
      ),
    experimentsGetExperiment: (experimentId) =>
      HttpClientRequest.get(`/api/v1/experiments/${experimentId}`).pipe(
        onRequest(["2xx"], {
          "401": "ExperimentsGetExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "500": "ExperimentsGetExperiment500",
        }),
      ),
    experimentsArchiveExperiment: (experimentId) =>
      HttpClientRequest.delete(`/api/v1/experiments/${experimentId}`).pipe(
        onRequest([], {
          "401": "ExperimentsArchiveExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "500": "ExperimentsArchiveExperiment500",
        }),
      ),
    experimentsUpdateExperiment: (experimentId, options) =>
      HttpClientRequest.patch(`/api/v1/experiments/${experimentId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiExperimentValidationErrorJsonEncoding",
          "401": "ExperimentsUpdateExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ExperimentsUpdateExperiment404",
          "409": "ApiExperimentConflictErrorJsonEncoding",
          "500": "ExperimentsUpdateExperiment500",
        }),
      ),
    experimentsRestoreExperiment: (experimentId) =>
      HttpClientRequest.post(`/api/v1/experiments/${experimentId}/restore`).pipe(
        onRequest(["2xx"], {
          "401": "ExperimentsRestoreExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "500": "ExperimentsRestoreExperiment500",
        }),
      ),
    experimentsStartExperiment: (experimentId) =>
      HttpClientRequest.post(`/api/v1/experiments/${experimentId}/start`).pipe(
        onRequest(["2xx"], {
          "401": "ExperimentsStartExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "409": "ApiExperimentConflictErrorJsonEncoding",
          "500": "ExperimentsStartExperiment500",
        }),
      ),
    experimentsPauseExperiment: (experimentId) =>
      HttpClientRequest.post(`/api/v1/experiments/${experimentId}/pause`).pipe(
        onRequest(["2xx"], {
          "401": "ExperimentsPauseExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "409": "ApiExperimentConflictErrorJsonEncoding",
          "500": "ExperimentsPauseExperiment500",
        }),
      ),
    experimentsConcludeExperiment: (experimentId, options) =>
      HttpClientRequest.post(`/api/v1/experiments/${experimentId}/conclude`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ExperimentsConcludeExperiment401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ExperimentsConcludeExperiment404",
          "409": "ApiExperimentConflictErrorJsonEncoding",
          "500": "ExperimentsConcludeExperiment500",
        }),
      ),
    experimentsGetExperimentResults: (experimentId, options) =>
      HttpClientRequest.get(`/api/v1/experiments/${experimentId}/results`).pipe(
        HttpClientRequest.setUrlParams({ days: options?.["days"] as any }),
        onRequest(["2xx"], {
          "401": "ExperimentsGetExperimentResults401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiExperimentNotFoundErrorJsonEncoding",
          "500": "ExperimentsGetExperimentResults500",
        }),
      ),
    featureFlagOverridesListFeatureFlagOverrides: (options) =>
      HttpClientRequest.get(`/api/v1/feature-flag-overrides`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          featureFlagId: options?.["featureFlagId"] as any,
          identityType: options?.["identityType"] as any,
          identityValue: options?.["identityValue"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "FeatureFlagOverridesListFeatureFlagOverrides401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagOverridesListFeatureFlagOverrides500",
        }),
      ),
    featureFlagOverridesUpsertFeatureFlagOverride: (options) =>
      HttpClientRequest.post(`/api/v1/feature-flag-overrides`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagOverridesUpsertFeatureFlagOverride401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "FeatureFlagOverridesUpsertFeatureFlagOverride404",
          "500": "FeatureFlagOverridesUpsertFeatureFlagOverride500",
        }),
      ),
    featureFlagOverridesArchiveFeatureFlagOverride: (overrideId) =>
      HttpClientRequest.delete(`/api/v1/feature-flag-overrides/${overrideId}`).pipe(
        onRequest([], {
          "401": "FeatureFlagOverridesArchiveFeatureFlagOverride401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagOverrideNotFoundErrorJsonEncoding",
          "500": "FeatureFlagOverridesArchiveFeatureFlagOverride500",
        }),
      ),
    featureFlagTargetsListFeatureFlagTargets: (options) =>
      HttpClientRequest.get(`/api/v1/feature-flag-targets`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          featureFlagId: options?.["featureFlagId"] as any,
          listType: options?.["listType"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "FeatureFlagTargetsListFeatureFlagTargets401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagTargetsListFeatureFlagTargets500",
        }),
      ),
    featureFlagTargetsUpsertFeatureFlagTarget: (options) =>
      HttpClientRequest.post(`/api/v1/feature-flag-targets`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagTargetsUpsertFeatureFlagTarget401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "FeatureFlagTargetsUpsertFeatureFlagTarget404",
          "500": "FeatureFlagTargetsUpsertFeatureFlagTarget500",
        }),
      ),
    featureFlagTargetsArchiveFeatureFlagTarget: (targetId) =>
      HttpClientRequest.delete(`/api/v1/feature-flag-targets/${targetId}`).pipe(
        onRequest([], {
          "401": "FeatureFlagTargetsArchiveFeatureFlagTarget401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagTargetNotFoundErrorJsonEncoding",
          "500": "FeatureFlagTargetsArchiveFeatureFlagTarget500",
        }),
      ),
    featureFlagsListFeatureFlags: (options) =>
      HttpClientRequest.get(`/api/v1/feature-flags`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          includeArchived: options?.["includeArchived"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "FeatureFlagsListFeatureFlags401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "FeatureFlagsListFeatureFlags500",
        }),
      ),
    featureFlagsCreateFeatureFlag: (options) =>
      HttpClientRequest.post(`/api/v1/feature-flags`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagsCreateFeatureFlag401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "409": "ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding",
          "500": "FeatureFlagsCreateFeatureFlag500",
        }),
      ),
    featureFlagsGetFeatureFlag: (featureFlagId) =>
      HttpClientRequest.get(`/api/v1/feature-flags/${featureFlagId}`).pipe(
        onRequest(["2xx"], {
          "401": "FeatureFlagsGetFeatureFlag401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagsGetFeatureFlag500",
        }),
      ),
    featureFlagsArchiveFeatureFlag: (featureFlagId) =>
      HttpClientRequest.delete(`/api/v1/feature-flags/${featureFlagId}`).pipe(
        onRequest([], {
          "401": "FeatureFlagsArchiveFeatureFlag401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagsArchiveFeatureFlag500",
        }),
      ),
    featureFlagsUpdateFeatureFlag: (featureFlagId, options) =>
      HttpClientRequest.patch(`/api/v1/feature-flags/${featureFlagId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagsUpdateFeatureFlag401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "409": "ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding",
          "500": "FeatureFlagsUpdateFeatureFlag500",
        }),
      ),
    featureFlagsRestoreFeatureFlag: (featureFlagId) =>
      HttpClientRequest.post(`/api/v1/feature-flags/${featureFlagId}/restore`).pipe(
        onRequest(["2xx"], {
          "401": "FeatureFlagsRestoreFeatureFlag401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagsRestoreFeatureFlag500",
        }),
      ),
    featureFlagsReplaceFeatureFlagVariants: (featureFlagId, options) =>
      HttpClientRequest.put(`/api/v1/feature-flags/${featureFlagId}/variants`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagsReplaceFeatureFlagVariants401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiFeatureFlagNotFoundErrorJsonEncoding",
          "500": "FeatureFlagsReplaceFeatureFlagVariants500",
        }),
      ),
    featureFlagsEvaluateProjectFeatureFlags: (options) =>
      HttpClientRequest.post(`/api/v1/feature-flags/evaluate`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "FeatureFlagsEvaluateProjectFeatureFlags401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "FeatureFlagsEvaluateProjectFeatureFlags500",
        }),
      ),
    ingestPolicyGetIngestPolicy: (options) =>
      HttpClientRequest.get(`/api/v1/ingest-policy`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "400": "ApiEventAdmissionErrorJsonEncoding",
          "401": "IngestPolicyGetIngestPolicy401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiAuthServiceErrorJsonEncoding",
        }),
      ),
    ingestPolicySetBuiltinEventAdmission: (key, options) =>
      HttpClientRequest.put(`/api/v1/ingest-policy/builtin-events/${key}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiEventAdmissionErrorJsonEncoding",
          "401": "IngestPolicySetBuiltinEventAdmission401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiAuthServiceErrorJsonEncoding",
        }),
      ),
    ingestPolicySetCustomEventBlocked: (eventName, options) =>
      HttpClientRequest.put(`/api/v1/ingest-policy/custom-events/${eventName}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiEventAdmissionErrorJsonEncoding",
          "401": "IngestPolicySetCustomEventBlocked401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiAuthServiceErrorJsonEncoding",
        }),
      ),
    notificationSendsListNotificationSends: (options) =>
      HttpClientRequest.get(`/api/v1/notification-sends`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "NotificationSendsListNotificationSends401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "NotificationSendsListNotificationSends500",
        }),
      ),
    notificationSendsListNotificationSendDeliveries: (sendId, options) =>
      HttpClientRequest.get(`/api/v1/notification-sends/${sendId}/deliveries`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
          status: options?.["status"] as any,
        }),
        onRequest(["2xx"], {
          "401": "NotificationSendsListNotificationSendDeliveries401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushNotificationSendNotFoundErrorJsonEncoding",
          "500": "NotificationSendsListNotificationSendDeliveries500",
        }),
      ),
    notificationsCreateNotification: (options) =>
      HttpClientRequest.post(`/api/v1/notifications`).pipe(
        HttpClientRequest.setHeaders({
          "idempotency-key": options.params?.["idempotency-key"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiPushDeviceValidationErrorJsonEncoding",
          "401": "NotificationsCreateNotification401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiPushSendNotEnabledErrorJsonEncoding",
          "500": "NotificationsCreateNotification500",
        }),
      ),
    organizationsListOrganizations: (options) =>
      HttpClientRequest.get(`/api/v1/organizations`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
        }),
        onRequest(["2xx"], {
          "401": "OrganizationsListOrganizations401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ApiAuthServiceErrorJsonEncoding",
        }),
      ),
    organizationsCreateOrganization: (options) =>
      HttpClientRequest.post(`/api/v1/organizations`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "OrganizationsCreateOrganization401",
          "500": "OrganizationsCreateOrganization500",
        }),
      ),
    organizationsGetOrganization: (organizationId) =>
      HttpClientRequest.get(`/api/v1/organizations/${organizationId}`).pipe(
        onRequest(["2xx"], {
          "401": "OrganizationsGetOrganization401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiOrganizationNotFoundErrorJsonEncoding",
          "500": "OrganizationsGetOrganization500",
        }),
      ),
    organizationsUpdateOrganization: (organizationId, options) =>
      HttpClientRequest.patch(`/api/v1/organizations/${organizationId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "OrganizationsUpdateOrganization401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiOrganizationNotFoundErrorJsonEncoding",
          "500": "OrganizationsUpdateOrganization500",
        }),
      ),
    organizationsListOrganizationProjects: (organizationId, options) =>
      HttpClientRequest.get(`/api/v1/organizations/${organizationId}/projects`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
        }),
        onRequest(["2xx"], {
          "401": "OrganizationsListOrganizationProjects401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "OrganizationsListOrganizationProjects500",
        }),
      ),
    paymentProviderConfigurationsListPaymentProviderConfigurations: (options) =>
      HttpClientRequest.get(`/api/v1/payment-provider-configurations`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
          providerId: options?.["providerId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaymentProviderConfigurationsListPaymentProviderConfigurations401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaymentProviderConfigurationsListPaymentProviderConfigurations500",
        }),
      ),
    paymentProviderConfigurationsCreatePaymentProviderConfiguration: (options) =>
      HttpClientRequest.post(`/api/v1/payment-provider-configurations`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPaymentProviderConfigurationValidationErrorJsonEncoding",
          "401": "PaymentProviderConfigurationsCreatePaymentProviderConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
          "409": "ApiPaymentProviderAlreadyExistsErrorJsonEncoding",
          "500": "PaymentProviderConfigurationsCreatePaymentProviderConfiguration500",
        }),
      ),
    paymentProviderConfigurationsGetPaymentProviderConfiguration: (configurationId) =>
      HttpClientRequest.get(`/api/v1/payment-provider-configurations/${configurationId}`).pipe(
        onRequest(["2xx"], {
          "401": "PaymentProviderConfigurationsGetPaymentProviderConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
          "500": "PaymentProviderConfigurationsGetPaymentProviderConfiguration500",
        }),
      ),
    paymentProviderConfigurationsDeletePaymentProviderConfiguration: (configurationId) =>
      HttpClientRequest.delete(`/api/v1/payment-provider-configurations/${configurationId}`).pipe(
        onRequest([], {
          "401": "PaymentProviderConfigurationsDeletePaymentProviderConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
          "409": "ApiPaymentProviderConfigurationInUseErrorJsonEncoding",
          "500": "PaymentProviderConfigurationsDeletePaymentProviderConfiguration500",
        }),
      ),
    paymentProviderConfigurationsUpdatePaymentProviderConfiguration: (configurationId, options) =>
      HttpClientRequest.patch(`/api/v1/payment-provider-configurations/${configurationId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration400",
          "401": "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
          "500": "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration500",
        }),
      ),
    paymentProviderProductsListPaymentProviderProducts: (options) =>
      HttpClientRequest.get(`/api/v1/payment-provider-products`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          paymentProviderConfigurationId: options?.["paymentProviderConfigurationId"] as any,
          productId: options?.["productId"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaymentProviderProductsListPaymentProviderProducts401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaymentProviderProductsListPaymentProviderProducts500",
        }),
      ),
    paymentProviderProductsCreatePaymentProviderProduct: (options) =>
      HttpClientRequest.post(`/api/v1/payment-provider-products`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPaymentProviderProductValidationErrorJsonEncoding",
          "401": "PaymentProviderProductsCreatePaymentProviderProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
          "500": "PaymentProviderProductsCreatePaymentProviderProduct500",
        }),
      ),
    paymentProviderProductsGetPaymentProviderProduct: (mappingId) =>
      HttpClientRequest.get(`/api/v1/payment-provider-products/${mappingId}`).pipe(
        onRequest(["2xx"], {
          "400": "ApiPaymentProviderProductValidationErrorJsonEncoding",
          "401": "PaymentProviderProductsGetPaymentProviderProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
          "500": "PaymentProviderProductsGetPaymentProviderProduct500",
        }),
      ),
    paymentProviderProductsDeletePaymentProviderProduct: (mappingId) =>
      HttpClientRequest.delete(`/api/v1/payment-provider-products/${mappingId}`).pipe(
        onRequest([], {
          "400": "ApiPaymentProviderProductValidationErrorJsonEncoding",
          "401": "PaymentProviderProductsDeletePaymentProviderProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaymentProviderProductsDeletePaymentProviderProduct500",
        }),
      ),
    paymentProviderProductsUpdatePaymentProviderProduct: (mappingId, options) =>
      HttpClientRequest.patch(`/api/v1/payment-provider-products/${mappingId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPaymentProviderProductValidationErrorJsonEncoding",
          "401": "PaymentProviderProductsUpdatePaymentProviderProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
          "500": "PaymentProviderProductsUpdatePaymentProviderProduct500",
        }),
      ),
    paymentProviderProductsActivatePaymentProviderProduct: (mappingId) =>
      HttpClientRequest.post(`/api/v1/payment-provider-products/${mappingId}/activate`).pipe(
        onRequest(["2xx"], {
          "400": "ApiPaymentProviderProductValidationErrorJsonEncoding",
          "401": "PaymentProviderProductsActivatePaymentProviderProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
          "500": "PaymentProviderProductsActivatePaymentProviderProduct500",
        }),
      ),
    paywallDeploysListDeploys: (options) =>
      HttpClientRequest.get(`/api/v1/paywall-deploys`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
          status: options?.["status"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaywallDeploysListDeploys401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaywallDeploysListDeploys500",
        }),
      ),
    paywallDeploysCreateDeploy: (options) =>
      HttpClientRequest.post(`/api/v1/paywall-deploys`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPaywallDeployUpgradeRequiredErrorJsonEncoding",
          "401": "PaywallDeploysCreateDeploy401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "422": "ApiPaywallDeployValidationErrorJsonEncoding",
          "500": "PaywallDeploysCreateDeploy500",
        }),
      ),
    paywallDeploysGetDeploy: (deployId, options) =>
      HttpClientRequest.get(`/api/v1/paywall-deploys/${deployId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "PaywallDeploysGetDeploy401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallDeployNotFoundErrorJsonEncoding",
          "500": "PaywallDeploysGetDeploy500",
        }),
      ),
    paywallDeploysUploadBlob: (deployId, sha256) =>
      HttpClientRequest.put(`/api/v1/paywall-deploys/${deployId}/blobs/${sha256}`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallDeploysUploadBlob401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "PaywallDeploysUploadBlob404",
          "409": "ApiPaywallDeployNotPendingErrorJsonEncoding",
          "422": "PaywallDeploysUploadBlob422",
          "500": "PaywallDeploysUploadBlob500",
        }),
      ),
    paywallDeploysFinalizeDeploy: (deployId) =>
      HttpClientRequest.post(`/api/v1/paywall-deploys/${deployId}/finalize`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallDeploysFinalizeDeploy401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallDeployNotFoundErrorJsonEncoding",
          "409": "ApiIncompleteDeployErrorJsonEncoding",
          "422": "ApiPaywallDeployValidationErrorJsonEncoding",
          "500": "PaywallDeploysFinalizeDeploy500",
        }),
      ),
    paywallLocationsListPaywallLocations: (options) =>
      HttpClientRequest.get(`/api/v1/paywall-locations`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          includeArchived: options?.["includeArchived"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaywallLocationsListPaywallLocations401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaywallLocationsListPaywallLocations500",
        }),
      ),
    paywallLocationsCreatePaywallLocation: (options) =>
      HttpClientRequest.post(`/api/v1/paywall-locations`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PaywallLocationsCreatePaywallLocation401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding",
          "500": "PaywallLocationsCreatePaywallLocation500",
        }),
      ),
    paywallLocationsGetPaywallLocation: (locationId, options) =>
      HttpClientRequest.get(`/api/v1/paywall-locations/${locationId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "PaywallLocationsGetPaywallLocation401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallLocationNotFoundErrorJsonEncoding",
          "500": "PaywallLocationsGetPaywallLocation500",
        }),
      ),
    paywallLocationsArchivePaywallLocation: (locationId) =>
      HttpClientRequest.delete(`/api/v1/paywall-locations/${locationId}`).pipe(
        onRequest([], {
          "401": "PaywallLocationsArchivePaywallLocation401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallLocationNotFoundErrorJsonEncoding",
          "500": "PaywallLocationsArchivePaywallLocation500",
        }),
      ),
    paywallLocationsUpdatePaywallLocation: (locationId, options) =>
      HttpClientRequest.patch(`/api/v1/paywall-locations/${locationId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PaywallLocationsUpdatePaywallLocation401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallLocationNotFoundErrorJsonEncoding",
          "500": "PaywallLocationsUpdatePaywallLocation500",
        }),
      ),
    paywallLocationsSetPaywallLocationShowing: (locationId, options) =>
      HttpClientRequest.put(`/api/v1/paywall-locations/${locationId}/showing`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPaywallLocationShowingValidationErrorJsonEncoding",
          "401": "PaywallLocationsSetPaywallLocationShowing401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "PaywallLocationsSetPaywallLocationShowing404",
          "500": "PaywallLocationsSetPaywallLocationShowing500",
        }),
      ),
    paywallLocationsClearPaywallLocationShowing: (locationId) =>
      HttpClientRequest.delete(`/api/v1/paywall-locations/${locationId}/showing`).pipe(
        onRequest([], {
          "401": "PaywallLocationsClearPaywallLocationShowing401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallLocationNotFoundErrorJsonEncoding",
          "500": "PaywallLocationsClearPaywallLocationShowing500",
        }),
      ),
    paywallLocationsListPaywallLocationShowings: (locationId, options) =>
      HttpClientRequest.get(`/api/v1/paywall-locations/${locationId}/showings`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaywallLocationsListPaywallLocationShowings401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallLocationNotFoundErrorJsonEncoding",
          "500": "PaywallLocationsListPaywallLocationShowings500",
        }),
      ),
    paywallsListPaywalls: (options) =>
      HttpClientRequest.get(`/api/v1/paywalls`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          includeArchived: options?.["includeArchived"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaywallsListPaywalls401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PaywallsListPaywalls500",
        }),
      ),
    paywallsCreatePaywall: (options) =>
      HttpClientRequest.post(`/api/v1/paywalls`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PaywallsCreatePaywall401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiPaywallSlugAlreadyExistsErrorJsonEncoding",
          "500": "PaywallsCreatePaywall500",
        }),
      ),
    paywallsGetPaywall: (paywallId) =>
      HttpClientRequest.get(`/api/v1/paywalls/${paywallId}`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallsGetPaywall401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsGetPaywall500",
        }),
      ),
    paywallsArchivePaywall: (paywallId) =>
      HttpClientRequest.delete(`/api/v1/paywalls/${paywallId}`).pipe(
        onRequest([], {
          "401": "PaywallsArchivePaywall401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsArchivePaywall500",
        }),
      ),
    paywallsUpdatePaywall: (paywallId, options) =>
      HttpClientRequest.patch(`/api/v1/paywalls/${paywallId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PaywallsUpdatePaywall401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsUpdatePaywall500",
        }),
      ),
    paywallsRestorePaywall: (paywallId) =>
      HttpClientRequest.post(`/api/v1/paywalls/${paywallId}/restore`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallsRestorePaywall401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsRestorePaywall500",
        }),
      ),
    paywallsListPaywallReleases: (paywallId, options) =>
      HttpClientRequest.get(`/api/v1/paywalls/${paywallId}/releases`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          status: options?.["status"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PaywallsListPaywallReleases401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsListPaywallReleases500",
        }),
      ),
    paywallsCreatePaywallRelease: (paywallId) =>
      HttpClientRequest.post(`/api/v1/paywalls/${paywallId}/releases`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallsCreatePaywallRelease401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallNotFoundErrorJsonEncoding",
          "500": "PaywallsCreatePaywallRelease500",
        }),
      ),
    paywallsPublishPaywallRelease: (paywallId, releaseId) =>
      HttpClientRequest.post(`/api/v1/paywalls/${paywallId}/releases/${releaseId}/publish`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallsPublishPaywallRelease401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "PaywallsPublishPaywallRelease404",
          "500": "PaywallsPublishPaywallRelease500",
        }),
      ),
    paywallsActivatePaywallRelease: (paywallId, releaseId) =>
      HttpClientRequest.post(`/api/v1/paywalls/${paywallId}/releases/${releaseId}/activate`).pipe(
        onRequest(["2xx"], {
          "401": "PaywallsActivatePaywallRelease401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPaywallReleaseNotFoundErrorJsonEncoding",
          "422": "ApiPaywallDeployValidationErrorJsonEncoding",
          "500": "PaywallsActivatePaywallRelease500",
        }),
      ),
    perksListPerks: (options) =>
      HttpClientRequest.get(`/api/v1/perks`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PerksListPerks401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PerksListPerks500",
        }),
      ),
    perksCreatePerk: (options) =>
      HttpClientRequest.post(`/api/v1/perks`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PerksCreatePerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiPerkSlugAlreadyExistsErrorJsonEncoding",
          "500": "PerksCreatePerk500",
        }),
      ),
    perksGetPerk: (perkId) =>
      HttpClientRequest.get(`/api/v1/perks/${perkId}`).pipe(
        onRequest(["2xx"], {
          "401": "PerksGetPerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPerkNotFoundErrorJsonEncoding",
          "500": "PerksGetPerk500",
        }),
      ),
    perksDeletePerk: (perkId) =>
      HttpClientRequest.delete(`/api/v1/perks/${perkId}`).pipe(
        onRequest([], {
          "401": "PerksDeletePerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPerkNotFoundErrorJsonEncoding",
          "500": "PerksDeletePerk500",
        }),
      ),
    perksUpdatePerk: (perkId, options) =>
      HttpClientRequest.patch(`/api/v1/perks/${perkId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PerksUpdatePerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPerkNotFoundErrorJsonEncoding",
          "409": "ApiPerkSlugAlreadyExistsErrorJsonEncoding",
          "500": "PerksUpdatePerk500",
        }),
      ),
    personsListPersons: (options) =>
      HttpClientRequest.get(`/api/v1/persons`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          distinctId: options?.["distinctId"] as any,
          email: options?.["email"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PersonsListPersons401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PersonsListPersons500",
        }),
      ),
    personsCreatePerson: (options) =>
      HttpClientRequest.post(`/api/v1/persons`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PersonsCreatePerson401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PersonsCreatePerson500",
        }),
      ),
    personsGetPersonById: (personId) =>
      HttpClientRequest.get(`/api/v1/persons/${personId}`).pipe(
        onRequest(["2xx"], {
          "401": "PersonsGetPersonById401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPersonNotFoundErrorJsonEncoding",
          "500": "PersonsGetPersonById500",
        }),
      ),
    personsUpdatePerson: (personId, options) =>
      HttpClientRequest.patch(`/api/v1/persons/${personId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PersonsUpdatePerson401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPersonNotFoundErrorJsonEncoding",
          "500": "PersonsUpdatePerson500",
        }),
      ),
    personsGetPersonEntitlements: (personId) =>
      HttpClientRequest.get(`/api/v1/persons/${personId}/entitlements`).pipe(
        onRequest(["2xx"], {
          "401": "PersonsGetPersonEntitlements401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPersonNotFoundErrorJsonEncoding",
          "500": "PersonsGetPersonEntitlements500",
        }),
      ),
    productsListProducts: (options) =>
      HttpClientRequest.get(`/api/v1/products`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
          type: options?.["type"] as any,
        }),
        onRequest(["2xx"], {
          "401": "ProductsListProducts401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ProductsListProducts500",
        }),
      ),
    productsCreateProduct: (options) =>
      HttpClientRequest.post(`/api/v1/products`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiProductValidationErrorJsonEncoding",
          "401": "ProductsCreateProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "409": "ApiProductSlugAlreadyExistsErrorJsonEncoding",
          "500": "ProductsCreateProduct500",
        }),
      ),
    productsGetProduct: (productId) =>
      HttpClientRequest.get(`/api/v1/products/${productId}`).pipe(
        onRequest(["2xx"], {
          "401": "ProductsGetProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProductNotFoundErrorJsonEncoding",
          "500": "ProductsGetProduct500",
        }),
      ),
    productsDeleteProduct: (productId) =>
      HttpClientRequest.delete(`/api/v1/products/${productId}`).pipe(
        onRequest([], {
          "400": "ApiProductValidationErrorJsonEncoding",
          "401": "ProductsDeleteProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProductNotFoundErrorJsonEncoding",
          "500": "ProductsDeleteProduct500",
        }),
      ),
    productsUpdateProduct: (productId, options) =>
      HttpClientRequest.patch(`/api/v1/products/${productId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ProductsUpdateProduct401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProductNotFoundErrorJsonEncoding",
          "409": "ApiProductSlugAlreadyExistsErrorJsonEncoding",
          "500": "ProductsUpdateProduct500",
        }),
      ),
    productsListProductPerks: (productId, options) =>
      HttpClientRequest.get(`/api/v1/products/${productId}/perks`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
        }),
        onRequest(["2xx"], {
          "400": "ApiProductPerkValidationErrorJsonEncoding",
          "401": "ProductsListProductPerks401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProductNotFoundErrorJsonEncoding",
          "500": "ProductsListProductPerks500",
        }),
      ),
    productsAttachProductPerk: (productId, options) =>
      HttpClientRequest.post(`/api/v1/products/${productId}/perks`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiProductPerkValidationErrorJsonEncoding",
          "401": "ProductsAttachProductPerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProductNotFoundErrorJsonEncoding",
          "409": "ApiProductPerkAlreadyExistsErrorJsonEncoding",
          "500": "ProductsAttachProductPerk500",
        }),
      ),
    productsDetachProductPerk: (productId, perkId) =>
      HttpClientRequest.delete(`/api/v1/products/${productId}/perks/${perkId}`).pipe(
        onRequest([], {
          "400": "ApiProductPerkValidationErrorJsonEncoding",
          "401": "ProductsDetachProductPerk401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ProductsDetachProductPerk404",
          "500": "ProductsDetachProductPerk500",
        }),
      ),
    projectsCreateProject: (options) =>
      HttpClientRequest.post(`/api/v1/projects`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ProjectsCreateProject401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "ProjectsCreateProject500",
        }),
      ),
    projectsGetProjectById: (projectId) =>
      HttpClientRequest.get(`/api/v1/projects/${projectId}`).pipe(
        onRequest(["2xx"], {
          "401": "ProjectsGetProjectById401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProjectNotFoundErrorJsonEncoding",
          "500": "ProjectsGetProjectById500",
        }),
      ),
    projectsDeleteProject: (projectId) =>
      HttpClientRequest.delete(`/api/v1/projects/${projectId}`).pipe(
        onRequest([], {
          "401": "ProjectsDeleteProject401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProjectNotFoundErrorJsonEncoding",
          "500": "ProjectsDeleteProject500",
        }),
      ),
    projectsUpdateProject: (projectId, options) =>
      HttpClientRequest.patch(`/api/v1/projects/${projectId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "ProjectsUpdateProject401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiProjectNotFoundErrorJsonEncoding",
          "500": "ProjectsUpdateProject500",
        }),
      ),
    pushNotificationConfigurationsListPushNotificationConfigurations: (options) =>
      HttpClientRequest.get(`/api/v1/push-notification-configurations`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
          providerId: options?.["providerId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "PushNotificationConfigurationsListPushNotificationConfigurations401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "PushNotificationConfigurationsListPushNotificationConfigurations500",
        }),
      ),
    pushNotificationConfigurationsCreatePushNotificationConfiguration: (options) =>
      HttpClientRequest.post(`/api/v1/push-notification-configurations`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "401": "PushNotificationConfigurationsCreatePushNotificationConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
          "409": "ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding",
          "500": "PushNotificationConfigurationsCreatePushNotificationConfiguration500",
        }),
      ),
    pushNotificationConfigurationsGetPushNotificationConfiguration: (configurationId) =>
      HttpClientRequest.get(`/api/v1/push-notification-configurations/${configurationId}`).pipe(
        onRequest(["2xx"], {
          "401": "PushNotificationConfigurationsGetPushNotificationConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
          "500": "PushNotificationConfigurationsGetPushNotificationConfiguration500",
        }),
      ),
    pushNotificationConfigurationsDeletePushNotificationConfiguration: (configurationId) =>
      HttpClientRequest.delete(`/api/v1/push-notification-configurations/${configurationId}`).pipe(
        onRequest([], {
          "401": "PushNotificationConfigurationsDeletePushNotificationConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
          "500": "PushNotificationConfigurationsDeletePushNotificationConfiguration500",
        }),
      ),
    pushNotificationConfigurationsUpdatePushNotificationConfiguration: (configurationId, options) =>
      HttpClientRequest.patch(`/api/v1/push-notification-configurations/${configurationId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiPushNotificationConfigurationValidationErrorJsonEncoding",
          "401": "PushNotificationConfigurationsUpdatePushNotificationConfiguration401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
          "409": "ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding",
          "500": "PushNotificationConfigurationsUpdatePushNotificationConfiguration500",
        }),
      ),
    schemaGetSchema: (options) =>
      HttpClientRequest.get(`/api/v1/schema`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "SchemaGetSchema401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "SchemaGetSchema500",
        }),
      ),
    schemaGetSchemaVersion: (options) =>
      HttpClientRequest.get(`/api/v1/schema/version`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "SchemaGetSchemaVersion401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "SchemaGetSchemaVersion500",
        }),
      ),
    sdkGetPerson: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/person`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options?.["x-client-locale"] ?? undefined,
          "x-client-version": options?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options?.["x-nonce"] ?? undefined,
          "x-observer-mode": options?.["x-observer-mode"] ?? undefined,
          "x-platform": options?.["x-platform"] ?? undefined,
          "x-platform-brand": options?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options?.["x-sdk"] ?? undefined,
          "x-sdk-version": options?.["x-sdk-version"] ?? undefined,
          "x-storefront": options?.["x-storefront"] ?? undefined,
          "x-environment": options?.["x-environment"] ?? undefined,
        }),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkGetPerson401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "500": "SdkGetPerson500",
        }),
      ),
    sdkIdentifyPerson: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/identify`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkIdentifyPerson401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "409": "ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding",
          "500": "SdkIdentifyPerson500",
        }),
      ),
    sdkSyncPersonAttributes: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/person/traits`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkSyncPersonAttributes401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "500": "SdkSyncPersonAttributes500",
        }),
      ),
    sdkSyncTransaction: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/sync-transaction`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkSyncTransaction401",
          "500": "SdkSyncTransaction500",
        }),
      ),
    sdkDevelopmentPurchase: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/development/purchase`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkDevelopmentPurchase401",
          "500": "SdkDevelopmentPurchase500",
        }),
      ),
    sdkEvaluateFeatureFlags: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/evaluate-flags`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "401": "SdkEvaluateFeatureFlags401",
          "500": "SdkEvaluateFeatureFlags500",
        }),
      ),
    sdkResolvePaywall: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/resolve-paywall`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkResolvePaywall401",
          "500": "SdkResolvePaywall500",
        }),
      ),
    sdkGetSdkSchema: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/schema`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options?.["x-client-locale"] ?? undefined,
          "x-client-version": options?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options?.["x-nonce"] ?? undefined,
          "x-observer-mode": options?.["x-observer-mode"] ?? undefined,
          "x-platform": options?.["x-platform"] ?? undefined,
          "x-platform-brand": options?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options?.["x-sdk"] ?? undefined,
          "x-sdk-version": options?.["x-sdk-version"] ?? undefined,
          "x-storefront": options?.["x-storefront"] ?? undefined,
          "x-environment": options?.["x-environment"] ?? undefined,
        }),
        onRequest(["2xx"], { "401": "SdkGetSdkSchema401", "500": "SdkGetSdkSchema500" }),
      ),
    sdkRegisterDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/register`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiPushDeviceValidationErrorJsonEncoding",
          "401": "SdkRegisterDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkRegisterDevice500",
        }),
      ),
    sdkRefreshDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/refresh`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest([], {
          "400": "ApiPushDeviceValidationErrorJsonEncoding",
          "401": "SdkRefreshDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkRefreshDevice500",
        }),
      ),
    sdkUnregisterDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/unregister`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
          "x-environment": options.params?.["x-environment"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest([], {
          "401": "SdkUnregisterDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkUnregisterDevice500",
        }),
      ),
    usersGetUser: () =>
      HttpClientRequest.get(`/api/v1/users/current`).pipe(
        onRequest(["2xx"], { "401": "UsersGetUser401", "500": "ApiAuthServiceErrorJsonEncoding" }),
      ),
    webhooksListWebhookEndpoints: (options) =>
      HttpClientRequest.get(`/api/v1/webhooks/endpoints`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "WebhooksListWebhookEndpoints401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "WebhooksListWebhookEndpoints500",
        }),
      ),
    webhooksCreateWebhookEndpoint: (options) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "ApiWebhookValidationErrorJsonEncoding",
          "401": "WebhooksCreateWebhookEndpoint401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "WebhooksCreateWebhookEndpoint500",
        }),
      ),
    webhooksGetWebhookEndpoint: (endpointId, options) =>
      HttpClientRequest.get(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "WebhooksGetWebhookEndpoint401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookEndpointNotFoundErrorJsonEncoding",
          "500": "WebhooksGetWebhookEndpoint500",
        }),
      ),
    webhooksDeleteWebhookEndpoint: (endpointId, options) =>
      HttpClientRequest.delete(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest([], {
          "401": "WebhooksDeleteWebhookEndpoint401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookEndpointNotFoundErrorJsonEncoding",
          "500": "WebhooksDeleteWebhookEndpoint500",
        }),
      ),
    webhooksUpdateWebhookEndpoint: (endpointId, options) =>
      HttpClientRequest.patch(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options.params?.["projectId"] as any }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiWebhookValidationErrorJsonEncoding",
          "401": "WebhooksUpdateWebhookEndpoint401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookEndpointNotFoundErrorJsonEncoding",
          "500": "WebhooksUpdateWebhookEndpoint500",
        }),
      ),
    webhooksRotateWebhookSecret: (endpointId, options) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/rotate-secret`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "WebhooksRotateWebhookSecret401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookEndpointNotFoundErrorJsonEncoding",
          "500": "WebhooksRotateWebhookSecret500",
        }),
      ),
    webhooksTestWebhookEndpoint: (endpointId, options) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/test`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "WebhooksTestWebhookEndpoint401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookEndpointNotFoundErrorJsonEncoding",
          "500": "WebhooksTestWebhookEndpoint500",
        }),
      ),
    webhooksListWebhookDeliveries: (options) =>
      HttpClientRequest.get(`/api/v1/webhooks/deliveries`).pipe(
        HttpClientRequest.setUrlParams({
          cursor: options?.["cursor"] as any,
          limit: options?.["limit"] as any,
          endpointId: options?.["endpointId"] as any,
          projectId: options?.["projectId"] as any,
        }),
        onRequest(["2xx"], {
          "401": "WebhooksListWebhookDeliveries401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "500": "WebhooksListWebhookDeliveries500",
        }),
      ),
    webhooksGetWebhookDelivery: (deliveryId, options) =>
      HttpClientRequest.get(`/api/v1/webhooks/deliveries/${deliveryId}`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "401": "WebhooksGetWebhookDelivery401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookDeliveryNotFoundErrorJsonEncoding",
          "500": "WebhooksGetWebhookDelivery500",
        }),
      ),
    webhooksRetryWebhookDelivery: (deliveryId, options) =>
      HttpClientRequest.post(`/api/v1/webhooks/deliveries/${deliveryId}/retry`).pipe(
        HttpClientRequest.setUrlParams({ projectId: options?.["projectId"] as any }),
        onRequest(["2xx"], {
          "400": "ApiWebhookValidationErrorJsonEncoding",
          "401": "WebhooksRetryWebhookDelivery401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiWebhookDeliveryNotFoundErrorJsonEncoding",
          "500": "WebhooksRetryWebhookDelivery500",
        }),
      ),
  };
};

export interface VoidhashCoreClient {
  readonly httpClient: HttpClient.HttpClient;
  readonly analyticsQueryInsights: (
    options: QueryInsightsBodyJsonEncoding,
  ) => Effect.Effect<
    QueryInsightsResultJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"AnalyticsQueryInsights400", AnalyticsQueryInsights400>
    | VoidhashCoreClientError<"AnalyticsQueryInsights401", AnalyticsQueryInsights401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiUnknownInsightErrorJsonEncoding",
        ApiUnknownInsightErrorJsonEncoding
      >
    | VoidhashCoreClientError<"AnalyticsQueryInsights500", AnalyticsQueryInsights500>
  >;
  readonly apiKeysListApiKeys: (
    options?: ApiKeysListApiKeysParams | undefined,
  ) => Effect.Effect<
    ApiKeysListApiKeys200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ApiKeysListApiKeys401", ApiKeysListApiKeys401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiKeysListApiKeys500", ApiKeysListApiKeys500>
  >;
  readonly apiKeysCreateSecretKey: (
    options: CreateSecretKeyBodyJsonEncoding,
  ) => Effect.Effect<
    ApiKeyWithRawKeyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ApiKeysCreateSecretKey401", ApiKeysCreateSecretKey401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiKeysCreateSecretKey500", ApiKeysCreateSecretKey500>
  >;
  readonly apiKeysGetApiKeyById: (
    apiKeyId: string,
  ) => Effect.Effect<
    ApiKeyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ApiKeysGetApiKeyById401", ApiKeysGetApiKeyById401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiApiKeyNotFoundErrorJsonEncoding",
        ApiApiKeyNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiKeysGetApiKeyById500", ApiKeysGetApiKeyById500>
  >;
  readonly apiKeysDeleteApiKey: (
    apiKeyId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ApiKeysDeleteApiKey401", ApiKeysDeleteApiKey401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiApiKeyNotFoundErrorJsonEncoding",
        ApiApiKeyNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiKeysDeleteApiKey500", ApiKeysDeleteApiKey500>
  >;
  readonly apiKeysRotateSecretKey: (
    apiKeyId: string,
  ) => Effect.Effect<
    ApiKeyWithRawKeyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ApiKeysRotateSecretKey401", ApiKeysRotateSecretKey401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiApiKeyNotFoundErrorJsonEncoding",
        ApiApiKeyNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiKeysRotateSecretKey500", ApiKeysRotateSecretKey500>
  >;
  readonly authSession: () => Effect.Effect<
    AuthSession200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"AuthSession401", AuthSession401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly developmentGetDevelopmentSettings: (
    options?: DevelopmentGetDevelopmentSettingsParams | undefined,
  ) => Effect.Effect<
    DevelopmentSettings,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "DevelopmentGetDevelopmentSettings401",
        DevelopmentGetDevelopmentSettings401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
        ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "DevelopmentGetDevelopmentSettings500",
        DevelopmentGetDevelopmentSettings500
      >
  >;
  readonly developmentUpdateDevelopmentSettings: (
    options: UpdateDevelopmentSettingsBody,
  ) => Effect.Effect<
    DevelopmentSettings,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "DevelopmentUpdateDevelopmentSettings401",
        DevelopmentUpdateDevelopmentSettings401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
        ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "DevelopmentUpdateDevelopmentSettings500",
        DevelopmentUpdateDevelopmentSettings500
      >
  >;
  readonly developmentGetDevelopmentState: (
    options: DevelopmentGetDevelopmentStateParams,
  ) => Effect.Effect<
    DevelopmentState,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "DevelopmentGetDevelopmentState401",
        DevelopmentGetDevelopmentState401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
        ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "DevelopmentGetDevelopmentState500",
        DevelopmentGetDevelopmentState500
      >
  >;
  readonly developmentApplyDevelopmentLifecycleAction: (
    options: DevelopmentLifecycleActionBody,
  ) => Effect.Effect<
    DevelopmentApplyDevelopmentLifecycleAction202,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "DevelopmentApplyDevelopmentLifecycleAction401",
        DevelopmentApplyDevelopmentLifecycleAction401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
        ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "DevelopmentApplyDevelopmentLifecycleAction500",
        DevelopmentApplyDevelopmentLifecycleAction500
      >
  >;
  readonly developmentResetDevelopmentData: (
    options?: DevelopmentResetDevelopmentDataParams | undefined,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "DevelopmentResetDevelopmentData401",
        DevelopmentResetDevelopmentData401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiDevelopmentEnvironmentRequiredErrorJsonEncoding",
        ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "DevelopmentResetDevelopmentData500",
        DevelopmentResetDevelopmentData500
      >
  >;
  readonly eventsListEvents: (
    options?: EventsListEventsParams | undefined,
  ) => Effect.Effect<
    EventsListEvents200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EventsListEvents401", EventsListEvents401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"EventsListEvents500", EventsListEvents500>
  >;
  readonly experimentsListExperiments: (
    options?: ExperimentsListExperimentsParams | undefined,
  ) => Effect.Effect<
    ExperimentsListExperiments200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsListExperiments401", ExperimentsListExperiments401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsListExperiments500", ExperimentsListExperiments500>
  >;
  readonly experimentsCreateExperiment: (
    options: CreateExperimentBodyJsonEncoding,
  ) => Effect.Effect<
    ExperimentJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsCreateExperiment401", ExperimentsCreateExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsCreateExperiment500", ExperimentsCreateExperiment500>
  >;
  readonly experimentsGetExperiment: (
    experimentId: string,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsGetExperiment401", ExperimentsGetExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsGetExperiment500", ExperimentsGetExperiment500>
  >;
  readonly experimentsArchiveExperiment: (
    experimentId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsArchiveExperiment401", ExperimentsArchiveExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsArchiveExperiment500", ExperimentsArchiveExperiment500>
  >;
  readonly experimentsUpdateExperiment: (
    experimentId: string,
    options: UpdateExperimentBodyJsonEncoding,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiExperimentValidationErrorJsonEncoding",
        ApiExperimentValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsUpdateExperiment401", ExperimentsUpdateExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsUpdateExperiment404", ExperimentsUpdateExperiment404>
    | VoidhashCoreClientError<
        "ApiExperimentConflictErrorJsonEncoding",
        ApiExperimentConflictErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsUpdateExperiment500", ExperimentsUpdateExperiment500>
  >;
  readonly experimentsRestoreExperiment: (
    experimentId: string,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsRestoreExperiment401", ExperimentsRestoreExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsRestoreExperiment500", ExperimentsRestoreExperiment500>
  >;
  readonly experimentsStartExperiment: (
    experimentId: string,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsStartExperiment401", ExperimentsStartExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentConflictErrorJsonEncoding",
        ApiExperimentConflictErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsStartExperiment500", ExperimentsStartExperiment500>
  >;
  readonly experimentsPauseExperiment: (
    experimentId: string,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsPauseExperiment401", ExperimentsPauseExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentConflictErrorJsonEncoding",
        ApiExperimentConflictErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsPauseExperiment500", ExperimentsPauseExperiment500>
  >;
  readonly experimentsConcludeExperiment: (
    experimentId: string,
    options: ConcludeExperimentBodyJsonEncoding,
  ) => Effect.Effect<
    ExperimentJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ExperimentsConcludeExperiment401", ExperimentsConcludeExperiment401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsConcludeExperiment404", ExperimentsConcludeExperiment404>
    | VoidhashCoreClientError<
        "ApiExperimentConflictErrorJsonEncoding",
        ApiExperimentConflictErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ExperimentsConcludeExperiment500", ExperimentsConcludeExperiment500>
  >;
  readonly experimentsGetExperimentResults: (
    experimentId: string,
    options?: ExperimentsGetExperimentResultsParams | undefined,
  ) => Effect.Effect<
    ExperimentResultsJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ExperimentsGetExperimentResults401",
        ExperimentsGetExperimentResults401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiExperimentNotFoundErrorJsonEncoding",
        ApiExperimentNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ExperimentsGetExperimentResults500",
        ExperimentsGetExperimentResults500
      >
  >;
  readonly featureFlagOverridesListFeatureFlagOverrides: (
    options?: FeatureFlagOverridesListFeatureFlagOverridesParams | undefined,
  ) => Effect.Effect<
    FeatureFlagOverridesListFeatureFlagOverrides200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagOverridesListFeatureFlagOverrides401",
        FeatureFlagOverridesListFeatureFlagOverrides401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagOverridesListFeatureFlagOverrides500",
        FeatureFlagOverridesListFeatureFlagOverrides500
      >
  >;
  readonly featureFlagOverridesUpsertFeatureFlagOverride: (
    options: UpsertFeatureFlagOverrideBodyJsonEncoding,
  ) => Effect.Effect<
    FeatureFlagOverrideJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagOverridesUpsertFeatureFlagOverride401",
        FeatureFlagOverridesUpsertFeatureFlagOverride401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagOverridesUpsertFeatureFlagOverride404",
        FeatureFlagOverridesUpsertFeatureFlagOverride404
      >
    | VoidhashCoreClientError<
        "FeatureFlagOverridesUpsertFeatureFlagOverride500",
        FeatureFlagOverridesUpsertFeatureFlagOverride500
      >
  >;
  readonly featureFlagOverridesArchiveFeatureFlagOverride: (
    overrideId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagOverridesArchiveFeatureFlagOverride401",
        FeatureFlagOverridesArchiveFeatureFlagOverride401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagOverrideNotFoundErrorJsonEncoding",
        ApiFeatureFlagOverrideNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagOverridesArchiveFeatureFlagOverride500",
        FeatureFlagOverridesArchiveFeatureFlagOverride500
      >
  >;
  readonly featureFlagTargetsListFeatureFlagTargets: (
    options: FeatureFlagTargetsListFeatureFlagTargetsParams,
  ) => Effect.Effect<
    FeatureFlagTargetsListFeatureFlagTargets200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagTargetsListFeatureFlagTargets401",
        FeatureFlagTargetsListFeatureFlagTargets401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagTargetsListFeatureFlagTargets500",
        FeatureFlagTargetsListFeatureFlagTargets500
      >
  >;
  readonly featureFlagTargetsUpsertFeatureFlagTarget: (
    options: UpsertFeatureFlagTargetBodyJsonEncoding,
  ) => Effect.Effect<
    FeatureFlagTargetJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagTargetsUpsertFeatureFlagTarget401",
        FeatureFlagTargetsUpsertFeatureFlagTarget401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagTargetsUpsertFeatureFlagTarget404",
        FeatureFlagTargetsUpsertFeatureFlagTarget404
      >
    | VoidhashCoreClientError<
        "FeatureFlagTargetsUpsertFeatureFlagTarget500",
        FeatureFlagTargetsUpsertFeatureFlagTarget500
      >
  >;
  readonly featureFlagTargetsArchiveFeatureFlagTarget: (
    targetId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagTargetsArchiveFeatureFlagTarget401",
        FeatureFlagTargetsArchiveFeatureFlagTarget401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagTargetNotFoundErrorJsonEncoding",
        ApiFeatureFlagTargetNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagTargetsArchiveFeatureFlagTarget500",
        FeatureFlagTargetsArchiveFeatureFlagTarget500
      >
  >;
  readonly featureFlagsListFeatureFlags: (
    options?: FeatureFlagsListFeatureFlagsParams | undefined,
  ) => Effect.Effect<
    FeatureFlagsListFeatureFlags200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"FeatureFlagsListFeatureFlags401", FeatureFlagsListFeatureFlags401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"FeatureFlagsListFeatureFlags500", FeatureFlagsListFeatureFlags500>
  >;
  readonly featureFlagsCreateFeatureFlag: (
    options: CreateFeatureFlagBodyJsonEncoding,
  ) => Effect.Effect<
    FeatureFlagJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"FeatureFlagsCreateFeatureFlag401", FeatureFlagsCreateFeatureFlag401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding",
        ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"FeatureFlagsCreateFeatureFlag500", FeatureFlagsCreateFeatureFlag500>
  >;
  readonly featureFlagsGetFeatureFlag: (
    featureFlagId: string,
  ) => Effect.Effect<
    FeatureFlagJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"FeatureFlagsGetFeatureFlag401", FeatureFlagsGetFeatureFlag401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"FeatureFlagsGetFeatureFlag500", FeatureFlagsGetFeatureFlag500>
  >;
  readonly featureFlagsArchiveFeatureFlag: (
    featureFlagId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagsArchiveFeatureFlag401",
        FeatureFlagsArchiveFeatureFlag401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagsArchiveFeatureFlag500",
        FeatureFlagsArchiveFeatureFlag500
      >
  >;
  readonly featureFlagsUpdateFeatureFlag: (
    featureFlagId: string,
    options: UpdateFeatureFlagBodyJsonEncoding,
  ) => Effect.Effect<
    FeatureFlagJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"FeatureFlagsUpdateFeatureFlag401", FeatureFlagsUpdateFeatureFlag401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding",
        ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"FeatureFlagsUpdateFeatureFlag500", FeatureFlagsUpdateFeatureFlag500>
  >;
  readonly featureFlagsRestoreFeatureFlag: (
    featureFlagId: string,
  ) => Effect.Effect<
    FeatureFlagJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagsRestoreFeatureFlag401",
        FeatureFlagsRestoreFeatureFlag401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagsRestoreFeatureFlag500",
        FeatureFlagsRestoreFeatureFlag500
      >
  >;
  readonly featureFlagsReplaceFeatureFlagVariants: (
    featureFlagId: string,
    options: ReplaceFeatureFlagVariantsBodyJsonEncoding,
  ) => Effect.Effect<
    FeatureFlagJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagsReplaceFeatureFlagVariants401",
        FeatureFlagsReplaceFeatureFlagVariants401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiFeatureFlagNotFoundErrorJsonEncoding",
        ApiFeatureFlagNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagsReplaceFeatureFlagVariants500",
        FeatureFlagsReplaceFeatureFlagVariants500
      >
  >;
  readonly featureFlagsEvaluateProjectFeatureFlags: (
    options: EvaluateProjectFeatureFlagsBodyJsonEncoding,
  ) => Effect.Effect<
    SdkFeatureFlagsResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "FeatureFlagsEvaluateProjectFeatureFlags401",
        FeatureFlagsEvaluateProjectFeatureFlags401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "FeatureFlagsEvaluateProjectFeatureFlags500",
        FeatureFlagsEvaluateProjectFeatureFlags500
      >
  >;
  readonly ingestPolicyGetIngestPolicy: (
    options?: IngestPolicyGetIngestPolicyParams | undefined,
  ) => Effect.Effect<
    EventAdmissionPolicyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiEventAdmissionErrorJsonEncoding",
        ApiEventAdmissionErrorJsonEncoding
      >
    | VoidhashCoreClientError<"IngestPolicyGetIngestPolicy401", IngestPolicyGetIngestPolicy401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly ingestPolicySetBuiltinEventAdmission: (
    key: string,
    options: SetBuiltinEventAdmissionBodyJsonEncoding,
  ) => Effect.Effect<
    EventAdmissionPolicyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiEventAdmissionErrorJsonEncoding",
        ApiEventAdmissionErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "IngestPolicySetBuiltinEventAdmission401",
        IngestPolicySetBuiltinEventAdmission401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly ingestPolicySetCustomEventBlocked: (
    eventName: string,
    options: SetCustomEventBlockedBodyJsonEncoding,
  ) => Effect.Effect<
    EventAdmissionPolicyJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiEventAdmissionErrorJsonEncoding",
        ApiEventAdmissionErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "IngestPolicySetCustomEventBlocked401",
        IngestPolicySetCustomEventBlocked401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly notificationSendsListNotificationSends: (
    options?: NotificationSendsListNotificationSendsParams | undefined,
  ) => Effect.Effect<
    NotificationSendsListNotificationSends200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "NotificationSendsListNotificationSends401",
        NotificationSendsListNotificationSends401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "NotificationSendsListNotificationSends500",
        NotificationSendsListNotificationSends500
      >
  >;
  readonly notificationSendsListNotificationSendDeliveries: (
    sendId: string,
    options?: NotificationSendsListNotificationSendDeliveriesParams | undefined,
  ) => Effect.Effect<
    NotificationSendsListNotificationSendDeliveries200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "NotificationSendsListNotificationSendDeliveries401",
        NotificationSendsListNotificationSendDeliveries401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationSendNotFoundErrorJsonEncoding",
        ApiPushNotificationSendNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "NotificationSendsListNotificationSendDeliveries500",
        NotificationSendsListNotificationSendDeliveries500
      >
  >;
  readonly notificationsCreateNotification: (options: {
    readonly params?: NotificationsCreateNotificationParams | undefined;
    readonly payload: SendNotificationBodyJsonEncoding;
  }) => Effect.Effect<
    SendNotificationResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPushDeviceValidationErrorJsonEncoding",
        ApiPushDeviceValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "NotificationsCreateNotification401",
        NotificationsCreateNotification401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushSendNotEnabledErrorJsonEncoding",
        ApiPushSendNotEnabledErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "NotificationsCreateNotification500",
        NotificationsCreateNotification500
      >
  >;
  readonly organizationsListOrganizations: (
    options?: OrganizationsListOrganizationsParams | undefined,
  ) => Effect.Effect<
    OrganizationsListOrganizations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "OrganizationsListOrganizations401",
        OrganizationsListOrganizations401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly organizationsCreateOrganization: (
    options: CreateOrganizationBodyJsonEncoding,
  ) => Effect.Effect<
    OrganizationJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "OrganizationsCreateOrganization401",
        OrganizationsCreateOrganization401
      >
    | VoidhashCoreClientError<
        "OrganizationsCreateOrganization500",
        OrganizationsCreateOrganization500
      >
  >;
  readonly organizationsGetOrganization: (
    organizationId: string,
  ) => Effect.Effect<
    OrganizationJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"OrganizationsGetOrganization401", OrganizationsGetOrganization401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiOrganizationNotFoundErrorJsonEncoding",
        ApiOrganizationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"OrganizationsGetOrganization500", OrganizationsGetOrganization500>
  >;
  readonly organizationsUpdateOrganization: (
    organizationId: string,
    options: UpdateOrganizationBodyJsonEncoding,
  ) => Effect.Effect<
    OrganizationJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "OrganizationsUpdateOrganization401",
        OrganizationsUpdateOrganization401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiOrganizationNotFoundErrorJsonEncoding",
        ApiOrganizationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "OrganizationsUpdateOrganization500",
        OrganizationsUpdateOrganization500
      >
  >;
  readonly organizationsListOrganizationProjects: (
    organizationId: string,
    options?: OrganizationsListOrganizationProjectsParams | undefined,
  ) => Effect.Effect<
    OrganizationsListOrganizationProjects200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "OrganizationsListOrganizationProjects401",
        OrganizationsListOrganizationProjects401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "OrganizationsListOrganizationProjects500",
        OrganizationsListOrganizationProjects500
      >
  >;
  readonly paymentProviderConfigurationsListPaymentProviderConfigurations: (
    options?: PaymentProviderConfigurationsListPaymentProviderConfigurationsParams | undefined,
  ) => Effect.Effect<
    PaymentProviderConfigurationsListPaymentProviderConfigurations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsListPaymentProviderConfigurations401",
        PaymentProviderConfigurationsListPaymentProviderConfigurations401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsListPaymentProviderConfigurations500",
        PaymentProviderConfigurationsListPaymentProviderConfigurations500
      >
  >;
  readonly paymentProviderConfigurationsCreatePaymentProviderConfiguration: (
    options: CreatePaymentProviderConfigurationBody,
  ) => Effect.Effect<
    PaymentProviderConfigurationsCreatePaymentProviderConfiguration201,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationValidationErrorJsonEncoding",
        ApiPaymentProviderConfigurationValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsCreatePaymentProviderConfiguration401",
        PaymentProviderConfigurationsCreatePaymentProviderConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
        ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderAlreadyExistsErrorJsonEncoding",
        ApiPaymentProviderAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsCreatePaymentProviderConfiguration500",
        PaymentProviderConfigurationsCreatePaymentProviderConfiguration500
      >
  >;
  readonly paymentProviderConfigurationsGetPaymentProviderConfiguration: (
    configurationId: string,
  ) => Effect.Effect<
    Objects,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsGetPaymentProviderConfiguration401",
        PaymentProviderConfigurationsGetPaymentProviderConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
        ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsGetPaymentProviderConfiguration500",
        PaymentProviderConfigurationsGetPaymentProviderConfiguration500
      >
  >;
  readonly paymentProviderConfigurationsDeletePaymentProviderConfiguration: (
    configurationId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsDeletePaymentProviderConfiguration401",
        PaymentProviderConfigurationsDeletePaymentProviderConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
        ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationInUseErrorJsonEncoding",
        ApiPaymentProviderConfigurationInUseErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsDeletePaymentProviderConfiguration500",
        PaymentProviderConfigurationsDeletePaymentProviderConfiguration500
      >
  >;
  readonly paymentProviderConfigurationsUpdatePaymentProviderConfiguration: (
    configurationId: string,
    options: UpdatePaymentProviderConfigurationBody,
  ) => Effect.Effect<
    Objects,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration400",
        PaymentProviderConfigurationsUpdatePaymentProviderConfiguration400
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration401",
        PaymentProviderConfigurationsUpdatePaymentProviderConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding",
        ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsUpdatePaymentProviderConfiguration500",
        PaymentProviderConfigurationsUpdatePaymentProviderConfiguration500
      >
  >;
  readonly paymentProviderProductsListPaymentProviderProducts: (
    options?: PaymentProviderProductsListPaymentProviderProductsParams | undefined,
  ) => Effect.Effect<
    PaymentProviderProductsListPaymentProviderProducts200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaymentProviderProductsListPaymentProviderProducts401",
        PaymentProviderProductsListPaymentProviderProducts401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsListPaymentProviderProducts500",
        PaymentProviderProductsListPaymentProviderProducts500
      >
  >;
  readonly paymentProviderProductsCreatePaymentProviderProduct: (
    options: CreatePaymentProviderProductBody,
  ) => Effect.Effect<
    PaymentProviderProductsCreatePaymentProviderProduct201,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductValidationErrorJsonEncoding",
        ApiPaymentProviderProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsCreatePaymentProviderProduct401",
        PaymentProviderProductsCreatePaymentProviderProduct401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
        ApiPaymentProviderProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsCreatePaymentProviderProduct500",
        PaymentProviderProductsCreatePaymentProviderProduct500
      >
  >;
  readonly paymentProviderProductsGetPaymentProviderProduct: (
    mappingId: string,
  ) => Effect.Effect<
    Objects3,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductValidationErrorJsonEncoding",
        ApiPaymentProviderProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsGetPaymentProviderProduct401",
        PaymentProviderProductsGetPaymentProviderProduct401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
        ApiPaymentProviderProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsGetPaymentProviderProduct500",
        PaymentProviderProductsGetPaymentProviderProduct500
      >
  >;
  readonly paymentProviderProductsDeletePaymentProviderProduct: (
    mappingId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductValidationErrorJsonEncoding",
        ApiPaymentProviderProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsDeletePaymentProviderProduct401",
        PaymentProviderProductsDeletePaymentProviderProduct401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsDeletePaymentProviderProduct500",
        PaymentProviderProductsDeletePaymentProviderProduct500
      >
  >;
  readonly paymentProviderProductsUpdatePaymentProviderProduct: (
    mappingId: string,
    options: UpdatePaymentProviderProductBody,
  ) => Effect.Effect<
    Objects3,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductValidationErrorJsonEncoding",
        ApiPaymentProviderProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsUpdatePaymentProviderProduct401",
        PaymentProviderProductsUpdatePaymentProviderProduct401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
        ApiPaymentProviderProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsUpdatePaymentProviderProduct500",
        PaymentProviderProductsUpdatePaymentProviderProduct500
      >
  >;
  readonly paymentProviderProductsActivatePaymentProviderProduct: (
    mappingId: string,
  ) => Effect.Effect<
    Objects3,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductValidationErrorJsonEncoding",
        ApiPaymentProviderProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsActivatePaymentProviderProduct401",
        PaymentProviderProductsActivatePaymentProviderProduct401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaymentProviderProductNotFoundErrorJsonEncoding",
        ApiPaymentProviderProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaymentProviderProductsActivatePaymentProviderProduct500",
        PaymentProviderProductsActivatePaymentProviderProduct500
      >
  >;
  readonly paywallDeploysListDeploys: (
    options?: PaywallDeploysListDeploysParams | undefined,
  ) => Effect.Effect<
    PaywallDeploysListDeploys200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallDeploysListDeploys401", PaywallDeploysListDeploys401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysListDeploys500", PaywallDeploysListDeploys500>
  >;
  readonly paywallDeploysCreateDeploy: (
    options: PaywallDeploysCreateDeployRequest,
  ) => Effect.Effect<
    CreatePaywallDeployResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaywallDeployUpgradeRequiredErrorJsonEncoding",
        ApiPaywallDeployUpgradeRequiredErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysCreateDeploy401", PaywallDeploysCreateDeploy401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallDeployValidationErrorJsonEncoding",
        ApiPaywallDeployValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysCreateDeploy500", PaywallDeploysCreateDeploy500>
  >;
  readonly paywallDeploysGetDeploy: (
    deployId: string,
    options?: PaywallDeploysGetDeployParams | undefined,
  ) => Effect.Effect<
    PaywallDeployJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallDeploysGetDeploy401", PaywallDeploysGetDeploy401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallDeployNotFoundErrorJsonEncoding",
        ApiPaywallDeployNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysGetDeploy500", PaywallDeploysGetDeploy500>
  >;
  readonly paywallDeploysUploadBlob: (
    deployId: string,
    sha256: string,
  ) => Effect.Effect<
    UploadPaywallDeployBlobResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallDeploysUploadBlob401", PaywallDeploysUploadBlob401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysUploadBlob404", PaywallDeploysUploadBlob404>
    | VoidhashCoreClientError<
        "ApiPaywallDeployNotPendingErrorJsonEncoding",
        ApiPaywallDeployNotPendingErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysUploadBlob422", PaywallDeploysUploadBlob422>
    | VoidhashCoreClientError<"PaywallDeploysUploadBlob500", PaywallDeploysUploadBlob500>
  >;
  readonly paywallDeploysFinalizeDeploy: (
    deployId: string,
  ) => Effect.Effect<
    FinalizePaywallDeployResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallDeploysFinalizeDeploy401", PaywallDeploysFinalizeDeploy401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallDeployNotFoundErrorJsonEncoding",
        ApiPaywallDeployNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiIncompleteDeployErrorJsonEncoding",
        ApiIncompleteDeployErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallDeployValidationErrorJsonEncoding",
        ApiPaywallDeployValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallDeploysFinalizeDeploy500", PaywallDeploysFinalizeDeploy500>
  >;
  readonly paywallLocationsListPaywallLocations: (
    options?: PaywallLocationsListPaywallLocationsParams | undefined,
  ) => Effect.Effect<
    PaywallLocationsListPaywallLocations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsListPaywallLocations401",
        PaywallLocationsListPaywallLocations401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsListPaywallLocations500",
        PaywallLocationsListPaywallLocations500
      >
  >;
  readonly paywallLocationsCreatePaywallLocation: (
    options: CreatePaywallLocationBodyJsonEncoding,
  ) => Effect.Effect<
    PaywallLocationJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsCreatePaywallLocation401",
        PaywallLocationsCreatePaywallLocation401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding",
        ApiPaywallLocationSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsCreatePaywallLocation500",
        PaywallLocationsCreatePaywallLocation500
      >
  >;
  readonly paywallLocationsGetPaywallLocation: (
    locationId: string,
    options?: PaywallLocationsGetPaywallLocationParams | undefined,
  ) => Effect.Effect<
    PaywallLocationJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsGetPaywallLocation401",
        PaywallLocationsGetPaywallLocation401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationNotFoundErrorJsonEncoding",
        ApiPaywallLocationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsGetPaywallLocation500",
        PaywallLocationsGetPaywallLocation500
      >
  >;
  readonly paywallLocationsArchivePaywallLocation: (
    locationId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsArchivePaywallLocation401",
        PaywallLocationsArchivePaywallLocation401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationNotFoundErrorJsonEncoding",
        ApiPaywallLocationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsArchivePaywallLocation500",
        PaywallLocationsArchivePaywallLocation500
      >
  >;
  readonly paywallLocationsUpdatePaywallLocation: (
    locationId: string,
    options: UpdatePaywallLocationBodyJsonEncoding,
  ) => Effect.Effect<
    PaywallLocationJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsUpdatePaywallLocation401",
        PaywallLocationsUpdatePaywallLocation401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationNotFoundErrorJsonEncoding",
        ApiPaywallLocationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsUpdatePaywallLocation500",
        PaywallLocationsUpdatePaywallLocation500
      >
  >;
  readonly paywallLocationsSetPaywallLocationShowing: (
    locationId: string,
    options: SetPaywallLocationShowingBodyJsonEncoding,
  ) => Effect.Effect<
    PaywallLocationShowingJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPaywallLocationShowingValidationErrorJsonEncoding",
        ApiPaywallLocationShowingValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsSetPaywallLocationShowing401",
        PaywallLocationsSetPaywallLocationShowing401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsSetPaywallLocationShowing404",
        PaywallLocationsSetPaywallLocationShowing404
      >
    | VoidhashCoreClientError<
        "PaywallLocationsSetPaywallLocationShowing500",
        PaywallLocationsSetPaywallLocationShowing500
      >
  >;
  readonly paywallLocationsClearPaywallLocationShowing: (
    locationId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsClearPaywallLocationShowing401",
        PaywallLocationsClearPaywallLocationShowing401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationNotFoundErrorJsonEncoding",
        ApiPaywallLocationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsClearPaywallLocationShowing500",
        PaywallLocationsClearPaywallLocationShowing500
      >
  >;
  readonly paywallLocationsListPaywallLocationShowings: (
    locationId: string,
    options?: PaywallLocationsListPaywallLocationShowingsParams | undefined,
  ) => Effect.Effect<
    PaywallLocationsListPaywallLocationShowings200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallLocationsListPaywallLocationShowings401",
        PaywallLocationsListPaywallLocationShowings401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallLocationNotFoundErrorJsonEncoding",
        ApiPaywallLocationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallLocationsListPaywallLocationShowings500",
        PaywallLocationsListPaywallLocationShowings500
      >
  >;
  readonly paywallsListPaywalls: (
    options?: PaywallsListPaywallsParams | undefined,
  ) => Effect.Effect<
    PaywallsListPaywalls200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsListPaywalls401", PaywallsListPaywalls401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsListPaywalls500", PaywallsListPaywalls500>
  >;
  readonly paywallsCreatePaywall: (
    options: CreatePaywallBodyJsonEncoding,
  ) => Effect.Effect<
    PaywallJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsCreatePaywall401", PaywallsCreatePaywall401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallSlugAlreadyExistsErrorJsonEncoding",
        ApiPaywallSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsCreatePaywall500", PaywallsCreatePaywall500>
  >;
  readonly paywallsGetPaywall: (
    paywallId: string,
  ) => Effect.Effect<
    PaywallJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsGetPaywall401", PaywallsGetPaywall401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsGetPaywall500", PaywallsGetPaywall500>
  >;
  readonly paywallsArchivePaywall: (
    paywallId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsArchivePaywall401", PaywallsArchivePaywall401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsArchivePaywall500", PaywallsArchivePaywall500>
  >;
  readonly paywallsUpdatePaywall: (
    paywallId: string,
    options: UpdatePaywallBodyJsonEncoding,
  ) => Effect.Effect<
    PaywallJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsUpdatePaywall401", PaywallsUpdatePaywall401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsUpdatePaywall500", PaywallsUpdatePaywall500>
  >;
  readonly paywallsRestorePaywall: (
    paywallId: string,
  ) => Effect.Effect<
    PaywallJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsRestorePaywall401", PaywallsRestorePaywall401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsRestorePaywall500", PaywallsRestorePaywall500>
  >;
  readonly paywallsListPaywallReleases: (
    paywallId: string,
    options?: PaywallsListPaywallReleasesParams | undefined,
  ) => Effect.Effect<
    PaywallsListPaywallReleases200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsListPaywallReleases401", PaywallsListPaywallReleases401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsListPaywallReleases500", PaywallsListPaywallReleases500>
  >;
  readonly paywallsCreatePaywallRelease: (
    paywallId: string,
  ) => Effect.Effect<
    PaywallReleaseJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsCreatePaywallRelease401", PaywallsCreatePaywallRelease401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallNotFoundErrorJsonEncoding",
        ApiPaywallNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsCreatePaywallRelease500", PaywallsCreatePaywallRelease500>
  >;
  readonly paywallsPublishPaywallRelease: (
    paywallId: string,
    releaseId: string,
  ) => Effect.Effect<
    PaywallReleaseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PaywallsPublishPaywallRelease401", PaywallsPublishPaywallRelease401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PaywallsPublishPaywallRelease404", PaywallsPublishPaywallRelease404>
    | VoidhashCoreClientError<"PaywallsPublishPaywallRelease500", PaywallsPublishPaywallRelease500>
  >;
  readonly paywallsActivatePaywallRelease: (
    paywallId: string,
    releaseId: string,
  ) => Effect.Effect<
    ActivatedPaywallReleaseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PaywallsActivatePaywallRelease401",
        PaywallsActivatePaywallRelease401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallReleaseNotFoundErrorJsonEncoding",
        ApiPaywallReleaseNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPaywallDeployValidationErrorJsonEncoding",
        ApiPaywallDeployValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PaywallsActivatePaywallRelease500",
        PaywallsActivatePaywallRelease500
      >
  >;
  readonly perksListPerks: (
    options?: PerksListPerksParams | undefined,
  ) => Effect.Effect<
    PerksListPerks200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PerksListPerks401", PerksListPerks401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PerksListPerks500", PerksListPerks500>
  >;
  readonly perksCreatePerk: (
    options: CreatePerkBodyJsonEncoding,
  ) => Effect.Effect<
    PerkJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PerksCreatePerk401", PerksCreatePerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPerkSlugAlreadyExistsErrorJsonEncoding",
        ApiPerkSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PerksCreatePerk500", PerksCreatePerk500>
  >;
  readonly perksGetPerk: (
    perkId: string,
  ) => Effect.Effect<
    PerkJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PerksGetPerk401", PerksGetPerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiPerkNotFoundErrorJsonEncoding", ApiPerkNotFoundErrorJsonEncoding>
    | VoidhashCoreClientError<"PerksGetPerk500", PerksGetPerk500>
  >;
  readonly perksDeletePerk: (
    perkId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PerksDeletePerk401", PerksDeletePerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiPerkNotFoundErrorJsonEncoding", ApiPerkNotFoundErrorJsonEncoding>
    | VoidhashCoreClientError<"PerksDeletePerk500", PerksDeletePerk500>
  >;
  readonly perksUpdatePerk: (
    perkId: string,
    options: UpdatePerkBodyJsonEncoding,
  ) => Effect.Effect<
    PerkJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PerksUpdatePerk401", PerksUpdatePerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ApiPerkNotFoundErrorJsonEncoding", ApiPerkNotFoundErrorJsonEncoding>
    | VoidhashCoreClientError<
        "ApiPerkSlugAlreadyExistsErrorJsonEncoding",
        ApiPerkSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PerksUpdatePerk500", PerksUpdatePerk500>
  >;
  readonly personsListPersons: (
    options?: PersonsListPersonsParams | undefined,
  ) => Effect.Effect<
    PersonsListPersons200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsListPersons401", PersonsListPersons401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PersonsListPersons500", PersonsListPersons500>
  >;
  readonly personsCreatePerson: (
    options: CreatePersonRequestBodyJsonEncoding,
  ) => Effect.Effect<
    PersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsCreatePerson401", PersonsCreatePerson401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PersonsCreatePerson500", PersonsCreatePerson500>
  >;
  readonly personsGetPersonById: (
    personId: string,
  ) => Effect.Effect<
    PersonJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsGetPersonById401", PersonsGetPersonById401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPersonNotFoundErrorJsonEncoding",
        ApiPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PersonsGetPersonById500", PersonsGetPersonById500>
  >;
  readonly personsUpdatePerson: (
    personId: string,
    options: UpdatePersonBodyJsonEncoding,
  ) => Effect.Effect<
    PersonJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsUpdatePerson401", PersonsUpdatePerson401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPersonNotFoundErrorJsonEncoding",
        ApiPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PersonsUpdatePerson500", PersonsUpdatePerson500>
  >;
  readonly personsGetPersonEntitlements: (
    personId: string,
  ) => Effect.Effect<
    PersonEntitlementsResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsGetPersonEntitlements401", PersonsGetPersonEntitlements401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPersonNotFoundErrorJsonEncoding",
        ApiPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"PersonsGetPersonEntitlements500", PersonsGetPersonEntitlements500>
  >;
  readonly productsListProducts: (
    options?: ProductsListProductsParams | undefined,
  ) => Effect.Effect<
    ProductsListProducts200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProductsListProducts401", ProductsListProducts401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsListProducts500", ProductsListProducts500>
  >;
  readonly productsCreateProduct: (
    options: CreateProductBodyJsonEncoding,
  ) => Effect.Effect<
    ProductJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiProductValidationErrorJsonEncoding",
        ApiProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsCreateProduct401", ProductsCreateProduct401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductSlugAlreadyExistsErrorJsonEncoding",
        ApiProductSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsCreateProduct500", ProductsCreateProduct500>
  >;
  readonly productsGetProduct: (
    productId: string,
  ) => Effect.Effect<
    ProductJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProductsGetProduct401", ProductsGetProduct401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductNotFoundErrorJsonEncoding",
        ApiProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsGetProduct500", ProductsGetProduct500>
  >;
  readonly productsDeleteProduct: (
    productId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiProductValidationErrorJsonEncoding",
        ApiProductValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsDeleteProduct401", ProductsDeleteProduct401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductNotFoundErrorJsonEncoding",
        ApiProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsDeleteProduct500", ProductsDeleteProduct500>
  >;
  readonly productsUpdateProduct: (
    productId: string,
    options: UpdateProductBodyJsonEncoding,
  ) => Effect.Effect<
    ProductJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProductsUpdateProduct401", ProductsUpdateProduct401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductNotFoundErrorJsonEncoding",
        ApiProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductSlugAlreadyExistsErrorJsonEncoding",
        ApiProductSlugAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsUpdateProduct500", ProductsUpdateProduct500>
  >;
  readonly productsListProductPerks: (
    productId: string,
    options?: ProductsListProductPerksParams | undefined,
  ) => Effect.Effect<
    ProductsListProductPerks200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiProductPerkValidationErrorJsonEncoding",
        ApiProductPerkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsListProductPerks401", ProductsListProductPerks401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductNotFoundErrorJsonEncoding",
        ApiProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsListProductPerks500", ProductsListProductPerks500>
  >;
  readonly productsAttachProductPerk: (
    productId: string,
    options: AttachProductPerkBodyJsonEncoding,
  ) => Effect.Effect<
    ProductPerkJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiProductPerkValidationErrorJsonEncoding",
        ApiProductPerkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsAttachProductPerk401", ProductsAttachProductPerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductNotFoundErrorJsonEncoding",
        ApiProductNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProductPerkAlreadyExistsErrorJsonEncoding",
        ApiProductPerkAlreadyExistsErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsAttachProductPerk500", ProductsAttachProductPerk500>
  >;
  readonly productsDetachProductPerk: (
    productId: string,
    perkId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiProductPerkValidationErrorJsonEncoding",
        ApiProductPerkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsDetachProductPerk401", ProductsDetachProductPerk401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProductsDetachProductPerk404", ProductsDetachProductPerk404>
    | VoidhashCoreClientError<"ProductsDetachProductPerk500", ProductsDetachProductPerk500>
  >;
  readonly projectsCreateProject: (
    options: CreateProjectBodyJsonEncoding,
  ) => Effect.Effect<
    ProjectJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProjectsCreateProject401", ProjectsCreateProject401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProjectsCreateProject500", ProjectsCreateProject500>
  >;
  readonly projectsGetProjectById: (
    projectId: string,
  ) => Effect.Effect<
    ProjectJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProjectsGetProjectById401", ProjectsGetProjectById401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProjectNotFoundErrorJsonEncoding",
        ApiProjectNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProjectsGetProjectById500", ProjectsGetProjectById500>
  >;
  readonly projectsDeleteProject: (
    projectId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProjectsDeleteProject401", ProjectsDeleteProject401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProjectNotFoundErrorJsonEncoding",
        ApiProjectNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProjectsDeleteProject500", ProjectsDeleteProject500>
  >;
  readonly projectsUpdateProject: (
    projectId: string,
    options: UpdateProjectBodyJsonEncoding,
  ) => Effect.Effect<
    ProjectJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"ProjectsUpdateProject401", ProjectsUpdateProject401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiProjectNotFoundErrorJsonEncoding",
        ApiProjectNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"ProjectsUpdateProject500", ProjectsUpdateProject500>
  >;
  readonly pushNotificationConfigurationsListPushNotificationConfigurations: (
    options?: PushNotificationConfigurationsListPushNotificationConfigurationsParams | undefined,
  ) => Effect.Effect<
    PushNotificationConfigurationsListPushNotificationConfigurations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsListPushNotificationConfigurations401",
        PushNotificationConfigurationsListPushNotificationConfigurations401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsListPushNotificationConfigurations500",
        PushNotificationConfigurationsListPushNotificationConfigurations500
      >
  >;
  readonly pushNotificationConfigurationsCreatePushNotificationConfiguration: (
    options: CreatePushNotificationConfigurationBody,
  ) => Effect.Effect<
    PushNotificationConfigurationsCreatePushNotificationConfiguration201,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsCreatePushNotificationConfiguration401",
        PushNotificationConfigurationsCreatePushNotificationConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
        ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding",
        ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsCreatePushNotificationConfiguration500",
        PushNotificationConfigurationsCreatePushNotificationConfiguration500
      >
  >;
  readonly pushNotificationConfigurationsGetPushNotificationConfiguration: (
    configurationId: string,
  ) => Effect.Effect<
    Objects5,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsGetPushNotificationConfiguration401",
        PushNotificationConfigurationsGetPushNotificationConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
        ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsGetPushNotificationConfiguration500",
        PushNotificationConfigurationsGetPushNotificationConfiguration500
      >
  >;
  readonly pushNotificationConfigurationsDeletePushNotificationConfiguration: (
    configurationId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsDeletePushNotificationConfiguration401",
        PushNotificationConfigurationsDeletePushNotificationConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
        ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsDeletePushNotificationConfiguration500",
        PushNotificationConfigurationsDeletePushNotificationConfiguration500
      >
  >;
  readonly pushNotificationConfigurationsUpdatePushNotificationConfiguration: (
    configurationId: string,
    options: UpdatePushNotificationConfigurationBody,
  ) => Effect.Effect<
    Objects5,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationValidationErrorJsonEncoding",
        ApiPushNotificationConfigurationValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsUpdatePushNotificationConfiguration401",
        PushNotificationConfigurationsUpdatePushNotificationConfiguration401
      >
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationNotFoundErrorJsonEncoding",
        ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding",
        ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "PushNotificationConfigurationsUpdatePushNotificationConfiguration500",
        PushNotificationConfigurationsUpdatePushNotificationConfiguration500
      >
  >;
  readonly schemaGetSchema: (
    options?: SchemaGetSchemaParams | undefined,
  ) => Effect.Effect<
    ProjectSchemaResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SchemaGetSchema401", SchemaGetSchema401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SchemaGetSchema500", SchemaGetSchema500>
  >;
  readonly schemaGetSchemaVersion: (
    options?: SchemaGetSchemaVersionParams | undefined,
  ) => Effect.Effect<
    SchemaVersionJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SchemaGetSchemaVersion401", SchemaGetSchemaVersion401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SchemaGetSchemaVersion500", SchemaGetSchemaVersion500>
  >;
  readonly sdkGetPerson: (
    options: SdkGetPersonParams,
  ) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkGetPerson401", SdkGetPerson401>
    | VoidhashCoreClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkGetPerson500", SdkGetPerson500>
  >;
  readonly sdkIdentifyPerson: (options: {
    readonly params: SdkIdentifyPersonParams;
    readonly payload: SdkIdentifyBodyJsonEncoding;
  }) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkIdentifyPerson401", SdkIdentifyPerson401>
    | VoidhashCoreClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding",
        ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkIdentifyPerson500", SdkIdentifyPerson500>
  >;
  readonly sdkSyncPersonAttributes: (options: {
    readonly params: SdkSyncPersonAttributesParams;
    readonly payload: SdkSyncPersonAttributesBodyJsonEncoding;
  }) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkSyncPersonAttributes401", SdkSyncPersonAttributes401>
    | VoidhashCoreClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkSyncPersonAttributes500", SdkSyncPersonAttributes500>
  >;
  readonly sdkSyncTransaction: (options: {
    readonly params: SdkSyncTransactionParams;
    readonly payload: SdkSyncTransactionRequest;
  }) => Effect.Effect<
    SdkSyncTransactionResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkSyncTransaction401", SdkSyncTransaction401>
    | VoidhashCoreClientError<"SdkSyncTransaction500", SdkSyncTransaction500>
  >;
  readonly sdkDevelopmentPurchase: (options: {
    readonly params: SdkDevelopmentPurchaseParams;
    readonly payload: SdkDevelopmentPurchaseBodyJsonEncoding;
  }) => Effect.Effect<
    SdkDevelopmentPurchaseResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkDevelopmentPurchase401", SdkDevelopmentPurchase401>
    | VoidhashCoreClientError<"SdkDevelopmentPurchase500", SdkDevelopmentPurchase500>
  >;
  readonly sdkEvaluateFeatureFlags: (options: {
    readonly params: SdkEvaluateFeatureFlagsParams;
    readonly payload: EvaluateFeatureFlagsBodyJsonEncoding;
  }) => Effect.Effect<
    SdkFeatureFlagsResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkEvaluateFeatureFlags401", SdkEvaluateFeatureFlags401>
    | VoidhashCoreClientError<"SdkEvaluateFeatureFlags500", SdkEvaluateFeatureFlags500>
  >;
  readonly sdkResolvePaywall: (options: {
    readonly params: SdkResolvePaywallParams;
    readonly payload: SdkResolvePaywallBodyJsonEncoding;
  }) => Effect.Effect<
    SdkResolvePaywall200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiSdkValidationErrorJsonEncoding",
        ApiSdkValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkResolvePaywall401", SdkResolvePaywall401>
    | VoidhashCoreClientError<"SdkResolvePaywall500", SdkResolvePaywall500>
  >;
  readonly sdkGetSdkSchema: (
    options: SdkGetSdkSchemaParams,
  ) => Effect.Effect<
    SdkSchemaJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkGetSdkSchema401", SdkGetSdkSchema401>
    | VoidhashCoreClientError<"SdkGetSdkSchema500", SdkGetSdkSchema500>
  >;
  readonly sdkRegisterDevice: (options: {
    readonly params: SdkRegisterDeviceParams;
    readonly payload: RegisterDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    RegisterDeviceResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPushDeviceValidationErrorJsonEncoding",
        ApiPushDeviceValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkRegisterDevice401", SdkRegisterDevice401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkRegisterDevice500", SdkRegisterDevice500>
  >;
  readonly sdkRefreshDevice: (options: {
    readonly params: SdkRefreshDeviceParams;
    readonly payload: RefreshDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiPushDeviceValidationErrorJsonEncoding",
        ApiPushDeviceValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkRefreshDevice401", SdkRefreshDevice401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkRefreshDevice500", SdkRefreshDevice500>
  >;
  readonly sdkUnregisterDevice: (options: {
    readonly params: SdkUnregisterDeviceParams;
    readonly payload: UnregisterDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkUnregisterDevice401", SdkUnregisterDevice401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"SdkUnregisterDevice500", SdkUnregisterDevice500>
  >;
  readonly usersGetUser: () => Effect.Effect<
    UserJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"UsersGetUser401", UsersGetUser401>
    | VoidhashCoreClientError<"ApiAuthServiceErrorJsonEncoding", ApiAuthServiceErrorJsonEncoding>
  >;
  readonly webhooksListWebhookEndpoints: (
    options?: WebhooksListWebhookEndpointsParams | undefined,
  ) => Effect.Effect<
    WebhooksListWebhookEndpoints200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksListWebhookEndpoints401", WebhooksListWebhookEndpoints401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksListWebhookEndpoints500", WebhooksListWebhookEndpoints500>
  >;
  readonly webhooksCreateWebhookEndpoint: (
    options: CreateWebhookEndpointBodyJsonEncoding,
  ) => Effect.Effect<
    WebhookEndpointWithSecretJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiWebhookValidationErrorJsonEncoding",
        ApiWebhookValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint401", WebhooksCreateWebhookEndpoint401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint500", WebhooksCreateWebhookEndpoint500>
  >;
  readonly webhooksGetWebhookEndpoint: (
    endpointId: string,
    options?: WebhooksGetWebhookEndpointParams | undefined,
  ) => Effect.Effect<
    WebhookEndpointJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksGetWebhookEndpoint401", WebhooksGetWebhookEndpoint401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookEndpointNotFoundErrorJsonEncoding",
        ApiWebhookEndpointNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksGetWebhookEndpoint500", WebhooksGetWebhookEndpoint500>
  >;
  readonly webhooksDeleteWebhookEndpoint: (
    endpointId: string,
    options?: WebhooksDeleteWebhookEndpointParams | undefined,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksDeleteWebhookEndpoint401", WebhooksDeleteWebhookEndpoint401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookEndpointNotFoundErrorJsonEncoding",
        ApiWebhookEndpointNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksDeleteWebhookEndpoint500", WebhooksDeleteWebhookEndpoint500>
  >;
  readonly webhooksUpdateWebhookEndpoint: (
    endpointId: string,
    options: {
      readonly params?: WebhooksUpdateWebhookEndpointParams | undefined;
      readonly payload: UpdateWebhookEndpointBodyJsonEncoding;
    },
  ) => Effect.Effect<
    WebhookEndpointJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiWebhookValidationErrorJsonEncoding",
        ApiWebhookValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint401", WebhooksUpdateWebhookEndpoint401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookEndpointNotFoundErrorJsonEncoding",
        ApiWebhookEndpointNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint500", WebhooksUpdateWebhookEndpoint500>
  >;
  readonly webhooksRotateWebhookSecret: (
    endpointId: string,
    options?: WebhooksRotateWebhookSecretParams | undefined,
  ) => Effect.Effect<
    WebhookEndpointWithSecretJsonEncoding1,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksRotateWebhookSecret401", WebhooksRotateWebhookSecret401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookEndpointNotFoundErrorJsonEncoding",
        ApiWebhookEndpointNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksRotateWebhookSecret500", WebhooksRotateWebhookSecret500>
  >;
  readonly webhooksTestWebhookEndpoint: (
    endpointId: string,
    options?: WebhooksTestWebhookEndpointParams | undefined,
  ) => Effect.Effect<
    WebhookDeliveryJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksTestWebhookEndpoint401", WebhooksTestWebhookEndpoint401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookEndpointNotFoundErrorJsonEncoding",
        ApiWebhookEndpointNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksTestWebhookEndpoint500", WebhooksTestWebhookEndpoint500>
  >;
  readonly webhooksListWebhookDeliveries: (
    options?: WebhooksListWebhookDeliveriesParams | undefined,
  ) => Effect.Effect<
    WebhooksListWebhookDeliveries200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksListWebhookDeliveries401", WebhooksListWebhookDeliveries401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksListWebhookDeliveries500", WebhooksListWebhookDeliveries500>
  >;
  readonly webhooksGetWebhookDelivery: (
    deliveryId: string,
    options?: WebhooksGetWebhookDeliveryParams | undefined,
  ) => Effect.Effect<
    WebhookDeliveryWithAttemptsJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksGetWebhookDelivery401", WebhooksGetWebhookDelivery401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookDeliveryNotFoundErrorJsonEncoding",
        ApiWebhookDeliveryNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksGetWebhookDelivery500", WebhooksGetWebhookDelivery500>
  >;
  readonly webhooksRetryWebhookDelivery: (
    deliveryId: string,
    options?: WebhooksRetryWebhookDeliveryParams | undefined,
  ) => Effect.Effect<
    WebhookDeliveryJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ApiWebhookValidationErrorJsonEncoding",
        ApiWebhookValidationErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery401", WebhooksRetryWebhookDelivery401>
    | VoidhashCoreClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashCoreClientError<
        "ApiWebhookDeliveryNotFoundErrorJsonEncoding",
        ApiWebhookDeliveryNotFoundErrorJsonEncoding
      >
    | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery500", WebhooksRetryWebhookDelivery500>
  >;
}

export interface VoidhashCoreClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag;
  readonly request: HttpClientRequest.HttpClientRequest;
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly data: E;
  readonly message: string;
}

class VoidhashCoreClientErrorImpl extends Data.Error<{
  _tag: string;
  data: any;
  message: string;
  request: HttpClientRequest.HttpClientRequest;
  response: HttpClientResponse.HttpClientResponse;
}> {
  name = "VoidhashCoreClientError";
}

export const VoidhashCoreClientError = <Tag extends string, E>(
  tag: Tag,
  data: E,
  response: HttpClientResponse.HttpClientResponse,
): VoidhashCoreClientError<Tag, E> =>
  new VoidhashCoreClientErrorImpl({
    _tag: tag,
    data,
    message: JSON.stringify(data),
    response,
    request: response.request,
  }) as any;
