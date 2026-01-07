import { Context, Effect } from 'effect';
import type { BillingProviderError } from '../../../billing/errors';
import type {
  BillingProviderConfig,
  BillingTierNameValue,
  CheckoutSessionResult,
  CreateCheckoutInput,
  CustomerInfo,
  MetricIdValue,
  SubscriptionInfo,
  UsageRecordInput
} from '../../../billing/types';

/**
 * Abstract billing provider interface
 * Implementations can be Polar, Stripe, or other providers
 */
export interface BillingProviderService {
  readonly config: BillingProviderConfig;

  /**
   * Customer management
   */
  syncCustomer(
    organizationId: string,
    email?: string
  ): Effect.Effect<CustomerInfo, BillingProviderError>;

  getCustomer(
    organizationId: string
  ): Effect.Effect<CustomerInfo | null, BillingProviderError>;

  /**
   * Usage tracking (provider-side)
   */
  recordUsageToProvider(
    record: UsageRecordInput & { externalCustomerId: string }
  ): Effect.Effect<void, BillingProviderError>;

  getUsageFromProvider(
    externalCustomerId: string,
    metricId: MetricIdValue,
    periodStart: Date,
    periodEnd: Date
  ): Effect.Effect<number, BillingProviderError>;

  /**
   * Subscription management
   */
  createCheckoutSession(
    input: CreateCheckoutInput
  ): Effect.Effect<CheckoutSessionResult, BillingProviderError>;

  getSubscription(
    externalCustomerId: string
  ): Effect.Effect<SubscriptionInfo | null, BillingProviderError>;

  cancelSubscription(
    externalSubscriptionId: string
  ): Effect.Effect<void, BillingProviderError>;

  /**
   * Meter management
   * Ensures meters exist in the provider for all our metrics
   */
  syncMeters(): Effect.Effect<void, BillingProviderError>;

  /**
   * Get the product/price ID for a tier
   */
  getProductIdForTier(
    tier: BillingTierNameValue
  ): Effect.Effect<string | null, BillingProviderError>;
}

/**
 * Effect Context Tag for BillingProvider
 */
export class BillingProvider extends Context.Tag('BillingProvider')<
  BillingProvider,
  BillingProviderService
>() {}
