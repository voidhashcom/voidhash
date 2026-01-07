import type { DatabaseError } from "@voidhash/db/effect";
import type { Effect } from "effect";

export interface AnalyticsDataPoint {
  timestamp: Date;
  value: number;
}

export type TimeGranularity =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export interface TimeRangeParams {
  startDate: Date;
  endDate: Date;
  granularity: TimeGranularity;
  projectId: string;
}

export interface AnalyticsFilters {
  productIds?: string[];
  subscriptionStatuses?: number[];
  providerEnvironment?: number;
}

export interface AnalyticsQueryInput {
  params: TimeRangeParams;
  filters?: AnalyticsFilters;
}

export interface AnalyticsDataAccessor {
  getRevenue: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getMRR: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getActiveSubscriptions: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getNewSubscriptions: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getChurnedSubscriptions: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getTrials: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getTrialConversions: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getCustomerCount: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getNewCustomers: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;

  getPayingCustomerCount: (
    input: AnalyticsQueryInput
  ) => Effect.Effect<AnalyticsDataPoint[], DatabaseError>;
}
