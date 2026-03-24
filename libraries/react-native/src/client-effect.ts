import type {
  CaptureAcceptedResponse,
  CaptureErrorResponse,
} from "@voidhash/api-spec/event-capture";
import { Cause, Effect } from "effect";

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
import { AnalyticsIngestEvent, AnalyticsSendFailure, QueuedAnalyticsEvent } from "./core/analytics/types";
import { createQueuedAnalyticsEvent, getAnalyticsStandardizedProperties, mapQueuedAnalyticsEventToIngestEvent } from "./core/analytics/utils";
import { getNonce } from "./core/utils/crypto";

const PROCESSED_TRANSACTION_TTL_MS = 1000 * 60 * 30;
const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;
const MAX_ANALYTICS_RETRY_DELAY_MS = 30_000;
const RETRYABLE_ANALYTICS_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);




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

const toNullableString = (value: unknown): string | null =>
  value !== null && value !== undefined ? String(value) : null;

const toAppReleaseInfo = (value: AppReleaseInfo | undefined | null): AppReleaseInfo | null => {
  if (!value) return null;
  return {
    appBuild: value.appBuild,
    appVersion: value.appVersion,
  };
};



const getAnalyticsRetryDelayMs = (attempts: number) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_ANALYTICS_RETRY_DELAY_MS);

const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const retryAfterSeconds = Number(value);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(retryAt - Date.now(), 0);
};

const getRetryAfterMsFromResponseBody = (
  data: CaptureAcceptedResponse | CaptureErrorResponse | undefined,
): number | undefined =>
  data && "retry_after_ms" in data && typeof data.retry_after_ms === "number"
    ? data.retry_after_ms
    : undefined;

const makeUnitializedClient = () => ({
  init: <TSchema extends VoidhashSchema>(initOptions: {
    distinctId?: string;
    schema: TSchema;
  }) =>
    Effect.gen(function* init() {
      const identityManager = yield* IdentityManager;
      const customerAttributeManager = yield* CustomerAttributeManager;
      const customerInfoManager = yield* CustomerInfoManager;

      if (initOptions.distinctId) {
        // Identify as the distinct id provided during SDK initialization.
        yield* Effect.logDebug("Initializing with provided distinct id", {
          distinctId: initOptions.distinctId,
        });

        // Sync customer attributes before identify to not lose historical customer data
        const distinctId = yield* identityManager.getDistinctIdFromCache();
        if (distinctId) {
          yield* customerAttributeManager.syncCustomerAttributes(distinctId);
        }

        yield* identityManager.identify(initOptions.distinctId, {});
      } else {
        // If no distinct id was passed during SDK initialization, fetch the current customer in the background.
        const distinctId = yield* identityManager.getDistinctId();
        yield* Effect.logDebug("Initializing without provided distinct id", {
          distinctId,
        });

        yield* customerAttributeManager.syncCustomerAttributes(distinctId);

        // We don't need the result immediately. We do this to pre-fetch fresh customer data in the background.
        yield* customerInfoManager.getCustomer(distinctId, "fetch");
      }

      // Return the initialized client
      return makeInitializedClient<TSchema>({
        schema: initOptions.schema,
      });
    }),
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

  const getNextAnalyticsFlushDelayMs = () => {
    if (analyticsQueue.length === 0) {
      return null;
    }

    const now = Date.now();
    const hasDueEvents = analyticsQueue.some((event) => event.availableAt <= now);
    if (hasDueEvents) {
      return ANALYTICS_FLUSH_INTERVAL_MS;
    }

    const nextAvailableAt = Math.min(...analyticsQueue.map((event) => event.availableAt));
    return Math.max(nextAvailableAt - now, 0);
  };

  const scheduleFlushTimer = () => {
    if (analyticsFlushTimer || analyticsQueue.length === 0) return;
    const delayMs = getNextAnalyticsFlushDelayMs();
    if (delayMs === null) {
      return;
    }

    analyticsFlushTimer = setTimeout(() => {
      analyticsFlushTimer = null;
      triggerFlushCallback?.();
    }, delayMs);
  };

  const sendAnalyticsEventsImpl = (events: ReadonlyArray<AnalyticsIngestEvent>) =>
    Effect.gen(function* () {
      if (events.length === 0) return;

      const identityManager = yield* IdentityManager;
      const sdkConfiguration = yield* SdkConfiguration;
      const distinctId = yield* identityManager.getDistinctId();
      const ingestEventsUrl = resolveIngestEventsUrl({
        baseUrl: sdkConfiguration.baseUrl,
        ingestUrl: sdkConfiguration.ingestUrl,
      });

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(ingestEventsUrl, {
            body: JSON.stringify({
              events: events.map((event) => ({
                context: event.context,
                distinct_id: distinctId,
                event: event.event_name,
                properties: event.properties,
                request: {
                  sdk_name: "react-native",
                  sdk_version: SDK_VERSION,
                },
                session_id: event.session_id,
                timestamp: event.event_ts,
                uuid: event.event_id,
              })),
              sent_at: new Date().toISOString(),
              token: sdkConfiguration.publishableKey,
            }),
            headers: {
              "content-type": "application/json",
            },
            method: "POST",
          }),
        catch: (cause) =>
          new AnalyticsSendFailure({
            cause,
            message: "Analytics request failed",
            retryable: true,
          }),
      });

      const data = (yield* Effect.tryPromise({
        try: () => response.json() as Promise<CaptureAcceptedResponse | CaptureErrorResponse>,
        catch: (cause) => cause,
      }).pipe(
        Effect.orElseSucceed(() => undefined),
      )) as CaptureAcceptedResponse | CaptureErrorResponse | undefined;

      if (response.status === 202) {
        return;
      }

      if (response.status === 413) {
        return yield* Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${response.status} ${response.statusText}`,
            retryable: false,
            status: response.status,
          })
        );
      }

      if (RETRYABLE_ANALYTICS_STATUS_CODES.has(response.status)) {
        return yield* Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${response.status} ${response.statusText}`,
            retryAfterMs:
              parseRetryAfterMs(response.headers.get("retry-after")) ??
              getRetryAfterMsFromResponseBody(data),
            retryable: true,
            status: response.status,
          })
        );
      }

      if (!response.ok) {
        return yield* Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${response.status} ${response.statusText}`,
            retryable: false,
            status: response.status,
          })
        );
      }
    });

  const buildQueuedAnalyticsBatchIds = (events: ReadonlyArray<QueuedAnalyticsEvent>) =>
    new Set(events.map((event) => event.id));

  const dropQueuedAnalyticsBatch = (events: ReadonlyArray<QueuedAnalyticsEvent>) => {
    const ids = buildQueuedAnalyticsBatchIds(events);
    for (let index = analyticsQueue.length - 1; index >= 0; index -= 1) {
      if (ids.has(analyticsQueue[index]!.id)) {
        analyticsQueue.splice(index, 1);
      }
    }
  };

  const postponeQueuedAnalyticsBatch = (
    events: ReadonlyArray<QueuedAnalyticsEvent>,
    nextAvailableAt: number,
  ) => {
    const ids = buildQueuedAnalyticsBatchIds(events);
    for (let index = 0; index < analyticsQueue.length; index += 1) {
      const queuedEvent = analyticsQueue[index]!;
      if (!ids.has(queuedEvent.id)) {
        continue;
      }

      analyticsQueue[index] = {
        ...queuedEvent,
        attempts: queuedEvent.attempts + 1,
        availableAt: nextAvailableAt,
      };
    }
  };

  const getDueQueuedAnalyticsBatch = () => {
    const now = Date.now();
    const queuedBatch: QueuedAnalyticsEvent[] = [];

    for (const event of analyticsQueue) {
      if (event.availableAt > now) {
        break;
      }

      queuedBatch.push(event);
      if (queuedBatch.length >= ANALYTICS_BATCH_SIZE) {
        break;
      }
    }

    return queuedBatch;
  };

  const processQueuedAnalyticsBatch = (
    queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
    standardizedProperties: Record<string, unknown>,
  ): Effect.Effect<void, AnalyticsSendFailure, IdentityManager | SdkConfiguration> =>
    Effect.gen(function* () {
      const ingestBatch = queuedBatch.map((event) =>
        mapQueuedAnalyticsEventToIngestEvent(event, standardizedProperties, analyticsSessionId),
      );

      const sendResult = yield* Effect.exit(sendAnalyticsEventsImpl(ingestBatch));
      if (sendResult._tag === "Success") {
        dropQueuedAnalyticsBatch(queuedBatch);
        return;
      }

      const failure = Cause.squash(sendResult.cause);
      if (!(failure instanceof AnalyticsSendFailure)) {
        return yield* Effect.fail(
          new AnalyticsSendFailure({
            cause: failure,
            message: failure instanceof Error ? failure.message : String(failure),
            retryable: false,
          }),
        );
      }

      if (failure.status === 413 && queuedBatch.length > 1) {
        const midpoint = Math.ceil(queuedBatch.length / 2);
        yield* processQueuedAnalyticsBatch(queuedBatch.slice(0, midpoint), standardizedProperties);
        yield* processQueuedAnalyticsBatch(queuedBatch.slice(midpoint), standardizedProperties);
        return;
      }

      if (failure.status === 413 && queuedBatch.length === 1) {
        dropQueuedAnalyticsBatch(queuedBatch);
        yield* Effect.logWarning("Dropping analytics event after 413 response", {
          eventId: queuedBatch[0]?.id,
        });
        return;
      }

      if (!failure.retryable) {
        dropQueuedAnalyticsBatch(queuedBatch);
        yield* Effect.logWarning("Dropping analytics batch after non-retryable response", {
          eventIds: queuedBatch.map((event) => event.id),
          status: failure.status,
        });
        return;
      }

      return yield* Effect.fail(failure);
    });

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
        const distinctId = yield* identityManager.getDistinctId();
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
            "x-distinct-id": distinctId,
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
          Effect.catch((error) =>
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
        const distinctId = yield* identityManager.getDistinctId();
        const result = yield* apiClient.sdk.evaluateFeatureFlags({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
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
        const distinctId = yield* identityManager.getDistinctId();

        return yield* apiClient.sdk.resolvePaywall({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
          },
          payload: { locationSlug },
        });
      }),

    getCurrentCustomer: (forceFetch = false) =>
      Effect.gen(function* getCurrentCustomer() {
        const identityManager = yield* IdentityManager;
        const customerInfoManager = yield* CustomerInfoManager;

        const distinctId = yield* identityManager.getDistinctId();
        const customer = yield* customerInfoManager.getCustomer(
          distinctId,
          forceFetch ? "fetch" : "fetch-while-stale"
        );

        return customer;
      }),

    getDistinctId: () =>
      Effect.gen(function* getDistinctId() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.getDistinctId();
      }),

    getProducts: () =>
      Effect.gen(function* getProducts() {
        const productDefinitions = extractProductDefinitions(options.schema);
        const nativeProducts = yield* loadProductsCached(productDefinitions);
        return mapNativeProductsToProductMap(productDefinitions, nativeProducts);
      }),

    identify: (
      distinctId: string,
      options: {
        email?: string;
        name?: string;
      }
    ) =>
      Effect.gen(function* identify() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.identify(distinctId, options);
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

        const distinctId = yield* identityManager.getDistinctId();
        yield* customerInfoManager.getCustomer(distinctId, "fetch");
      }),

    reconcileObservedTransactions: () => reconcileObservedTransactions(),

    getAnalyticsStandardizedProperties: () => getStandardizedProperties(),

    capture: (eventName: string, properties: Record<string, unknown> = {}) =>
      Effect.sync(() => {
        const normalized = eventName.trim();
        if (!normalized) return;
        analyticsQueue.push(createQueuedAnalyticsEvent(normalized, properties));
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
          const queuedBatch = getDueQueuedAnalyticsBatch();
          if (queuedBatch.length === 0) {
            scheduleFlushTimer();
            return;
          }

          const sendResult = yield* Effect.exit(
            processQueuedAnalyticsBatch(queuedBatch, standardizedProperties),
          );
          if (sendResult._tag === "Failure") {
            const failure = Cause.squash(sendResult.cause);
            if (failure instanceof AnalyticsSendFailure && failure.retryable) {
              postponeQueuedAnalyticsBatch(
                queuedBatch,
                Date.now() +
                  (failure.retryAfterMs ??
                    getAnalyticsRetryDelayMs((queuedBatch[0]?.attempts ?? 0) + 1)),
              );
              scheduleFlushTimer();
              return;
            }

            yield* Effect.failCause(sendResult.cause);
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
          analyticsQueue.push(createQueuedAnalyticsEvent(normalized, event.properties));
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
            analyticsQueue.push(createQueuedAnalyticsEvent("app_installed", {}));
          } else if (
            previousAppRelease.appBuild !== currentAppRelease.appBuild ||
            previousAppRelease.appVersion !== currentAppRelease.appVersion
          ) {
            analyticsQueue.push(createQueuedAnalyticsEvent("app_updated", {}));
          }

          analyticsQueue.push(createQueuedAnalyticsEvent("app_opened", {}));

          yield* cacheManager.set(
            ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY,
            currentAppRelease
          );
        } catch {
          analyticsQueue.push(createQueuedAnalyticsEvent("app_opened", {}));
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

    reset: () =>
      Effect.gen(function* reset() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.reset();
      }),

    signOut: () =>
      Effect.gen(function* signOut() {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.reset();
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
  return new URL("/batch", baseUrl).toString();
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
