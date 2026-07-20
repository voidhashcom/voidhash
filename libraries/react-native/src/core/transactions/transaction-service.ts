import { Cause, Context, Deferred, Effect, Exit, Layer } from "effect";

import type { Product } from "../entities/product";
import type { Transaction } from "../entities/transaction";
import { PersonInfoManager } from "../identity/person-info-manager";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type { RuntimeProductDefinition, RuntimeSchema } from "../schema/runtime";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { deriveAccountToken } from "../utils/account-token";
import { ReconcileTransactionsError } from "./errors";

const buildTransactionProcessingKey = (transaction: Transaction) =>
  `${transaction.platform}:${transaction.transactionId}:${transaction.purchaseDate}`;

const resolveTransactionProductSlug = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) => {
  const matchedProduct = Object.values(productDefinitions).find((productDefinition) => {
    if (productDefinition.slug === transaction.productId) {
      return true;
    }

    const provider =
      transaction.platform === "ios"
        ? productDefinition.configuration.providers.appleAppStore
        : productDefinition.configuration.providers.googlePlay;

    return provider?.productId === transaction.productId;
  });

  return matchedProduct?.slug ?? transaction.productId;
};

const resolveTransactionProductDefinition = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) =>
  Object.values(productDefinitions).find((productDefinition) => {
    if (productDefinition.slug === transaction.productId) {
      return true;
    }
    const provider =
      transaction.platform === "ios"
        ? productDefinition.configuration.providers.appleAppStore
        : productDefinition.configuration.providers.googlePlay;
    return provider?.productId === transaction.productId;
  });

const mapTransactionToSyncPayload = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) => {
  const productSlug = resolveTransactionProductSlug(transaction, productDefinitions);

  if (transaction.platform === "ios") {
    return {
      appAccountToken: transaction.appAccountToken,
      platform: "ios" as const,
      providerProductId: transaction.productId,
      productSlug,
      purchaseDate: transaction.purchaseDate,
      quantity: transaction.quantity,
      receipt: transaction.receipt,
      transactionId: transaction.transactionId,
    };
  }

  return {
    appAccountToken: transaction.appAccountToken,
    platform: "android" as const,
    providerProductId: transaction.productId,
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
 * transaction observer. Concurrent work is coalesced per runtime while the
 * native measurement store remains the durable deduplication authority.
 */
export class TransactionService extends Context.Service<TransactionService>()(
  "rn-voidhash/TransactionService",
  {
    make: Effect.gen(function* () {
      const apiClient = yield* ApiClient;
      const personInfoManager = yield* PersonInfoManager;
      const identityManager = yield* IdentityManager;
      const paymentAdapter = yield* PaymentAdapter;
      const sdkConfiguration = yield* SdkConfiguration;

      const inFlightTransactions = new Map<string, Deferred.Deferred<void, unknown>>();

      const refreshPerson = Effect.gen(function* () {
        const distinctId = yield* identityManager.getDistinctId();
        yield* personInfoManager.getPerson(distinctId, "fetch");
      });

      const processTransaction = (transaction: Transaction, schema: RuntimeSchema) =>
        Effect.suspend(() => {
          if (transaction.purchaseState !== "purchased") {
            return Effect.logDebug("Skipping transaction that is not purchased", {
              purchaseState: transaction.purchaseState,
              transactionId: transaction.transactionId,
            });
          }

          const transactionProcessingKey = buildTransactionProcessingKey(transaction);
          const existing = inFlightTransactions.get(transactionProcessingKey);
          if (existing) {
            return Deferred.await(existing);
          }

          const deferred = Deferred.makeUnsafe<void, unknown>();
          inFlightTransactions.set(transactionProcessingKey, deferred);

          const execution = Effect.gen(function* () {
            const finalized = yield* Effect.promise(() =>
              sdkConfiguration.measurementRuntime.hasDurableDedupe(
                "transaction-finalized",
                transactionProcessingKey,
              ),
            );
            if (finalized) {
              return;
            }

            if (transaction.platform === "android" && !transaction.purchaseToken) {
              yield* Effect.logWarning(
                "Skipping observed Android transaction without purchase token",
                {
                  transactionId: transaction.transactionId,
                },
              );
              return;
            }

            yield* Effect.promise(() =>
              sdkConfiguration.measurementRuntime.recordObservedPurchase(transaction),
            );

            const backendAccepted = yield* Effect.promise(() =>
              sdkConfiguration.measurementRuntime.hasDurableDedupe(
                "transaction-backend-accepted",
                transactionProcessingKey,
              ),
            );
            if (!backendAccepted) {
              const commonHeaders = yield* getCommonSdkHeaders();
              const distinctId = yield* identityManager.getDistinctId();

              yield* apiClient.sdk.syncTransaction({
                headers: {
                  ...commonHeaders,
                  "x-distinct-id": distinctId,
                },
                payload: mapTransactionToSyncPayload(transaction, schema.products),
              });

              yield* Effect.promise(() =>
                sdkConfiguration.measurementRuntime.checkAndSetDurableDedupe(
                  "transaction-backend-accepted",
                  transactionProcessingKey,
                ),
              );
            }

            if (sdkConfiguration.readOnly) {
              yield* Effect.promise(() =>
                sdkConfiguration.measurementRuntime.checkAndSetDurableDedupe(
                  "transaction-finalized",
                  transactionProcessingKey,
                ),
              );
              return;
            }

            if (!transaction.isAcknowledged) {
              yield* paymentAdapter.acknowledgePurchase(
                transaction,
                resolveTransactionProductDefinition(transaction, schema.products)?.type,
              );
            }

            yield* Effect.promise(() =>
              sdkConfiguration.measurementRuntime.checkAndSetDurableDedupe(
                "transaction-finalized",
                transactionProcessingKey,
              ),
            );
          });

          return Effect.exit(execution).pipe(
            Effect.tap((exit) => Deferred.done(deferred, exit)),
            Effect.flatMap((exit) =>
              Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
            ),
            Effect.ensuring(
              Effect.sync(() => {
                inFlightTransactions.delete(transactionProcessingKey);
              }),
            ),
          );
        });

      const reconcileObservedTransactions = (schema: RuntimeSchema) =>
        Effect.gen(function* () {
          const [pendingTransactions, purchasedTransactions] = yield* Effect.all([
            paymentAdapter.getPendingTransactions(),
            paymentAdapter.getPurchaseHistory(true),
          ]);

          const observedTransactionsByKey = new Map<string, Transaction>();
          for (const transaction of [...pendingTransactions, ...purchasedTransactions]) {
            observedTransactionsByKey.set(buildTransactionProcessingKey(transaction), transaction);
          }

          const failures = [];
          for (const transaction of observedTransactionsByKey.values()) {
            if (
              resolveTransactionProductDefinition(transaction, schema.products)?.type ===
              "one-time-consumable"
            ) {
              continue;
            }
            const exit = yield* Effect.exit(processTransaction(transaction, schema));
            if (Exit.isFailure(exit)) {
              const error = Cause.squash(exit.cause);
              failures.push({ error, transactionId: transaction.transactionId });
              yield* Effect.logWarning("Failed to process observed transaction", {
                error,
                transactionId: transaction.transactionId,
              });
            }
          }

          if (failures.length > 0) {
            return yield* Effect.fail(
              new ReconcileTransactionsError({
                failures,
                message: `Failed to restore ${failures.length} transactions`,
              }),
            );
          }
        });

      const processObservedTransaction = (transaction: Transaction, schema: RuntimeSchema) =>
        Effect.gen(function* () {
          yield* processTransaction(transaction, schema);
          yield* refreshPerson;
        });

      const reconcileObservedTransactionsAndRefresh = (schema: RuntimeSchema) =>
        Effect.gen(function* () {
          yield* reconcileObservedTransactions(schema);
          yield* refreshPerson;
        });

      const purchase = (product: Product, schema: RuntimeSchema) =>
        Effect.gen(function* () {
          const distinctId = yield* identityManager.getDistinctId();
          const transaction = yield* paymentAdapter.buyProduct(
            product,
            undefined,
            deriveAccountToken(distinctId),
          );
          yield* processTransaction(transaction, schema);
          yield* refreshPerson;
        });

      const restorePurchases = reconcileObservedTransactionsAndRefresh;

      const startTransactionObserver = (onPurchase?: (transaction: Transaction) => void) =>
        paymentAdapter.initConnection(onPurchase);

      const endConnection = () => paymentAdapter.endConnection();

      return {
        endConnection,
        processObservedTransaction,
        purchase,
        reconcileObservedTransactions: reconcileObservedTransactionsAndRefresh,
        restorePurchases,
        startTransactionObserver,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
