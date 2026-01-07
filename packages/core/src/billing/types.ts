import { Schema } from "effect";

// ============================================
// METRIC DEFINITIONS
// ============================================

export const MetricId = {
  ActiveCustomers: "active_customers",
  ApiCalls: "api_calls",
  MonthlyTrackedRevenue: "monthly_tracked_revenue",
  PaywallConversions: "paywall_conversions",
} as const;

export type MetricIdValue = (typeof MetricId)[keyof typeof MetricId];

export interface MetricDefinition {
  id: MetricIdValue;
  name: string;
  description: string;
  unit: string;
  aggregationType: "sum" | "max" | "last";
}

export const METRIC_DEFINITIONS: Record<MetricIdValue, MetricDefinition> = {
  active_customers: {
    aggregationType: "max",
    description: "Number of active customers in the period",
    id: "active_customers",
    name: "Active Customers",
    unit: "customers",
  },
  api_calls: {
    aggregationType: "sum",
    description: "Number of API calls made",
    id: "api_calls",
    name: "API Calls",
    unit: "calls",
  },
  monthly_tracked_revenue: {
    aggregationType: "sum",
    description: "Total revenue tracked through the platform",
    id: "monthly_tracked_revenue",
    name: "Monthly Tracked Revenue",
    unit: "cents",
  },
  paywall_conversions: {
    aggregationType: "sum",
    description: "Number of successful paywall conversions",
    id: "paywall_conversions",
    name: "Paywall Conversions",
    unit: "conversions",
  },
};

// ============================================
// TIER DEFINITIONS
// ============================================

export const BillingTierName = {
  Enterprise: "enterprise",
  Free: "free",
  Pro: "pro",
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
  subscriptionStatus: "none" | "active" | "canceled" | "past_due" | "trialing";
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
  status: "active" | "canceled" | "past_due" | "trialing";
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
  subscriptionStatus: "none" | "active" | "canceled" | "past_due" | "trialing";
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
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  tier?: BillingTierNameValue;
}

// ============================================
// EFFECT SCHEMA TYPES (for RPC)
// ============================================

export const UsageSummarySchema = Schema.Struct({
  currentValue: Schema.Number,
  isApproachingLimit: Schema.Boolean,
  isOverLimit: Schema.Boolean,
  limit: Schema.NullOr(Schema.Number),
  metricId: Schema.String,
  metricName: Schema.String,
  percentUsed: Schema.NullOr(Schema.Number),
});

export const OrganizationBillingInfoSchema = Schema.Struct({
  currentPeriodEnd: Schema.NullOr(Schema.Date),
  currentPeriodStart: Schema.NullOr(Schema.Date),
  organizationId: Schema.String,
  subscriptionStatus: Schema.Literal(
    "none",
    "active",
    "canceled",
    "past_due",
    "trialing"
  ),
  tier: Schema.Literal("free", "pro", "enterprise"),
  usageSummaries: Schema.Array(UsageSummarySchema),
});

export const CheckoutSessionResultSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
});
