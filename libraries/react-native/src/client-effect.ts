import { Effect, Schedule } from "effect";

import { SDK_VERSION } from "./core/constants";
import { CacheManager } from "./core/caching/cache-manager";
import type { Product } from "./core/entities/product";
import type { Transaction } from "./core/entities/transaction";
import { EventBusProvider } from "./core/event-bus";
import { CustomerAttributeManager } from "./core/identity/customer-attribute-manager";
import { CustomerInfoManager } from "./core/identity/customer-info-manager";
import { IdentityManager } from "./core/identity/identity-manager";
import { ApiClient } from "./core/networking/api-client";
import { PaymentAdapter } from "./core/payment-adapters/payment-adapter";
import { PlatformProvider } from "./core/platform/platform-provider";
import type {
  ExtractSchemaProductDefinitions,
  ExtractSchemaProductKeys,
  InferGetPaywallLocationInput,
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "./core/schema";
import { extractProductDefinitions } from "./core/schema/utils";
import { SdkConfiguration } from "./core/sdk-configuration";
import { getCommonSdkHeaders } from "./core/utils/get-common-sdk-headers";
import { UnsupportedPlatformError } from "./errors";

const PROCESSED_TRANSACTION_TTL_MS = 1000 * 60 * 30;
const ANALYTICS_RETRY_BASE_MS = 200;
const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;

const generateFallbackNonce = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const getNonce = () => {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoObject?.randomUUID?.() ?? generateFallbackNonce();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface QueuedAnalyticsEvent {
  readonly eventName: string;
  readonly eventTimestamp: string;
  readonly id: string;
  readonly properties: Record<string, unknown>;
}

interface AppReleaseInfo {
  readonly appBuild: string | null;
  readonly appVersion: string | null;
}

type AppLifecycleState = string;

interface AppLifecycleSubscription {
  readonly remove: () => void;
}

interface ReactNativeAppState {
  readonly currentState?: AppLifecycleState;
  addEventListener: (
    eventType: "change",
    listener: (nextState: AppLifecycleState) => void
  ) => AppLifecycleSubscription;
}

const ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY =
  "voidhash:analytics:last-seen-app-release";

const getReactNativeAppState = (): ReactNativeAppState | null => {
  try {
    const reactNative = require("react-native") as {
      readonly AppState?: ReactNativeAppState;
    };
    return reactNative.AppState ?? null;
  } catch {
    return null;
  }
};

const toNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const toAppReleaseInfo = (value: unknown) => {
  if (!isRecord(value)) return null;
  return {
    appBuild: toNullableString(value.appBuild),
    appVersion: toNullableString(value.appVersion),
  };
};

export interface AnalyticsIngestEvent {
  /** Shared metadata attached to every event (for example app, device, or SDK context). */
  readonly context: Record<string, unknown>;
  /** Unique identifier for this event instance. */
  readonly event_id: string;
  /** Canonical event name used for analytics processing. */
  readonly event_name: string;
  /** Event timestamp in string form (typically ISO-8601). */
  readonly event_ts: string;
  /** Event-specific payload fields for this event name. */
  readonly properties: Record<string, unknown>;
  /** Identifier that groups events belonging to the same user session. */
  readonly session_id: string;
}

const makeUnitializedClient = () => ({
  init: <TSchema extends VoidhashSchema>(initOptions: {
    initialAppUserId?: string;
    schema: TSchema;
  }) =>
    Effect.gen(function* init() {
      const identityManager = yield* IdentityManager;
      const customerAttributeManager = yield* CustomerAttributeManager;
      const customerInfoManager = yield* CustomerInfoManager;

      if (initOptions.initialAppUserId) {
        // Identify as the user which ID was passed during SDK initialization
        yield* Effect.logDebug("Initializing with initial user id", {
          appUserId: initOptions.initialAppUserId,
        });

        // Sync customer attributes before identify to not lose historical customer data
        const appUserId = yield* identityManager.getAppUserIdFromCache();
        if (appUserId) {
          yield* customerAttributeManager.syncCustomerAttributes(appUserId);
        }

        yield* identityManager.identify(initOptions.initialAppUserId, {});
      } else {
        // If no user ID was passed during SDK initialization, fetch the last identified customer from the server
        const appUserId = yield* identityManager.getAppUserId();
        yield* Effect.logDebug("Initializing without initial user id", {
          appUserId,
        });

        yield* customerAttributeManager.syncCustomerAttributes(appUserId);

        // We don't need the result immediately. We do this to pre-fetch fresh customer data in the background.
        yield* customerInfoManager.getCustomer(appUserId, "fetch");
      }

      // Return the initialized client
      return makeInitializedClient<TSchema>({
        schema: initOptions.schema,
      });
    }),
});

const getAnalyticsStandardizedProperties = () => {
  let cached: Record<string, unknown> | null = null;

  const fallbackProperties = {
    $app_build: null,
    $app_name: null,
    $app_version: null,
    $bundle_id: null,
    $device_brand: null,
    $device_name: null,
    $locale: null,
    $platform: "unknown",
    $platform_version: null,
    $sdk: "react-native",
    $sdk_version: SDK_VERSION,
  } satisfies Record<string, unknown>;

  return () =>
    Effect.gen(function* () {
      if (cached) return cached;

      const platformProvider = yield* PlatformProvider;
      const props = {
        $app_build: platformProvider.appBuild ?? null,
        $app_name: platformProvider.appName ?? platformProvider.bundleId ?? null,
        $app_version: platformProvider.appVersion ?? null,
        $bundle_id: platformProvider.bundleId ?? null,
        $device_brand: platformProvider.deviceBrand ?? null,
        $device_name: platformProvider.deviceName ?? null,
        $locale: platformProvider.locales[0]?.languageTag ?? null,
        $platform: platformProvider.platform ?? "unknown",
        $platform_version: platformProvider.systemVersion ?? null,
        $sdk: "react-native",
        $sdk_version: SDK_VERSION,
      } satisfies Record<string, unknown>;

      if (!isRecord(props)) {
        cached = fallbackProperties;
        return fallbackProperties;
      }

      cached = props;
      return props;
    }).pipe(
      Effect.orElseSucceed(() => {
        cached = fallbackProperties;
        return fallbackProperties;
      })
    );
};

const mapQueuedAnalyticsEventToIngestEvent = (
  event: QueuedAnalyticsEvent,
  standardizedProperties: Record<string, unknown>,
  sessionId: string
) => ({
  context: {},
  event_id: event.id,
  event_name: event.eventName,
  event_ts: event.eventTimestamp,
  properties: {
    ...event.properties,
    ...standardizedProperties,
  },
  session_id: sessionId,
});

const makeInitializedClient = <TSchema extends VoidhashSchema>(options: {
  schema: TSchema;
}) => {
  const inFlightTransactionKeys = new Set<string>();

  // Analytics state
  const analyticsQueue: QueuedAnalyticsEvent[] = [];
  const analyticsSessionId = getNonce();
  let analyticsFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let triggerFlushCallback: (() => void) | null = null;
  const getStandardizedProperties = getAnalyticsStandardizedProperties();

  const clearFlushTimer = () => {
    if (analyticsFlushTimer) {
      clearTimeout(analyticsFlushTimer);
      analyticsFlushTimer = null;
    }
  };

  const scheduleFlushTimer = () => {
    if (analyticsFlushTimer || analyticsQueue.length === 0) return;
    analyticsFlushTimer = setTimeout(() => {
      analyticsFlushTimer = null;
      triggerFlushCallback?.();
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  };

  const sendAnalyticsEventsImpl = (events: ReadonlyArray<AnalyticsIngestEvent>) =>
    Effect.gen(function* () {
      if (events.length === 0) return;

      const identityManager = yield* IdentityManager;
      const sdkConfiguration = yield* SdkConfiguration;
      const appUserId = yield* identityManager.getAppUserId();
      const ingestEventsUrl = resolveIngestEventsUrl({
        baseUrl: sdkConfiguration.baseUrl,
        ingestUrl: sdkConfiguration.ingestUrl,
      });

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(ingestEventsUrl, {
            body: JSON.stringify({ events }),
            headers: {
              "content-type": "application/json",
              "x-app-user-id": appUserId,
              "x-publishable-key": sdkConfiguration.publishableKey,
            },
            method: "POST",
          }),
        catch: (cause) =>
          cause instanceof Error ? cause : new Error(String(cause)),
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new Error(
            `Analytics ingest request failed: ${response.status} ${response.statusText}`
          )
        );
      }
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential(ANALYTICS_RETRY_BASE_MS),
        times: 3,
      })
    );

  const processObservedTransaction = (transaction: Transaction) =>
    Effect.gen(function* processObservedTransaction() {
      const transactionProcessingKey =
        buildTransactionProcessingKey(transaction);
      if (inFlightTransactionKeys.has(transactionProcessingKey)) {
        return;
      }

      const cacheManager = yield* CacheManager;
      const processedTransactionCacheKey =
        getProcessedTransactionCacheKey(transactionProcessingKey);
      const cachedTransaction = yield* cacheManager.get<boolean>(
        processedTransactionCacheKey
      );
      if (
        cachedTransaction &&
        !cachedTransaction.isExpired &&
        cachedTransaction.value
      ) {
        return;
      }

      inFlightTransactionKeys.add(transactionProcessingKey);
      try {
        const apiClient = yield* ApiClient;
        const identityManager = yield* IdentityManager;
        const paymentAdapter = yield* PaymentAdapter;
        const sdkConfiguration = yield* SdkConfiguration;

        const commonHeaders = yield* getCommonSdkHeaders();
        const appUserId = yield* identityManager.getAppUserId();
        if (transaction.platform === "android" && !transaction.purchaseToken) {
          yield* Effect.logWarning(
            "Skipping observed Android transaction without purchase token",
            {
              transactionId: transaction.transactionId,
            }
          );
          return;
        }

        yield* apiClient.sdk.syncTransaction({
          headers: {
            ...commonHeaders,
            "x-app-user-id": appUserId,
          },
          payload: mapTransactionToSyncPayload(transaction),
        });

        yield* cacheManager.set(processedTransactionCacheKey, true, {
          ttl: PROCESSED_TRANSACTION_TTL_MS,
        });

        if (!sdkConfiguration.readOnly) {
          yield* paymentAdapter.acknowledgePurchase(transaction);
        }
      } finally {
        inFlightTransactionKeys.delete(transactionProcessingKey);
      }
    });

  const reconcileObservedTransactions = () =>
    Effect.gen(function* reconcileObservedTransactions() {
      const paymentAdapter = yield* PaymentAdapter;
      const [pendingTransactions, purchasedTransactions] = yield* Effect.all([
        paymentAdapter.getPendingTransactions(),
        paymentAdapter.getPurchaseHistory(true),
      ]);

      const observedTransactionsByKey = new Map<string, Transaction>();
      for (const transaction of [
        ...pendingTransactions,
        ...purchasedTransactions,
      ]) {
        observedTransactionsByKey.set(
          buildTransactionProcessingKey(transaction),
          transaction
        );
      }

      for (const transaction of observedTransactionsByKey.values()) {
        yield* processObservedTransaction(transaction).pipe(
          Effect.catchAll((error) =>
            Effect.logWarning("Failed to process observed transaction", {
              error,
              transactionId: transaction.transactionId,
            })
          )
        );
      }
    });

  return {
    end: () =>
      Effect.gen(function* end() {
        const paymentAdapter = yield* PaymentAdapter;
        return yield* paymentAdapter.endConnection();
      }),

    getFeatureFlags: (flagKeys?: string[]) =>
      Effect.gen(function* getFeatureFlags() {
        const cacheManager = yield* CacheManager;
        const apiClient = yield* ApiClient;
        const eventBus = yield* EventBusProvider;
        const identityManager = yield* IdentityManager;

        const cacheKey = `feature-flags:${flagKeys?.sort().join(",") ?? "all"}`;
        const cached = yield* cacheManager.get<{
          readonly flags: ReadonlyArray<{
            readonly enabled: boolean;
            readonly key: string;
            readonly payload: unknown | null;
            readonly variantKey: string | null;
          }>;
        }>(cacheKey);

        if (cached && !cached.isExpired && !cached.isStale) {
          return cached.value;
        }

        const commonHeaders = yield* getCommonSdkHeaders();
        const appUserId = yield* identityManager.getAppUserId();
        const result = yield* apiClient.sdk.evaluateFeatureFlags({
          headers: {
            ...commonHeaders,
            "x-app-user-id": appUserId,
          },
          payload: { flagKeys },
        });

        yield* cacheManager.set(cacheKey, result, {
          ttl: 1000 * 60 * 5, // 5 minutes
        });

        eventBus.emit("feature-flags-fetched", result);

        return result;
      }),

    getPaywallForLocation: (
      locationSlug: InferGetPaywallLocationInput<TSchema>
    ) =>
      Effect.gen(function* getPaywallForLocation() {
        const apiClient = yield* ApiClient;
        const identityManager = yield* IdentityManager;

        const commonHeaders = yield* getCommonSdkHeaders();
        const appUserId = yield* identityManager.getAppUserId();

        return yield* apiClient.sdk.resolvePaywall({
          headers: {
            ...commonHeaders,
            "x-app-user-id": appUserId,
          },
          payload: { locationSlug },
        });
      }),

    getCurrentCustomer: (forceFetch = false) =>
      Effect.gen(function* getCurrentCustomer() {
        const identityManager = yield* IdentityManager;
        const customerInfoManager = yield* CustomerInfoManager;

        const appUserId = yield* identityManager.getAppUserId();
        const customer = yield* customerInfoManager.getCustomer(
          appUserId,
          forceFetch ? "fetch" : "fetch-while-stale"
        );

        return customer;
      }),

    getProducts: () =>
      Effect.gen(function* getProducts() {
        const productDefinitions = extractProductDefinitions(options.schema);
        const nativeProducts = yield* loadProductsCached(productDefinitions);
        return mapNativeProductsToProductMap(productDefinitions, nativeProducts);
      }),

    identify: (
      appUserId: string,
      options: {
        email?: string;
        name?: string;
      }
    ) =>
      Effect.gen(function* identify() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.identify(appUserId, options);
      }),

    iosPresentCodeRedemptionSheet: () =>
      Effect.gen(function* iosPresentCodeRedemptionSheet() {
        const paymentAdapter = yield* PaymentAdapter;
        const { presentCodeRedemptionSheet } = paymentAdapter;
        if (!presentCodeRedemptionSheet) {
          return yield* Effect.fail(
            new UnsupportedPlatformError(
              "Present code redemption sheet is not supported on this platform"
            )
          );
        }
        return yield* presentCodeRedemptionSheet();
      }),

    iosShowManageSubscriptions: () =>
      Effect.gen(function* iosShowManageSubscriptions() {
        const paymentAdapter = yield* PaymentAdapter;
        const { showManageSubscriptions } = paymentAdapter;
        if (!showManageSubscriptions) {
          return yield* Effect.fail(
            new UnsupportedPlatformError(
              "Show manage subscriptions is not supported on this platform"
            )
          );
        }
        return yield* showManageSubscriptions();
      }),

    processObservedTransaction,

    purchase: <TSchemaOverload extends VoidhashSchema>(
      product: NonNullable<
        InferGetProductResponseFromSchema<TSchemaOverload>[keyof InferGetProductResponseFromSchema<TSchemaOverload>]
      >,
      _options: {
        method?: "native";
      }
    ) =>
      Effect.gen(function* purchase() {
        const paymentAdapter = yield* PaymentAdapter;
        const transaction = yield* paymentAdapter.buyProduct(product);
        yield* processObservedTransaction(transaction);
      }),

    restorePurchases: () =>
      Effect.gen(function* restorePurchases() {
        const customerInfoManager = yield* CustomerInfoManager;
        const identityManager = yield* IdentityManager;

        yield* reconcileObservedTransactions();

        const appUserId = yield* identityManager.getAppUserId();
        yield* customerInfoManager.getCustomer(appUserId, "fetch");
      }),

    reconcileObservedTransactions: () => reconcileObservedTransactions(),

    getAnalyticsStandardizedProperties: () => getStandardizedProperties(),

    capture: (eventName: string, properties: Record<string, unknown> = {}) =>
      Effect.sync(() => {
        const normalized = eventName.trim();
        if (!normalized) return;
        analyticsQueue.push({
          eventName: normalized,
          eventTimestamp: new Date().toISOString(),
          id: getNonce(),
          properties,
        });
        if (analyticsQueue.length >= ANALYTICS_BATCH_SIZE) {
          clearFlushTimer();
          triggerFlushCallback?.();
          return;
        }
        scheduleFlushTimer();
      }),

    flush: () =>
      Effect.gen(function* () {
        clearFlushTimer();
        if (analyticsQueue.length === 0) return;

        const standardizedProperties = yield* getStandardizedProperties();

        while (analyticsQueue.length > 0) {
          const queuedBatch = analyticsQueue.splice(0, ANALYTICS_BATCH_SIZE);
          const ingestBatch = queuedBatch.map((event) =>
            mapQueuedAnalyticsEventToIngestEvent(event, standardizedProperties, analyticsSessionId)
          );

          const sendResult = yield* Effect.either(sendAnalyticsEventsImpl(ingestBatch));
          if (sendResult._tag === "Left") {
            analyticsQueue.unshift(...queuedBatch);
            yield* Effect.fail(sendResult.left);
          }
        }
      }),

    getAnalyticsQueueLength: () => analyticsQueue.length,

    setAnalyticsFlushCallback: (callback: () => void) => {
      triggerFlushCallback = callback;
    },

    stopAnalyticsFlushTimer: () =>
      Effect.sync(() => {
        clearFlushTimer();
      }),

    transferAnalyticsEvents: (events: ReadonlyArray<{ eventName: string; properties: Record<string, unknown> }>) =>
      Effect.sync(() => {
        for (const event of events) {
          const normalized = event.eventName.trim();
          if (!normalized) continue;
          analyticsQueue.push({
            eventName: normalized,
            eventTimestamp: new Date().toISOString(),
            id: getNonce(),
            properties: event.properties,
          });
        }
      }),

    captureAutomaticStartupEvents: () =>
      Effect.gen(function* () {
        try {
          const standardizedProps = yield* getStandardizedProperties();
          const currentAppRelease: AppReleaseInfo = {
            appBuild: toNullableString(standardizedProps.$app_build),
            appVersion: toNullableString(standardizedProps.$app_version),
          };

          const cacheManager = yield* CacheManager;
          const cachedRelease = yield* cacheManager.get<AppReleaseInfo>(
            ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY
          );
          const previousAppRelease = toAppReleaseInfo(cachedRelease?.value);

          if (!previousAppRelease) {
            analyticsQueue.push({
              eventName: "app_installed",
              eventTimestamp: new Date().toISOString(),
              id: getNonce(),
              properties: {},
            });
          } else if (
            previousAppRelease.appBuild !== currentAppRelease.appBuild ||
            previousAppRelease.appVersion !== currentAppRelease.appVersion
          ) {
            analyticsQueue.push({
              eventName: "app_updated",
              eventTimestamp: new Date().toISOString(),
              id: getNonce(),
              properties: {},
            });
          }

          analyticsQueue.push({
            eventName: "app_opened",
            eventTimestamp: new Date().toISOString(),
            id: getNonce(),
            properties: {},
          });

          yield* cacheManager.set(
            ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY,
            currentAppRelease
          );
        } catch {
          analyticsQueue.push({
            eventName: "app_opened",
            eventTimestamp: new Date().toISOString(),
            id: getNonce(),
            properties: {},
          });
        }
      }),

    setupAutomaticLifecycleEvents: (captureEvent: (eventName: string) => void) =>
      Effect.sync(() => {
        const appState = getReactNativeAppState();
        if (!appState || typeof appState.addEventListener !== "function") {
          return null;
        }

        let lifecycleState: AppLifecycleState | null = appState.currentState ?? null;

        const subscription = appState.addEventListener("change", (nextAppState) => {
          const previousAppState = lifecycleState;
          lifecycleState = nextAppState;

          if (nextAppState === "background" && previousAppState !== "background") {
            captureEvent("app_backgrounded");
            return;
          }

          if (
            nextAppState === "active" &&
            previousAppState !== null &&
            previousAppState !== "active"
          ) {
            captureEvent("app_became_active");
          }
        });

        return subscription;
      }),

    sendAnalyticsEvents: (events: ReadonlyArray<AnalyticsIngestEvent>) =>
      sendAnalyticsEventsImpl(events),

    signOut: () =>
      Effect.gen(function* signOut() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.signOut();
      }),

    startTransactionObserver: (
      onPurchase?: (transaction: Transaction) => void
    ) =>
      Effect.gen(function* startTransactionObserver() {
        const paymentAdapter = yield* PaymentAdapter;
        return yield* paymentAdapter.initConnection(onPurchase);
      }),
  };
};

const loadProductsCached = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>
) =>
  Effect.gen(function* loadProductsCached() {
    const cacheManager = yield* CacheManager;
    const paymentAdapter = yield* PaymentAdapter;

    const cacheKey = generateCacheKeyFromProductDefinitions(productDefinitions);

    const cachedProducts = yield* cacheManager.get<Product[]>(cacheKey);

    if (
      cachedProducts &&
      !(cachedProducts.isStale || cachedProducts.isExpired)
    ) {
      yield* Effect.logDebug("Products fetched from cache", {
        products: cachedProducts.value,
      });
      return cachedProducts.value;
    }

    const nativeProducts =
      yield* paymentAdapter.getProducts(productDefinitions);

    yield* Effect.logDebug("Products fetched from native adapter", {
      products: nativeProducts,
    });

    // Store products in cache
    yield* cacheManager.set(cacheKey, nativeProducts, {
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });

    return nativeProducts;
  });

const mapNativeProductsToProductMap = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>,
  nativeProducts: Product[]
) => {
  const productMap: InferGetProductResponseFromSchema<TSchema> =
    {} as InferGetProductResponseFromSchema<TSchema>;

  for (const productDefinitionKey of Object.keys(productDefinitions)) {
    const productDefinition =
      productDefinitions[
        productDefinitionKey as ExtractSchemaProductKeys<TSchema>
      ];
    const nativeProduct = nativeProducts.find(
      (nativeProduct) => nativeProduct.slug === productDefinition.slug
    );

    if (nativeProduct) {
      productMap[productDefinitionKey as ExtractSchemaProductKeys<TSchema>] =
        nativeProduct as InferGetProductResponseFromSchema<TSchema>[ExtractSchemaProductKeys<TSchema>];
      continue;
    }

    productMap[productDefinitionKey as ExtractSchemaProductKeys<TSchema>] =
      null as InferGetProductResponseFromSchema<TSchema>[ExtractSchemaProductKeys<TSchema>];
  }

  return productMap;
};

const buildTransactionProcessingKey = (transaction: Transaction) =>
  `${transaction.platform}:${transaction.transactionId}:${transaction.purchaseDate}`;

const getProcessedTransactionCacheKey = (transactionProcessingKey: string) =>
  `processed-transaction:${transactionProcessingKey}`;

const mapTransactionToSyncPayload = (transaction: Transaction) => {
  if (transaction.platform === "ios") {
    return {
      platform: "ios" as const,
      productId: transaction.productId,
      purchaseDate: transaction.purchaseDate,
      quantity: transaction.quantity,
      receipt: transaction.receipt,
      transactionId: transaction.transactionId,
    };
  }

  return {
    platform: "android" as const,
    productId: transaction.productId,
    purchaseDate: transaction.purchaseDate,
    purchaseToken: transaction.purchaseToken ?? "",
    quantity: transaction.quantity,
    receipt: transaction.receipt,
    transactionId: transaction.transactionId,
  };
};

const generateCacheKeyFromProductDefinitions = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>
) => `native-products:${JSON.stringify(productDefinitions)}`;

const resolveIngestEventsUrl = (options: {
  baseUrl: string;
  ingestUrl: string | undefined;
}) => {
  const baseUrl = options.ingestUrl
    ? new URL(options.ingestUrl)
    : buildDefaultIngestBaseUrl(options.baseUrl);
  return new URL("/v1/events", baseUrl).toString();
};

const buildDefaultIngestBaseUrl = (apiBaseUrl: string) => {
  const parsedApiUrl = new URL(apiBaseUrl);
  parsedApiUrl.hostname = `i.${parsedApiUrl.hostname}`;
  parsedApiUrl.hash = "";
  parsedApiUrl.pathname = "/";
  parsedApiUrl.search = "";
  return parsedApiUrl;
};

export const VoidhashEffectClient = {
  makeInitializedClient,
  makeUnitializedClient,
} as const;
