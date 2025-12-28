import { Schema } from 'effect';

// ============================================
// METRIC DEFINITIONS
// ============================================

export const MetricId = {
  PaywallConversions: 'paywall_conversions',
  MonthlyTrackedRevenue: 'monthly_tracked_revenue',
  ApiCalls: 'api_calls',
  ActiveCustomers: 'active_customers'
} as const;

export type MetricIdValue = (typeof MetricId)[keyof typeof MetricId];

export interface MetricDefinition {
  id: MetricIdValue;
  name: string;
  description: string;
  unit: string;
  aggregationType: 'sum' | 'max' | 'last';
}

export const METRIC_DEFINITIONS: Record<MetricIdValue, MetricDefinition> = {
  paywall_conversions: {
    id: 'paywall_conversions',
    name: 'Paywall Conversions',
    description: 'Number of successful paywall conversions',
    unit: 'conversions',
    aggregationType: 'sum'
  },
  monthly_tracked_revenue: {
    id: 'monthly_tracked_revenue',
    name: 'Monthly Tracked Revenue',
    description: 'Total revenue tracked through the platform',
    unit: 'cents',
    aggregationType: 'sum'
  },
  api_calls: {
    id: 'api_calls',
    name: 'API Calls',
    description: 'Number of API calls made',
    unit: 'calls',
    aggregationType: 'sum'
  },
  active_customers: {
    id: 'active_customers',
    name: 'Active Customers',
    description: 'Number of active customers in the period',
    unit: 'customers',
    aggregationType: 'max'
  }
};

// ============================================
// TIER DEFINITIONS
// ============================================

export const BillingTierName = {
  Free: 'free',
  Pro: 'pro',
  Enterprise: 'enterprise'
} as const;

export type BillingTierNameValue =
  (typeof BillingTierName)[keyof typeof BillingTierName];

export interface TierLimit {
  metricId: MetricIdValue;
  limit: number | null; // null = unlimited
  warnAt: number | null; // threshold to show warning
}

export interface TierDefinition {
  id: BillingTierNameValue;
  name: string;
  limits: TierLimit[];
}

// ============================================
// USAGE TYPES
// ============================================

export interface UsageRecordInput {
  organizationId: string;
  metricId: MetricIdValue;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  metricId: MetricIdValue;
  metricName: string;
  currentValue: number;
  limit: number | null;
  percentUsed: number | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean; // > 80%
}

// ============================================
// BILLING PROVIDER TYPES
// ============================================

export interface BillingProviderConfig {
  id: string;
  name: string;
}

export interface CustomerInfo {
  organizationId: string;
  externalCustomerId: string | null;
  tier: BillingTierNameValue;
  subscriptionStatus: 'none' | 'active' | 'canceled' | 'past_due' | 'trialing';
}

export interface CreateCheckoutInput {
  organizationId: string;
  externalCustomerId: string;
  tier: BillingTierNameValue;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export interface SubscriptionInfo {
  externalSubscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  tier: BillingTierNameValue;
}

// ============================================
// ORGANIZATION BILLING TYPES
// ============================================

export interface OrganizationBillingInfo {
  organizationId: string;
  tier: BillingTierNameValue;
  subscriptionStatus: 'none' | 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  usageSummaries: UsageSummary[];
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface SubscriptionChangeEvent {
  externalSubscriptionId: string;
  externalCustomerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  tier?: BillingTierNameValue;
}

// ============================================
// EFFECT SCHEMA TYPES (for RPC)
// ============================================

export const UsageSummarySchema = Schema.Struct({
  metricId: Schema.String,
  metricName: Schema.String,
  currentValue: Schema.Number,
  limit: Schema.NullOr(Schema.Number),
  percentUsed: Schema.NullOr(Schema.Number),
  isOverLimit: Schema.Boolean,
  isApproachingLimit: Schema.Boolean
});

export const OrganizationBillingInfoSchema = Schema.Struct({
  organizationId: Schema.String,
  tier: Schema.Literal('free', 'pro', 'enterprise'),
  subscriptionStatus: Schema.Literal(
    'none',
    'active',
    'canceled',
    'past_due',
    'trialing'
  ),
  currentPeriodStart: Schema.NullOr(Schema.Date),
  currentPeriodEnd: Schema.NullOr(Schema.Date),
  usageSummaries: Schema.Array(UsageSummarySchema)
});

export const CheckoutSessionResultSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String
});
