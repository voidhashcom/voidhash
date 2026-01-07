import {
  BillingTierName,
  MetricId,
  type BillingTierNameValue,
  type TierDefinition
} from './types';

/**
 * Tier definitions with usage limits
 * Limits are per billing period (monthly)
 */
export const TIER_DEFINITIONS: Record<BillingTierNameValue, TierDefinition> = {
  free: {
    id: BillingTierName.Free,
    name: 'Free',
    limits: [
      {
        metricId: MetricId.PaywallConversions,
        limit: 100,
        warnAt: 80
      },
      {
        metricId: MetricId.MonthlyTrackedRevenue,
        limit: 1000000, // $10,000 in cents
        warnAt: 800000
      },
      {
        metricId: MetricId.ApiCalls,
        limit: 10000,
        warnAt: 8000
      },
      {
        metricId: MetricId.ActiveCustomers,
        limit: 500,
        warnAt: 400
      }
    ]
  },
  pro: {
    id: BillingTierName.Pro,
    name: 'Pro',
    limits: [
      {
        metricId: MetricId.PaywallConversions,
        limit: 10000,
        warnAt: 8000
      },
      {
        metricId: MetricId.MonthlyTrackedRevenue,
        limit: 100000000, // $1,000,000 in cents
        warnAt: 80000000
      },
      {
        metricId: MetricId.ApiCalls,
        limit: 1000000,
        warnAt: 800000
      },
      {
        metricId: MetricId.ActiveCustomers,
        limit: null, // Unlimited
        warnAt: null
      }
    ]
  },
  enterprise: {
    id: BillingTierName.Enterprise,
    name: 'Enterprise',
    limits: [
      {
        metricId: MetricId.PaywallConversions,
        limit: null,
        warnAt: null
      },
      {
        metricId: MetricId.MonthlyTrackedRevenue,
        limit: null,
        warnAt: null
      },
      {
        metricId: MetricId.ApiCalls,
        limit: null,
        warnAt: null
      },
      {
        metricId: MetricId.ActiveCustomers,
        limit: null,
        warnAt: null
      }
    ]
  }
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
