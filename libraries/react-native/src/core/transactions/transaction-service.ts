import { Effect, Layer, Context } from "effect";

import { CacheManager } from "../caching/cache-manager";
import type { SubscriptionProduct } from "../entities/product";
import type { Transaction } from "../entities/transaction";
import { CustomerInfoManager } from "../identity/customer-info-manager";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type {
  RuntimeProductDefinition,
  RuntimeSchema,
} from "../schema/runtime";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

const PROCESSED_TRANSACTION_TTL_MS = 1000 * 60 * 30;

const buildTransactionProcessingKey = (transaction: Transaction) =>
  `${transaction.platform}:${transaction.transactionId}:${transaction.purchaseDate}`;

const getProcessedTransactionCacheKey = (transactionProcessingKey: string) =>
  `processed-transaction:${transactionProcessingKey}`;

const resolveTransactionProductSlug = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>
) => {
  const matchedProduct = Object.values(productDefinitions).find(
    (productDefinition) => {
      if (productDefinition.slug === transaction.productId) {
        return true;
      }

      const provider =
        transaction.platform === "ios"
          ? productDefinition.configuration.providers.appleAppStore
          : productDefinition.configuration.providers.googlePlay;

      return provider?.productId === transaction.productId;
    }
  );

  return matchedProduct?.slug ?? transaction.productId;
};

const mapTransactionToSyncPayload = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>
) => {
  const productSlug = resolveTransactionProductSlug(
    transaction,
    productDefinitions
  );

  if (transaction.platform === "ios") {
    return {
      platform: "ios" as const,
      productSlug,
      purchaseDate: transaction.purchaseDate,
      quantity: transaction.quantity,
      receipt: transaction.receipt,
      transactionId: transaction.transactionId,
    };
  }

  return {
    platform: "android" as const,
    productSlug,
    purchaseDate: transaction.purchaseDate,
    purchaseToken: transaction.purchaseToken ?? "",
    quantity: transaction.quantity,
    receipt: transaction.receipt,
    transactionId: transaction.transactionId,
  };
};

/**
 * Owns the transaction lifecycle: deduplicated server-side sync, observation
 * reconciliation, purchase orchestration, restore-purchases, and the native
 * transaction observer. Holds an in-memory `inFlightKeys` set per runtime to
 * coalesce concurrent sync attempts for the same transaction (the cache TTL
 * catches duplicate attempts across runtime restarts).
 */
export class TransactionService extends Context.Service<TransactionService>()(
  "rn-voidhash/TransactionService",
  {
    make: Effect.gen(function* () {
      const apiClient = yield* ApiClient;
      const cacheManager = yield* CacheManager;
      const customerInfoManager = yield* CustomerInfoManager;
      const identityManager = yield* IdentityManager;
      const paymentAdapter = yield* PaymentAdapter;
      const sdkConfiguration = yield* SdkConfiguration;

      const inFlightKeys = new Set<string>();

      const processObservedTransaction = (
        transaction: Transaction,
        schema: RuntimeSchema
      ) =>
        Effect.gen(function* () {
          const transactionProcessingKey =
            buildTransactionProcessingKey(transaction);
          if (inFlightKeys.has(transactionProcessingKey)) {
            return;
          }

          const processedCacheKey = getProcessedTransactionCacheKey(
            transactionProcessingKey
          );
          const cachedTransaction =
            yield* cacheManager.get<boolean>(processedCacheKey);
          if (
            cachedTransaction &&
            !cachedTransaction.isExpired &&
            cachedTransaction.value
          ) {
            return;
          }

          if (transaction.platform === "android" && !transaction.purchaseToken) {
            yield* Effect.logWarning(
              "Skipping observed Android transaction without purchase token",
              {
                transactionId: transaction.transactionId,
              }
            );
            return;
          }

          inFlightKeys.add(transactionProcessingKey);
          try {
            const commonHeaders = yield* getCommonSdkHeaders();
            const distinctId = yield* identityManager.getDistinctId();

            yield* apiClient.sdk.syncTransaction({
              headers: {
                ...commonHeaders,
                "x-distinct-id": distinctId,
              },
              payload: mapTransactionToSyncPayload(
                transaction,
                schema.products
              ),
            });

            yield* cacheManager.set(processedCacheKey, true, {
              ttl: PROCESSED_TRANSACTION_TTL_MS,
            });

            if (!sdkConfiguration.readOnly) {
              yield* paymentAdapter.acknowledgePurchase(transaction);
            }
          } finally {
            inFlightKeys.delete(transactionProcessingKey);
          }
        });

      const reconcileObservedTransactions = (schema: RuntimeSchema) =>
        Effect.gen(function* () {
          const [pendingTransactions, purchasedTransactions] = yield* Effect.all(
            [
              paymentAdapter.getPendingTransactions(),
              paymentAdapter.getPurchaseHistory(true),
            ]
          );

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
            yield* processObservedTransaction(transaction, schema).pipe(
              Effect.catch((error) =>
                Effect.logWarning("Failed to process observed transaction", {
                  error,
                  transactionId: transaction.transactionId,
                })
              )
            );
          }
        });

      const purchase = (product: SubscriptionProduct, schema: RuntimeSchema) =>
        Effect.gen(function* () {
          const transaction = yield* paymentAdapter.buyProduct(product);
          yield* processObservedTransaction(transaction, schema);
        });

      const restorePurchases = (schema: RuntimeSchema) =>
        Effect.gen(function* () {
          yield* reconcileObservedTransactions(schema);
          const distinctId = yield* identityManager.getDistinctId();
          yield* customerInfoManager.getCustomer(distinctId, "fetch");
        });

      const startTransactionObserver = (
        onPurchase?: (transaction: Transaction) => void
      ) => paymentAdapter.initConnection(onPurchase);

      const endConnection = () => paymentAdapter.endConnection();

      return {
        endConnection,
        processObservedTransaction,
        purchase,
        reconcileObservedTransactions,
        restorePurchases,
        startTransactionObserver,
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
