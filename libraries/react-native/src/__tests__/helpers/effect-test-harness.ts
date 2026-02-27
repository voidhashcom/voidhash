import type { SdkCustomer } from "@voidhash/api-spec";
import { Effect, Layer, ManagedRuntime, pipe } from "effect";

import { CacheAdapter } from "../../core/caching/cache-adapter";
import { CacheManager } from "../../core/caching/cache-manager";
import { Product, type SubscriptionProduct } from "../../core/entities/product";
import { Transaction } from "../../core/entities/transaction";
import { EventBus, EventBusProvider } from "../../core/event-bus";
import { CustomerAttributeManager } from "../../core/identity/customer-attribute-manager";
import { CustomerInfoManager } from "../../core/identity/customer-info-manager";
import { IdentityManager } from "../../core/identity/identity-manager";
import { ApiClient } from "../../core/networking/api-client";
import { PaymentAdapter } from "../../core/payment-adapters/payment-adapter";
import type { PlatformInfo } from "../../core/platform/platform-provider";
import { PlatformProvider } from "../../core/platform/platform-provider";
import { SdkConfiguration } from "../../core/sdk-configuration";

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
  readonly identifyCalls: ApiSdkCall[];
  readonly syncCustomerAttributesCalls: ApiSdkCall[];
  readonly syncTransactionCalls: ApiSdkCall[];
}

export interface ApiClientDoubleOptions {
  evaluateFeatureFlagsResult?: FeatureFlagsResult;
  getCustomerResult?: SdkCustomer;
  identifyResult?: SdkCustomer;
  syncTransactionShouldFail?: boolean;
}

export function createSdkCustomer(appUserId: string): SdkCustomer {
  return {
    appUserId,
    customerId: `customer-${appUserId}`,
    email: null,
    name: null,
  } as SdkCustomer;
}

export function createApiClientDouble(options: ApiClientDoubleOptions = {}) {
  const state: ApiClientDoubleState = {
    evaluateFeatureFlagsCalls: [],
    getCustomerCalls: [],
    identifyCalls: [],
    syncCustomerAttributesCalls: [],
    syncTransactionCalls: [],
  };

  const apiClient = {
    sdk: {
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
        const appUserId = String(request.headers["x-app-user-id"]);
        return Effect.succeed(
          options.getCustomerResult ?? createSdkCustomer(appUserId)
        );
      },
      identify: (request: ApiSdkCall) => {
        state.identifyCalls.push(request);
        const appUserId = String(request.payload?.appUserId ?? "identified-user");
        return Effect.succeed(
          options.identifyResult ?? createSdkCustomer(appUserId)
        );
      },
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
    apiClient: apiClient as unknown as ApiClient,
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
    paymentAdapter: paymentAdapter as unknown as PaymentAdapter,
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

export interface EffectTestHarnessOptions {
  apiClient: ApiClient;
  cacheAdapter: ReturnType<typeof createInMemoryCacheAdapter>["adapter"];
  debug?: boolean;
  eventBus?: EventBus;
  paymentAdapter: PaymentAdapter;
  platform?: Partial<PlatformInfo>;
  readOnly?: boolean;
}

const defaultPlatformInfo: PlatformInfo = {
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
  const eventBus = options.eventBus ?? new EventBus();

  const layer = pipe(
    CustomerAttributeManager.Default,
    Layer.provideMerge(CustomerInfoManager.Default),
    Layer.provideMerge(IdentityManager.Default),
    Layer.provideMerge(CacheManager.Default),
    Layer.provideMerge(Layer.succeed(CacheAdapter, options.cacheAdapter)),
    Layer.provideMerge(Layer.succeed(ApiClient, options.apiClient)),
    Layer.provideMerge(Layer.succeed(PaymentAdapter, options.paymentAdapter)),
    Layer.provideMerge(Layer.succeed(EventBusProvider, eventBus)),
    Layer.provideMerge(
      Layer.succeed(PlatformProvider, {
        ...defaultPlatformInfo,
        ...options.platform,
      })
    ),
    Layer.provideMerge(
      Layer.succeed(SdkConfiguration, {
        baseUrl: "https://api.voidhash.test",
        debug: options.debug ?? false,
        publishableKey: "pk_test",
        readOnly: options.readOnly ?? false,
      })
    )
  );

  return {
    eventBus,
    runtime: ManagedRuntime.make(layer),
  };
}
