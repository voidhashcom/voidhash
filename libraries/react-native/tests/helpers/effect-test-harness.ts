import type { SdkPerson as SdkCustomer } from "@voidhash/generated-clients";
import { Effect, Layer, ManagedRuntime, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRegistry } from "effect/unstable/reactivity";

import { CacheAdapter } from "../../src/core/caching/cache-adapter";
import { CacheManager } from "../../src/core/caching/cache-manager";
import { Product, type SubscriptionProduct } from "../../src/core/entities/product";
import { Transaction } from "../../src/core/entities/transaction";
import { CustomerAttributeManager } from "../../src/core/identity/customer-attribute-manager";
import { CustomerInfoManager } from "../../src/core/identity/customer-info-manager";
import { IdentityManager } from "../../src/core/identity/identity-manager";
import { AnalyticsService } from "../../src/core/analytics/service";
import { FeatureFlagService } from "../../src/core/feature-flags/feature-flag-service";
import { LifecycleAdapter } from "../../src/core/lifecycle/lifecycle-adapter";
import { LifecycleService } from "../../src/core/lifecycle/lifecycle-service";
import { ApiClient } from "../../src/core/networking/api-client";
import { PaywallService } from "../../src/core/paywalls/paywall-service";
import { PaymentAdapter } from "../../src/core/payment-adapters/payment-adapter";
import type { PlatformInfo } from "../../src/core/platform/platform-provider";
import { PlatformProvider } from "../../src/core/platform/platform-provider";
import { ProductService } from "../../src/core/products/product-service";
import { SchemaManager } from "../../src/core/schema/schema-manager";
import { SdkConfiguration } from "../../src/core/sdk-configuration";
import { TransactionService } from "../../src/core/transactions/transaction-service";
import { createTestSchema } from "./test-schema";

type FeatureFlagsResult = {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown | null;
    readonly variantKey: string | null;
  }>;
};

export type ApiSdkCall = {
  readonly headers: Record<string, unknown>;
  readonly payload?: Record<string, unknown> | undefined;
};

export interface ApiClientDoubleState {
  readonly evaluateFeatureFlagsCalls: ApiSdkCall[];
  readonly getCustomerCalls: ApiSdkCall[];
  readonly getSchemaCalls: ApiSdkCall[];
  readonly identifyCalls: ApiSdkCall[];
  readonly syncCustomerAttributesCalls: ApiSdkCall[];
  readonly syncTransactionCalls: ApiSdkCall[];
}

export interface ApiClientDoubleOptions {
  evaluateFeatureFlagsResult?: FeatureFlagsResult;
  getCustomerResult?: SdkCustomer;
  getSchemaResult?: ReturnType<typeof createTestSchema>;
  getSchemaShouldFail?: boolean;
  identifyResult?: SdkCustomer;
  syncTransactionShouldFail?: boolean;
}

export function createSdkCustomer(distinctId: string) {
  return {
    distinctId,
    personId: `person-${distinctId}`,
    email: null,
    name: null,
  } as SdkCustomer;
}

export function createApiClientDouble(options: ApiClientDoubleOptions = {}) {
  const state: ApiClientDoubleState = {
    evaluateFeatureFlagsCalls: [],
    getCustomerCalls: [],
    getSchemaCalls: [],
    identifyCalls: [],
    syncCustomerAttributesCalls: [],
    syncTransactionCalls: [],
  };

  const apiClient = {
    sdk: {
      getSchema: (request: ApiSdkCall) => {
        state.getSchemaCalls.push(request);
        if (options.getSchemaShouldFail) {
          return Effect.fail(new Error("getSchema failed"));
        }
        return Effect.succeed(options.getSchemaResult ?? createTestSchema());
      },
      evaluateFeatureFlags: (request: ApiSdkCall) => {
        state.evaluateFeatureFlagsCalls.push(request);
        return Effect.succeed(
          options.evaluateFeatureFlagsResult ?? {
            flags: [
              {
                enabled: true,
                key: "default-flag",
                payload: { source: "api-double" },
                variantKey: "on",
              },
            ],
          }
        );
      },
      getCustomer: (request: ApiSdkCall) => {
        state.getCustomerCalls.push(request);
        const distinctId = String(request.headers["x-distinct-id"]);
        return Effect.succeed(
          options.getCustomerResult ?? createSdkCustomer(distinctId)
        );
      },
      identify: (request: ApiSdkCall) => {
        state.identifyCalls.push(request);
        const distinctId = String(request.payload?.distinctId ?? "identified-user");
        return Effect.succeed(
          options.identifyResult ?? createSdkCustomer(distinctId)
        );
      },
      resolvePaywall: () => Effect.succeed(null),
      syncCustomerAttributes: (request: ApiSdkCall) => {
        state.syncCustomerAttributesCalls.push(request);
        return Effect.void;
      },
      syncTransaction: (request: ApiSdkCall) => {
        state.syncTransactionCalls.push(request);
        if (options.syncTransactionShouldFail) {
          return Effect.fail(new Error("syncTransaction failed"));
        }
        return Effect.succeed({ accepted: true });
      },
    },
  };

  return {
    apiClient: apiClient as unknown,
    state,
  };
}

export interface PaymentAdapterDoubleState {
  acknowledgePurchaseCalls: Transaction[];
  buyProductCalls: SubscriptionProduct[];
  endConnectionCalls: number;
  getProductsCalls: number;
  initConnectionCalls: number;
  onPurchaseCallback?: (transaction: Transaction) => void;
}

export interface PaymentAdapterDoubleOptions {
  buyProductTransaction?: Transaction;
  listenerTransaction?: Transaction;
  pendingTransactions?: Transaction[];
  purchaseHistory?: Transaction[];
  products?: Product[];
}

export function createPaymentAdapterDouble(
  options: PaymentAdapterDoubleOptions = {}
) {
  const state: PaymentAdapterDoubleState = {
    acknowledgePurchaseCalls: [],
    buyProductCalls: [],
    endConnectionCalls: 0,
    getProductsCalls: 0,
    initConnectionCalls: 0,
    onPurchaseCallback: undefined,
  };

  const paymentAdapter = {
    acknowledgePurchase: (transaction: Transaction) => {
      state.acknowledgePurchaseCalls.push(transaction);
      return Effect.void;
    },
    buyProduct: (product: SubscriptionProduct) => {
      state.buyProductCalls.push(product);
      return Effect.succeed(
        options.buyProductTransaction ??
          new Transaction(
            "tx-id",
            "tx-id",
            product.slug,
            Date.now(),
            1,
            false,
            "ios"
          )
      );
    },
    endConnection: () => {
      state.endConnectionCalls += 1;
      return Effect.void;
    },
    getPendingTransactions: () =>
      Effect.succeed(options.pendingTransactions ?? []),
    getProducts: () => {
      state.getProductsCalls += 1;
      return Effect.succeed(options.products ?? []);
    },
    getPurchaseHistory: () => Effect.succeed(options.purchaseHistory ?? []),
    initConnection: (onPurchase?: (transaction: Transaction) => void) => {
      state.initConnectionCalls += 1;
      state.onPurchaseCallback = onPurchase;
      if (onPurchase && options.listenerTransaction) {
        onPurchase(options.listenerTransaction);
      }
      return Effect.void;
    },
  };

  return {
    paymentAdapter: paymentAdapter as unknown,
    state,
  };
}

export function createInMemoryCacheAdapter() {
  const store = new Map<string, string>();

  return {
    adapter: {
      delete: (key: string) =>
        Effect.sync(() => {
          store.delete(key);
        }),
      get: (key: string) => Effect.sync(() => store.get(key) ?? null),
      set: (key: string, value: string) =>
        Effect.sync(() => {
          store.set(key, value);
        }),
    },
    store,
  };
}

/**
 * No-op `LifecycleAdapter` double for tests. Returns `null` so callers know
 * lifecycle wiring is unavailable, mirroring the production fallback when
 * `react-native` isn't installed.
 */
export function createLifecycleAdapterDouble() {
  return {
    adapter: {
      subscribe: () => Effect.succeed(null),
    },
  };
}

export interface EffectTestHarnessOptions {
  apiClient: unknown;
  atomRegistry?: AtomRegistry.AtomRegistry;
  baseUrl?: string;
  cacheAdapter: ReturnType<typeof createInMemoryCacheAdapter>["adapter"];
  debug?: boolean;
  fetch?: typeof globalThis.fetch;
  ingestUrl?: string;
  lifecycleAdapter?: ReturnType<typeof createLifecycleAdapterDouble>;
  paymentAdapter: unknown;
  platform?: Partial<PlatformInfo>;
  publishableKey?: string;
  readOnly?: boolean;
}

const defaultPlatformInfo: PlatformInfo = {
  appBuild: "100",
  appName: "Voidhash Test",
  appVersion: "1.0.0",
  bundleId: "com.voidhash.test",
  deviceBrand: "Test Brand",
  deviceName: "Test Device",
  isDebugBuild: true,
  locales: [{ languageTag: "en-US" }],
  platform: "ios",
  systemVersion: "17.0",
};

export function createEffectTestHarness(options: EffectTestHarnessOptions) {
  const atomRegistry = options.atomRegistry ?? AtomRegistry.make();

  const lifecycle = options.lifecycleAdapter ?? createLifecycleAdapterDouble();

  const baseLayer = pipe(
    CustomerAttributeManager.Default,
    Layer.provideMerge(ProductService.layer),
    Layer.provideMerge(FeatureFlagService.layer),
    Layer.provideMerge(PaywallService.layer),
    Layer.provideMerge(TransactionService.layer),
    Layer.provideMerge(AnalyticsService.layer),
    Layer.provideMerge(LifecycleService.layer),
    Layer.provideMerge(Layer.succeed(LifecycleAdapter, lifecycle.adapter)),
    Layer.provideMerge(CustomerInfoManager.Default),
    Layer.provideMerge(SchemaManager.layer),
    Layer.provideMerge(IdentityManager.Default),
    Layer.provideMerge(CacheManager.Default),
    Layer.provideMerge(Layer.succeed(CacheAdapter, options.cacheAdapter)),
    Layer.provideMerge(
      Layer.succeed(ApiClient, options.apiClient as typeof ApiClient.Service)
    ),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(
      Layer.succeed(
        PaymentAdapter,
        options.paymentAdapter as typeof PaymentAdapter.Service
      )
    ),
    Layer.provideMerge(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry)),
    Layer.provideMerge(
      Layer.succeed(PlatformProvider, {
        ...defaultPlatformInfo,
        ...options.platform,
      })
    ),
    Layer.provideMerge(
      Layer.succeed(SdkConfiguration, {
        baseUrl: options.baseUrl ?? "https://api.voidhash.test",
        debug: options.debug ?? false,
        ingestUrl: options.ingestUrl,
        publishableKey: options.publishableKey ?? "pk_test",
        readOnly: options.readOnly ?? false,
      })
    )
  );
  const layer = options.fetch
    ? pipe(
        baseLayer,
        Layer.provideMerge(Layer.succeed(FetchHttpClient.Fetch, options.fetch))
      )
    : baseLayer;

  return {
    atomRegistry,
    runtime: ManagedRuntime.make(layer),
  };
}
