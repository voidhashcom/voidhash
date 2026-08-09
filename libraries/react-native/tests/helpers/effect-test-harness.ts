import type { SdkPerson } from "@voidhash/generated-clients";
import { Effect, Layer, ManagedRuntime, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRegistry } from "effect/unstable/reactivity";

import { CacheAdapter } from "../../src/core/caching/cache-adapter";
import { CacheManager } from "../../src/core/caching/cache-manager";
import { Product } from "../../src/core/entities/product";
import { Transaction } from "../../src/core/entities/transaction";
import { PersonAttributeManager } from "../../src/core/identity/person-attribute-manager";
import { PersonInfoManager } from "../../src/core/identity/person-info-manager";
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
import type { RuntimeProductDefinition } from "../../src/core/schema/runtime";
import { SchemaManager } from "../../src/core/schema/schema-manager";
import { SdkConfiguration } from "../../src/core/sdk-configuration";
import { TransactionService } from "../../src/core/transactions/transaction-service";
import { createTestSchema } from "./test-schema";

type FeatureFlagsResult = {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: string | null;
  }>;
};

export type ApiSdkCall = {
  readonly headers: Record<string, unknown>;
  readonly payload?: Record<string, unknown> | undefined;
};

/** Reads the `distinctId` field off an untyped identify payload. */
const payloadDistinctId = (request: ApiSdkCall): string => {
  const value = request.payload?.distinctId;
  if (typeof value === "string") return value;
  return "identified-user";
};

export interface ApiClientDoubleState {
  readonly evaluateFeatureFlagsCalls: ApiSdkCall[];
  readonly getPersonCalls: ApiSdkCall[];
  readonly getSchemaCalls: ApiSdkCall[];
  readonly identifyCalls: ApiSdkCall[];
  readonly syncPersonAttributesCalls: ApiSdkCall[];
  readonly syncTransactionCalls: ApiSdkCall[];
}

export interface ApiClientDoubleOptions {
  evaluateFeatureFlagsResult?: FeatureFlagsResult;
  getPersonResult?: SdkPerson;
  /**
   * Simulate the server's `GET /sdk/person` 404 for a not-yet-persisted
   * person (the `ApiSdkPersonNotFoundError` the generated client surfaces).
   */
  getPersonShouldNotFound?: boolean;
  getSchemaResult?: ReturnType<typeof createTestSchema>;
  getSchemaShouldFail?: boolean;
  identifyResult?: SdkPerson;
  syncPersonAttributesResult?: SdkPerson;
  syncTransactionEffect?: (request: ApiSdkCall) => Effect.Effect<{ accepted: boolean }, Error>;
  syncTransactionShouldFail?: boolean;
}

export function createSdkPerson(distinctId: string) {
  return {
    distinctId,
    personId: `person-${distinctId}`,
    email: null,
    name: null,
  } as SdkPerson;
}

export function createApiClientDouble(options: ApiClientDoubleOptions = {}) {
  const state: ApiClientDoubleState = {
    evaluateFeatureFlagsCalls: [],
    getPersonCalls: [],
    getSchemaCalls: [],
    identifyCalls: [],
    syncPersonAttributesCalls: [],
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
          },
        );
      },
      getPerson: (request: ApiSdkCall) => {
        state.getPersonCalls.push(request);
        if (options.getPersonShouldNotFound) {
          return Effect.fail({
            _tag: "ApiSdkPersonNotFoundError",
            message: JSON.stringify({
              _tag: "Api/SdkPersonNotFoundError",
              message: "Person not found",
            }),
          });
        }
        const distinctId = String(request.headers["x-distinct-id"]);
        return Effect.succeed(options.getPersonResult ?? createSdkPerson(distinctId));
      },
      identify: (request: ApiSdkCall) => {
        state.identifyCalls.push(request);
        const distinctId = payloadDistinctId(request);
        return Effect.succeed(options.identifyResult ?? createSdkPerson(distinctId));
      },
      resolvePaywall: () => Effect.succeed(null),
      syncPersonAttributes: (request: ApiSdkCall) => {
        state.syncPersonAttributesCalls.push(request);
        const distinctId = String(request.headers["x-distinct-id"]);
        return Effect.succeed(options.syncPersonAttributesResult ?? createSdkPerson(distinctId));
      },
      syncTransaction: (request: ApiSdkCall) => {
        state.syncTransactionCalls.push(request);
        if (options.syncTransactionEffect) {
          return options.syncTransactionEffect(request);
        }
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
  acknowledgePurchaseProductTypes: Array<RuntimeProductDefinition["type"] | undefined>;
  buyProductCalls: Array<{
    appAccountToken?: string;
    product: Product;
    quantity?: number;
  }>;
  endConnectionCalls: number;
  getProductsCalls: number;
  initConnectionCalls: number;
  onPurchaseCallback?: (transaction: Transaction) => void;
}

export interface PaymentAdapterDoubleOptions {
  acknowledgePurchaseShouldFailTimes?: number;
  buyProductTransaction?: Transaction;
  listenerTransaction?: Transaction;
  pendingTransactions?: Transaction[];
  purchaseHistory?: Transaction[];
  products?: Product[];
}

export function createPaymentAdapterDouble(options: PaymentAdapterDoubleOptions = {}) {
  let remainingAcknowledgeFailures = options.acknowledgePurchaseShouldFailTimes ?? 0;
  const state: PaymentAdapterDoubleState = {
    acknowledgePurchaseCalls: [],
    acknowledgePurchaseProductTypes: [],
    buyProductCalls: [],
    endConnectionCalls: 0,
    getProductsCalls: 0,
    initConnectionCalls: 0,
    onPurchaseCallback: undefined,
  };

  const paymentAdapter = {
    acknowledgePurchase: (
      transaction: Transaction,
      productType?: RuntimeProductDefinition["type"],
    ) => {
      state.acknowledgePurchaseCalls.push(transaction);
      state.acknowledgePurchaseProductTypes.push(productType);
      if (remainingAcknowledgeFailures > 0) {
        remainingAcknowledgeFailures -= 1;
        return Effect.fail(new Error("acknowledgePurchase failed"));
      }
      return Effect.void;
    },
    buyProduct: (product: Product, quantity?: number, appAccountToken?: string) => {
      state.buyProductCalls.push({ appAccountToken, product, quantity });
      return Effect.succeed(
        options.buyProductTransaction ??
          new Transaction("tx-id", "tx-id", product.slug, Date.now(), 1, false, "ios", {
            appAccountToken,
          }),
      );
    },
    endConnection: () => {
      state.endConnectionCalls += 1;
      return Effect.void;
    },
    getPendingTransactions: () => Effect.succeed(options.pendingTransactions ?? []),
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
    PersonAttributeManager.Default,
    Layer.provideMerge(ProductService.layer),
    Layer.provideMerge(FeatureFlagService.layer),
    Layer.provideMerge(PaywallService.layer),
    Layer.provideMerge(TransactionService.layer),
    Layer.provideMerge(AnalyticsService.layer),
    Layer.provideMerge(LifecycleService.layer),
    Layer.provideMerge(Layer.succeed(LifecycleAdapter, lifecycle.adapter)),
    Layer.provideMerge(PersonInfoManager.Default),
    Layer.provideMerge(SchemaManager.layer),
    Layer.provideMerge(IdentityManager.Default),
    Layer.provideMerge(CacheManager.Default),
    Layer.provideMerge(Layer.succeed(CacheAdapter, options.cacheAdapter)),
    Layer.provideMerge(Layer.succeed(ApiClient, options.apiClient as typeof ApiClient.Service)),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(
      Layer.succeed(PaymentAdapter, options.paymentAdapter as typeof PaymentAdapter.Service),
    ),
    Layer.provideMerge(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry)),
    Layer.provideMerge(
      Layer.succeed(PlatformProvider, {
        ...defaultPlatformInfo,
        ...options.platform,
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(SdkConfiguration, {
        baseUrl: options.baseUrl ?? "https://api.voidhash.test",
        debug: options.debug ?? false,
        ingestUrl: options.ingestUrl,
        publishableKey: options.publishableKey ?? "pk_test",
        readOnly: options.readOnly ?? false,
      }),
    ),
  );
  const layer = options.fetch
    ? pipe(baseLayer, Layer.provideMerge(Layer.succeed(FetchHttpClient.Fetch, options.fetch)))
    : baseLayer;

  return {
    atomRegistry,
    runtime: ManagedRuntime.make(layer),
  };
}
