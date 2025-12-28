/** biome-ignore-all lint/correctness/useYield: Only mocks */
import { Effect, Layer } from 'effect';
import { vi } from 'vitest';
import { BillingProviderError } from '../../billing/errors';
import type {
  BillingTierNameValue,
  CheckoutSessionResult,
  CreateCheckoutInput,
  CustomerInfo,
  MetricIdValue,
  SubscriptionInfo,
  UsageRecordInput
} from '../../billing/types';
import { BillingTierName } from '../../billing/types';
import {
  BillingProvider,
  type BillingProviderService
} from '../../services/billing/providers/billing-provider';

const PROVIDER_ID = 'mock';

/**
 * Mock customer data store
 */
export interface MockCustomerData {
  organizationId: string;
  externalCustomerId: string;
  email?: string;
  tier: BillingTierNameValue;
  subscriptionStatus: 'none' | 'active' | 'canceled' | 'past_due' | 'trialing';
}

/**
 * Mock subscription data store
 */
export interface MockSubscriptionData {
  externalSubscriptionId: string;
  externalCustomerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  tier: BillingTierNameValue;
}

/**
 * Mock usage record
 */
export interface MockUsageRecord {
  externalCustomerId: string;
  metricId: MetricIdValue;
  value: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Mock checkout session
 */
export interface MockCheckoutSession {
  id: string;
  url: string;
  customerId: string;
  tier: BillingTierNameValue;
}

/**
 * State for the mock billing provider
 */
export interface MockBillingState {
  customers: Map<string, MockCustomerData>;
  subscriptions: Map<string, MockSubscriptionData>;
  usageRecords: MockUsageRecord[];
  checkoutSessions: Map<string, MockCheckoutSession>;
  nextCustomerId: number;
  nextSubscriptionId: number;
  nextCheckoutId: number;
}

/**
 * Create initial mock billing state
 */
export const createMockBillingState = (): MockBillingState => ({
  customers: new Map(),
  subscriptions: new Map(),
  usageRecords: [],
  checkoutSessions: new Map(),
  nextCustomerId: 1,
  nextSubscriptionId: 1,
  nextCheckoutId: 1
});

/**
 * Create a mock customer
 */
export const createMockCustomer = (
  overrides: Partial<MockCustomerData> = {}
): MockCustomerData => ({
  organizationId: 'org_test_123',
  externalCustomerId: 'cust_mock_123',
  email: 'test@example.com',
  tier: BillingTierName.Free,
  subscriptionStatus: 'none',
  ...overrides
});

/**
 * Create a mock subscription
 */
export const createMockSubscription = (
  overrides: Partial<MockSubscriptionData> = {}
): MockSubscriptionData => {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    externalSubscriptionId: 'sub_mock_123',
    externalCustomerId: 'cust_mock_123',
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    tier: BillingTierName.Pro,
    ...overrides
  };
};

/**
 * Create a mock checkout session result
 */
export const createMockCheckoutSession = (
  overrides: Partial<CheckoutSessionResult> = {}
): CheckoutSessionResult => ({
  id: 'checkout_mock_123',
  url: 'https://mock-billing.example.com/checkout/checkout_mock_123',
  ...overrides
});

/**
 * Mock billing provider implementation
 */
export const createMockBillingProvider = (
  state: MockBillingState = createMockBillingState()
): BillingProviderService => {
  const service: BillingProviderService = {
    config: {
      id: PROVIDER_ID,
      name: 'Mock Billing Provider'
    },

    syncCustomer: vi.fn((organizationId: string, email?: string) =>
      Effect.gen(function* () {
        const existing = state.customers.get(organizationId);

        if (existing) {
          return {
            organizationId,
            externalCustomerId: existing.externalCustomerId,
            tier: existing.tier,
            subscriptionStatus: existing.subscriptionStatus
          } as CustomerInfo;
        }

        const externalCustomerId = `cust_mock_${state.nextCustomerId++}`;
        const customer: MockCustomerData = {
          organizationId,
          externalCustomerId,
          email,
          tier: BillingTierName.Free,
          subscriptionStatus: 'none'
        };

        state.customers.set(organizationId, customer);

        return {
          organizationId,
          externalCustomerId,
          tier: BillingTierName.Free,
          subscriptionStatus: 'none'
        } as CustomerInfo;
      })
    ),

    getCustomer: vi.fn((organizationId: string) =>
      Effect.gen(function* () {
        const customer = state.customers.get(organizationId);

        if (!customer) {
          return null;
        }

        return {
          organizationId,
          externalCustomerId: customer.externalCustomerId,
          tier: customer.tier,
          subscriptionStatus: customer.subscriptionStatus
        } as CustomerInfo;
      })
    ),

    recordUsageToProvider: vi.fn(
      (record: UsageRecordInput & { externalCustomerId: string }) =>
        Effect.gen(function* () {
          state.usageRecords.push({
            externalCustomerId: record.externalCustomerId,
            metricId: record.metricId,
            value: record.value,
            timestamp: new Date(),
            metadata: record.metadata
          });
        })
    ),

    getUsageFromProvider: vi.fn(
      (
        externalCustomerId: string,
        metricId: MetricIdValue,
        periodStart: Date,
        periodEnd: Date
      ) =>
        Effect.gen(function* () {
          const records = state.usageRecords.filter(
            (r) =>
              r.externalCustomerId === externalCustomerId &&
              r.metricId === metricId &&
              r.timestamp >= periodStart &&
              r.timestamp <= periodEnd
          );

          return records.reduce((sum, r) => sum + r.value, 0);
        })
    ),

    createCheckoutSession: vi.fn((input: CreateCheckoutInput) =>
      Effect.gen(function* () {
        const checkoutId = `checkout_mock_${state.nextCheckoutId++}`;
        const session: MockCheckoutSession = {
          id: checkoutId,
          url: `https://mock-billing.example.com/checkout/${checkoutId}`,
          customerId: input.externalCustomerId,
          tier: input.tier
        };

        state.checkoutSessions.set(checkoutId, session);

        return {
          id: checkoutId,
          url: session.url
        } as CheckoutSessionResult;
      })
    ),

    getSubscription: vi.fn((externalCustomerId: string) =>
      Effect.gen(function* () {
        const subscription = Array.from(state.subscriptions.values()).find(
          (s) =>
            s.externalCustomerId === externalCustomerId &&
            (s.status === 'active' || s.status === 'trialing')
        );

        if (!subscription) {
          return null;
        }

        return {
          externalSubscriptionId: subscription.externalSubscriptionId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          tier: subscription.tier
        } as SubscriptionInfo;
      })
    ),

    cancelSubscription: vi.fn((externalSubscriptionId: string) =>
      Effect.gen(function* () {
        const subscription = state.subscriptions.get(externalSubscriptionId);

        if (!subscription) {
          return yield* Effect.fail(
            new BillingProviderError({
              message: 'Subscription not found',
              provider: PROVIDER_ID
            })
          );
        }

        subscription.status = 'canceled';
      })
    ),

    syncMeters: vi.fn(() =>
      Effect.gen(function* () {
        yield* Effect.log('Mock: syncMeters called');
      })
    ),

    getProductIdForTier: vi.fn((tier: BillingTierNameValue) =>
      Effect.succeed(
        tier === BillingTierName.Enterprise
          ? 'prod_mock_enterprise'
          : tier === BillingTierName.Pro
            ? 'prod_mock_pro'
            : null
      )
    )
  };

  return service;
};

/**
 * Create mock billing provider with pre-populated data
 */
export const createMockBillingProviderWithData = (options: {
  customers?: MockCustomerData[];
  subscriptions?: MockSubscriptionData[];
  usageRecords?: MockUsageRecord[];
}): { provider: BillingProviderService; state: MockBillingState } => {
  const state = createMockBillingState();

  if (options.customers) {
    for (const customer of options.customers) {
      state.customers.set(customer.organizationId, customer);
    }
  }

  if (options.subscriptions) {
    for (const subscription of options.subscriptions) {
      state.subscriptions.set(
        subscription.externalSubscriptionId,
        subscription
      );
    }
  }

  if (options.usageRecords) {
    state.usageRecords.push(...options.usageRecords);
  }

  return {
    provider: createMockBillingProvider(state),
    state
  };
};

/**
 * Layer that provides mock BillingProvider
 */
export const MockBillingProviderLive = Layer.succeed(
  BillingProvider,
  createMockBillingProvider()
);

/**
 * Create a Layer with custom mock state
 */
export const createMockBillingProviderLayer = (
  state?: MockBillingState
): Layer.Layer<BillingProvider> =>
  Layer.succeed(BillingProvider, createMockBillingProvider(state));

/**
 * Helper to simulate a successful checkout completion
 */
export const simulateCheckoutCompletion = (
  state: MockBillingState,
  checkoutId: string
): MockSubscriptionData | null => {
  const session = state.checkoutSessions.get(checkoutId);
  if (!session) {
    return null;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription: MockSubscriptionData = {
    externalSubscriptionId: `sub_mock_${state.nextSubscriptionId++}`,
    externalCustomerId: session.customerId,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    tier: session.tier
  };

  state.subscriptions.set(subscription.externalSubscriptionId, subscription);

  // Update customer tier
  for (const customer of state.customers.values()) {
    if (customer.externalCustomerId === session.customerId) {
      customer.tier = session.tier;
      customer.subscriptionStatus = 'active';
      break;
    }
  }

  return subscription;
};

/**
 * Helper to simulate subscription cancellation
 */
export const simulateSubscriptionCancellation = (
  state: MockBillingState,
  externalSubscriptionId: string
): boolean => {
  const subscription = state.subscriptions.get(externalSubscriptionId);
  if (!subscription) {
    return false;
  }

  subscription.status = 'canceled';

  // Update customer status
  for (const customer of state.customers.values()) {
    if (customer.externalCustomerId === subscription.externalCustomerId) {
      customer.subscriptionStatus = 'canceled';
      break;
    }
  }

  return true;
};

/**
 * Reset mock billing state
 */
export const resetMockBillingState = (state: MockBillingState): void => {
  state.customers.clear();
  state.subscriptions.clear();
  state.usageRecords.length = 0;
  state.checkoutSessions.clear();
  state.nextCustomerId = 1;
  state.nextSubscriptionId = 1;
  state.nextCheckoutId = 1;
};
