/** biome-ignore-all lint/correctness/useYield: Only mocks */
import { Effect, Layer } from "effect";
import { vi } from "vitest";

import { BillingProviderError } from "../../billing/errors";
import type {
  BillingTierNameValue,
  CheckoutSessionResult,
  CreateCheckoutInput,
  CustomerInfo,
  MetricIdValue,
  SubscriptionInfo,
  UsageRecordInput,
} from "../../billing/types";
import { BillingTierName } from "../../billing/types";
import {
  BillingProvider,
  type BillingProviderService,
} from "../../services/billing/providers/billing-provider";

const PROVIDER_ID = "mock";

/**
 * Mock customer data store
 */
export interface MockCustomerData {
  organizationId: string;
  externalCustomerId: string;
  email?: string;
  tier: BillingTierNameValue;
  subscriptionStatus: "none" | "active" | "canceled" | "past_due" | "trialing";
}

/**
 * Mock subscription data store
 */
export interface MockSubscriptionData {
  externalSubscriptionId: string;
  externalCustomerId: string;
  status: "active" | "canceled" | "past_due" | "trialing";
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
  checkoutSessions: new Map(),
  customers: new Map(),
  nextCheckoutId: 1,
  nextCustomerId: 1,
  nextSubscriptionId: 1,
  subscriptions: new Map(),
  usageRecords: [],
});

/**
 * Create a mock customer
 */
export const createMockCustomer = (
  overrides: Partial<MockCustomerData> = {}
): MockCustomerData => ({
  organizationId: "org_test_123",
  externalCustomerId: "cust_mock_123",
  email: "test@example.com",
  tier: BillingTierName.Free,
  subscriptionStatus: "none",
  ...overrides,
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
    externalSubscriptionId: "sub_mock_123",
    externalCustomerId: "cust_mock_123",
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    tier: BillingTierName.Pro,
    ...overrides,
  };
};

/**
 * Create a mock checkout session result
 */
export const createMockCheckoutSession = (
  overrides: Partial<CheckoutSessionResult> = {}
): CheckoutSessionResult => ({
  id: "checkout_mock_123",
  url: "https://mock-billing.example.com/checkout/checkout_mock_123",
  ...overrides,
});

/**
 * Mock billing provider implementation
 */
export const createMockBillingProvider = (
  state: MockBillingState = createMockBillingState()
): BillingProviderService => {
  const service: BillingProviderService = {
    cancelSubscription: vi.fn((externalSubscriptionId: string) =>
      Effect.gen(function* cancelSubscription() {
        const subscription = state.subscriptions.get(externalSubscriptionId);

        if (!subscription) {
          return yield* Effect.fail(
            new BillingProviderError({
              message: "Subscription not found",
              provider: PROVIDER_ID,
            })
          );
        }

        subscription.status = "canceled";
      })
    ),

    config: {
      id: PROVIDER_ID,
      name: "Mock Billing Provider",
    },

    createCheckoutSession: vi.fn((input: CreateCheckoutInput) =>
      Effect.gen(function* createCheckoutSession() {
        const checkoutId = `checkout_mock_${state.nextCheckoutId++}`;
        const session: MockCheckoutSession = {
          customerId: input.externalCustomerId,
          id: checkoutId,
          tier: input.tier,
          url: `https://mock-billing.example.com/checkout/${checkoutId}`,
        };

        state.checkoutSessions.set(checkoutId, session);

        return {
          id: checkoutId,
          url: session.url,
        } as CheckoutSessionResult;
      })
    ),

    getCustomer: vi.fn((organizationId: string) =>
      Effect.gen(function* getCustomer() {
        const customer = state.customers.get(organizationId);

        if (!customer) {
          return null;
        }

        return {
          externalCustomerId: customer.externalCustomerId,
          organizationId,
          subscriptionStatus: customer.subscriptionStatus,
          tier: customer.tier,
        } as CustomerInfo;
      })
    ),

    getProductIdForTier: vi.fn((tier: BillingTierNameValue) =>
      Effect.succeed(
        tier === BillingTierName.Enterprise
          ? "prod_mock_enterprise"
          : (tier === BillingTierName.Pro
            ? "prod_mock_pro"
            : null)
      )
    ),

    getSubscription: vi.fn((externalCustomerId: string) =>
      Effect.gen(function* getSubscription() {
        const subscription = [...state.subscriptions.values()].find(
          (s) =>
            s.externalCustomerId === externalCustomerId &&
            (s.status === "active" || s.status === "trialing")
        );

        if (!subscription) {
          return null;
        }

        return {
          currentPeriodEnd: subscription.currentPeriodEnd,
          currentPeriodStart: subscription.currentPeriodStart,
          externalSubscriptionId: subscription.externalSubscriptionId,
          status: subscription.status,
          tier: subscription.tier,
        } as SubscriptionInfo;
      })
    ),

    getUsageFromProvider: vi.fn(
      (
        externalCustomerId: string,
        metricId: MetricIdValue,
        periodStart: Date,
        periodEnd: Date
      ) =>
        Effect.gen(function* getUsageFromProvider() {
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

    recordUsageToProvider: vi.fn(
      (record: UsageRecordInput & { externalCustomerId: string }) =>
        Effect.gen(function* recordUsageToProvider() {
          state.usageRecords.push({
            externalCustomerId: record.externalCustomerId,
            metadata: record.metadata,
            metricId: record.metricId,
            timestamp: new Date(),
            value: record.value,
          });
        })
    ),

    syncCustomer: vi.fn((organizationId: string, email?: string) =>
      Effect.gen(function* syncCustomer() {
        const existing = state.customers.get(organizationId);

        if (existing) {
          return {
            externalCustomerId: existing.externalCustomerId,
            organizationId,
            subscriptionStatus: existing.subscriptionStatus,
            tier: existing.tier,
          } as CustomerInfo;
        }

        const externalCustomerId = `cust_mock_${state.nextCustomerId++}`;
        const customer: MockCustomerData = {
          email,
          externalCustomerId,
          organizationId,
          subscriptionStatus: "none",
          tier: BillingTierName.Free,
        };

        state.customers.set(organizationId, customer);

        return {
          externalCustomerId,
          organizationId,
          subscriptionStatus: "none",
          tier: BillingTierName.Free,
        } as CustomerInfo;
      })
    ),

    syncMeters: vi.fn(() =>
      Effect.gen(function* syncMeters() {
        yield* Effect.log("Mock: syncMeters called");
      })
    ),
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
    state,
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
    currentPeriodEnd: periodEnd,
    currentPeriodStart: now,
    externalCustomerId: session.customerId,
    externalSubscriptionId: `sub_mock_${state.nextSubscriptionId++}`,
    status: "active",
    tier: session.tier,
  };

  state.subscriptions.set(subscription.externalSubscriptionId, subscription);

  // Update customer tier
  for (const customer of state.customers.values()) {
    if (customer.externalCustomerId === session.customerId) {
      customer.tier = session.tier;
      customer.subscriptionStatus = "active";
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

  subscription.status = "canceled";

  // Update customer status
  for (const customer of state.customers.values()) {
    if (customer.externalCustomerId === subscription.externalCustomerId) {
      customer.subscriptionStatus = "canceled";
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
