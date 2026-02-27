import { Effect } from "effect";

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
  ExtractSchemaPaywallLocationSlugs,
  ExtractSchemaProductDefinitions,
  ExtractSchemaProductKeys,
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "./core/schema";
import { extractProductDefinitions } from "./core/schema/utils";
import { SdkConfiguration } from "./core/sdk-configuration";
import { getCommonSdkHeaders } from "./core/utils/get-common-sdk-headers";
import { UnsupportedPlatformError } from "./errors";

type InferGetPaywallLocationInput<TSchema extends VoidhashSchema> =
  [ExtractSchemaPaywallLocationSlugs<TSchema>] extends [never]
    ? string
    : ExtractSchemaPaywallLocationSlugs<TSchema>;

const PROCESSED_TRANSACTION_TTL_MS = 1000 * 60 * 30;

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

const makeInitializedClient = <TSchema extends VoidhashSchema>(options: {
  schema: TSchema;
}) => {
  const inFlightTransactionKeys = new Set<string>();

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

export const VoidhashEffectClient = {
  makeInitializedClient,
  makeUnitializedClient,
} as const;
