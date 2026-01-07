import {
  BillingTierName,
  type BillingTierNameValue,
  MetricId,
  type TierDefinition,
} from "./types";

/**
 * Tier definitions with usage limits
 * Limits are per billing period (monthly)
 */
export const TIER_DEFINITIONS: Record<BillingTierNameValue, TierDefinition> = {
  enterprise: {
    id: BillingTierName.Enterprise,
    limits: [
      {
        limit: null,
        metricId: MetricId.PaywallConversions,
        warnAt: null,
      },
      {
        limit: null,
        metricId: MetricId.MonthlyTrackedRevenue,
        warnAt: null,
      },
      {
        limit: null,
        metricId: MetricId.ApiCalls,
        warnAt: null,
      },
      {
        limit: null,
        metricId: MetricId.ActiveCustomers,
        warnAt: null,
      },
    ],
    name: "Enterprise",
  },
  free: {
    id: BillingTierName.Free,
    limits: [
      {
        limit: 100,
        metricId: MetricId.PaywallConversions,
        warnAt: 80,
      },
      {
        metricId: MetricId.MonthlyTrackedRevenue,
        limit: 1_000_000, // $10,000 in cents
        warnAt: 800_000,
      },
      {
        limit: 10_000,
        metricId: MetricId.ApiCalls,
        warnAt: 8000,
      },
      {
        limit: 500,
        metricId: MetricId.ActiveCustomers,
        warnAt: 400,
      },
    ],
    name: "Free",
  },
  pro: {
    id: BillingTierName.Pro,
    limits: [
      {
        limit: 10_000,
        metricId: MetricId.PaywallConversions,
        warnAt: 8000,
      },
      {
        metricId: MetricId.MonthlyTrackedRevenue,
        limit: 100_000_000, // $1,000,000 in cents
        warnAt: 80_000_000,
      },
      {
        limit: 1_000_000,
        metricId: MetricId.ApiCalls,
        warnAt: 800_000,
      },
      {
        metricId: MetricId.ActiveCustomers,
        limit: null, // Unlimited
        warnAt: null,
      },
    ],
    name: "Pro",
  },
};

/**
 * Get the limit for a specific metric in a tier
 */
export function getTierLimitForMetric(
  tier: BillingTierNameValue,
  metricId: string
): { limit: number | null; warnAt: number | null } {
  const tierDef = TIER_DEFINITIONS[tier];
  const limitDef = tierDef.limits.find((l) => l.metricId === metricId);
  return limitDef ?? { limit: null, warnAt: null };
}

/**
 * Get all limits for a tier
 */
export function getTierLimits(tier: BillingTierNameValue) {
  return TIER_DEFINITIONS[tier].limits;
}
