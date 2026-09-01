import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

import { CacheManager } from "../caching/cache-manager";
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

const PROCESSED_TRANSACTION_TTL_MS = 1000 * 60 * 30;

interface TransactionProcessingState {
  readonly backendAccepted: boolean;
  readonly storeFinalized: boolean;
}

/**
 * Coalescing entry for one store transaction being processed right now.
 *
 * `ownerClaimed` is the strongest claim any joined caller made: a purchase this
 * SDK started pins owner mode, and that pin has to win over the live observer
 * flag no matter which caller reached `processTransaction` first.
 * `storeFinalizationPending` records that the running processing synced the
 * transaction but deliberately skipped the store finish because it read
 * observer mode, so an owner caller that joined too late can finish it after
 * the fact without re-syncing.
 */
interface InFlightTransaction {
  readonly deferred: Deferred.Deferred<void, unknown>;
  ownerClaimed: boolean;
  storeFinalizationPending: boolean;
}

const buildTransactionProcessingKey = (transaction: Transaction) =>
  `${transaction.platform}:${transaction.transactionId}:${transaction.purchaseDate}`;

const getProcessedTransactionCacheKey = (transactionProcessingKey: string) =>
  `processed-transaction:${transactionProcessingKey}`;

const resolveTransactionProductSlug = (
  transaction: Transaction,
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) => {
  const matchedProduct = R.values(productDefinitions).find((productDefinition) => {
    if (productDefinition.slug === transaction.productId) {
      return true;
    }

    const provider =
      transaction.store === "development"
        ? productDefinition.configuration.providers.development
        : transaction.platform === "ios"
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
  R.values(productDefinitions).find((productDefinition) => {
    if (productDefinition.slug === transaction.productId) {
      return true;
    }
    const provider =
      transaction.store === "development"
        ? productDefinition.configuration.providers.development
        : transaction.platform === "ios"
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
      const personInfoManager = yield* PersonInfoManager;
      const identityManager = yield* IdentityManager;
      const paymentAdapter = yield* PaymentAdapter;
      const sdkConfiguration = yield* SdkConfiguration;

      const inFlightTransactions = MutableHashMap.empty<string, InFlightTransaction>();

      const refreshPerson = Effect.fn("TransactionService.refreshPerson")(function* () {
        const distinctId = yield* identityManager.getDistinctId();
        yield* personInfoManager.getPerson(distinctId, "fetch");
      });

      /**
       * Finishes/acknowledges a transaction with the store and records the
       * terminal state in the cache. Never syncs — the caller has already done
       * that.
       */
      const finalizeWithStore = Effect.fn("TransactionService.finalizeWithStore")(function* (
        transaction: Transaction,
        schema: RuntimeSchema,
        processedCacheKey: string,
      ) {
        if (transaction.store !== "development" && !transaction.isAcknowledged) {
          yield* paymentAdapter.acknowledgePurchase(
            transaction,
            resolveTransactionProductDefinition(transaction, schema.products)?.type,
          );
        }

        yield* cacheManager.set(
          processedCacheKey,
          { backendAccepted: true, storeFinalized: true },
          { ttl: PROCESSED_TRANSACTION_TTL_MS },
        );
      });

      /**
       * Runs the store finish that an already-completed processing skipped
       * because it read observer mode. The pending flag is cleared inside the
       * same synchronous step that claims it, so concurrent owner callers can
       * never both acknowledge.
       */
      const finalizeSkippedStoreFinalization = (
        transaction: Transaction,
        schema: RuntimeSchema,
        entry: InFlightTransaction,
        processedCacheKey: string,
      ) =>
        Effect.suspend(() => {
          if (!entry.storeFinalizationPending) {
            return Effect.void;
          }
          entry.storeFinalizationPending = false;
          return finalizeWithStore(transaction, schema, processedCacheKey);
        });

      /**
       * Syncs one store transaction to the backend and — unless the SDK is in
       * observer mode — finishes/acknowledges it with the store.
       *
       * `readOnlyOverride` pins that ownership decision for a purchase this
       * SDK started, so a `client.setReadOnly(true)` landing mid-purchase
       * can't leave the transaction unfinished. Every other caller (the
       * observer callback, reconciliation, restore) omits it and reads the
       * live flag at the moment the decision is made.
       *
       * Concurrent processing of the same transaction is coalesced, and an
       * owner-mode pin (`readOnlyOverride === false`) wins regardless of which
       * caller registered first: it upgrades the in-flight entry before the
       * finish decision when it can, and otherwise finishes the transaction
       * itself once the shared processing resolves.
       */
      const processTransaction = (
        transaction: Transaction,
        schema: RuntimeSchema,
        readOnlyOverride?: boolean,
      ) =>
        Effect.suspend(() => {
          if (transaction.purchaseState !== "purchased") {
            return Effect.logDebug("Skipping transaction that is not purchased", {
              purchaseState: transaction.purchaseState,
              transactionId: transaction.transactionId,
            });
          }

          const transactionProcessingKey = buildTransactionProcessingKey(transaction);
          const processedCacheKey = getProcessedTransactionCacheKey(transactionProcessingKey);
          const existing = MutableHashMap.get(inFlightTransactions, transactionProcessingKey);
          if (Option.isSome(existing)) {
            if (readOnlyOverride !== false) {
              return Deferred.await(existing.value.deferred);
            }

            existing.value.ownerClaimed = true;
            return Effect.flatMap(Deferred.await(existing.value.deferred), () =>
              finalizeSkippedStoreFinalization(
                transaction,
                schema,
                existing.value,
                processedCacheKey,
              ),
            );
          }

          const deferred = Deferred.makeUnsafe<void, unknown>();
          const entry: InFlightTransaction = {
            deferred,
            ownerClaimed: readOnlyOverride === false,
            storeFinalizationPending: false,
          };
          MutableHashMap.set(inFlightTransactions, transactionProcessingKey, entry);

          const execution = Effect.fn("TransactionService.processTransactionExecution")(
            function* () {
              const cachedTransaction = yield* cacheManager.get<
                boolean | TransactionProcessingState
              >(processedCacheKey);
              const cachedState = Option.isSome(cachedTransaction)
                ? cachedTransaction.value.value === true
                  ? { backendAccepted: true, storeFinalized: true }
                  : cachedTransaction.value.value === false
                    ? undefined
                    : cachedTransaction.value.value
                : undefined;

              if (cachedState?.storeFinalized) {
                return;
              }

              if (
                transaction.store !== "development" &&
                transaction.platform === "android" &&
                !transaction.purchaseToken
              ) {
                yield* Effect.logWarning(
                  "Skipping observed Android transaction without purchase token",
                  {
                    transactionId: transaction.transactionId,
                  },
                );
                return;
              }

              if (!cachedState?.backendAccepted) {
                const commonHeaders = yield* getCommonSdkHeaders();
                const distinctId = yield* identityManager.getDistinctId();

                const headers = { ...commonHeaders, "x-distinct-id": distinctId };
                if (transaction.store === "development") {
                  yield* apiClient.sdk.developmentPurchase({
                    headers,
                    payload: {
                      devTransactionId: transaction.transactionId,
                      productSlug: resolveTransactionProductSlug(transaction, schema.products),
                      purchaseDate: transaction.purchaseDate,
                      quantity: transaction.quantity,
                    },
                  });
                } else {
                  yield* apiClient.sdk.syncTransaction({
                    headers,
                    payload: mapTransactionToSyncPayload(transaction, schema.products),
                  });
                }

                yield* cacheManager.set(
                  processedCacheKey,
                  {
                    backendAccepted: true,
                    storeFinalized:
                      transaction.store === "development" || transaction.isAcknowledged,
                  },
                  { ttl: PROCESSED_TRANSACTION_TTL_MS },
                );
              }

              if (!entry.ownerClaimed && (readOnlyOverride ?? sdkConfiguration.readOnly)) {
                entry.storeFinalizationPending = true;
                return;
              }

              yield* finalizeWithStore(transaction, schema, processedCacheKey);
            },
          )();

          return Effect.exit(execution).pipe(
            Effect.tap((exit) => Deferred.done(deferred, exit)),
            Effect.flatMap((exit) =>
              Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
            ),
            Effect.ensuring(
              Effect.sync(() => {
                MutableHashMap.remove(inFlightTransactions, transactionProcessingKey);
              }),
            ),
          );
        });

      const reconcileObservedTransactions = Effect.fn(
        "TransactionService.reconcileObservedTransactions",
      )(function* (schema: RuntimeSchema) {
        const [pendingTransactions, purchasedTransactions] = yield* Effect.all(
          [paymentAdapter.getPendingTransactions(), paymentAdapter.getPurchaseHistory(true)],
          { concurrency: 1 },
        );

        const observedTransactionsByKey = HashMap.fromIterable(
          [...pendingTransactions, ...purchasedTransactions].map(
            (transaction) => [buildTransactionProcessingKey(transaction), transaction] as const,
          ),
        );
        const failures = Arr.getSomes(
          yield* Effect.forEach(
            HashMap.values(observedTransactionsByKey),
            Effect.fn("TransactionService.reconcileTransaction")(function* (transaction) {
              if (
                resolveTransactionProductDefinition(transaction, schema.products)?.type ===
                "one-time-consumable"
              ) {
                return Option.none();
              }
              const exit = yield* Effect.exit(processTransaction(transaction, schema));
              if (Exit.isSuccess(exit)) return Option.none();
              const error = Cause.squash(exit.cause);
              yield* Effect.logWarning("Failed to process observed transaction", {
                error,
                transactionId: transaction.transactionId,
              });
              return Option.some({ error, transactionId: transaction.transactionId });
            }),
            { concurrency: 1 },
          ),
        );

        if (Arr.isReadonlyArrayNonEmpty(failures)) {
          return yield* Effect.fail(
            new ReconcileTransactionsError({
              failures,
              message: `Failed to restore ${failures.length} transactions`,
            }),
          );
        }
      });

      const processObservedTransaction = Effect.fn("TransactionService.processObservedTransaction")(
        function* (transaction: Transaction, schema: RuntimeSchema) {
          yield* processTransaction(transaction, schema);
          yield* refreshPerson();
        },
      );

      const reconcileObservedTransactionsAndRefresh = Effect.fn(
        "TransactionService.reconcileObservedTransactionsAndRefresh",
      )(function* (schema: RuntimeSchema) {
        yield* reconcileObservedTransactions(schema);
        yield* refreshPerson();
      });

      const purchase = Effect.fn("TransactionService.purchase")(function* (
        product: Product,
        schema: RuntimeSchema,
      ) {
        // Pinned at purchase start: a purchase this SDK owns must still be
        // finished with the store even if the app flips to observer mode
        // while the store sheet is open.
        const readOnlyAtPurchaseStart = sdkConfiguration.readOnly;
        const distinctId = yield* identityManager.getDistinctId();
        const transaction = yield* paymentAdapter.buyProduct(
          product,
          undefined,
          deriveAccountToken(distinctId),
        );
        yield* processTransaction(transaction, schema, readOnlyAtPurchaseStart);
        yield* refreshPerson();
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
