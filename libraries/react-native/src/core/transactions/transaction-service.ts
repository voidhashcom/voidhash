import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import type { Product } from "../entities/product";
import {
  fromTransactionRecord,
  toTransactionRecord,
  type Transaction,
} from "../entities/transaction";
import { PersonInfoManager } from "../identity/person-info-manager";
import { IdentityManager } from "../identity/identity-manager";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  countsTowardsBreaker,
  httpStatusOf,
  isAuthStatus,
  withRequestTimeout,
} from "../network/policy";
import { ApiClient } from "../networking/api-client";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type { RuntimeProductDefinition, RuntimeSchema } from "../schema/runtime";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { deriveAccountToken } from "../utils/account-token";
import { ReconcileTransactionsError } from "./errors";
import { TransactionOutbox } from "./transaction-outbox";

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
  readonly deferred: Deferred.Deferred<boolean, unknown>;
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
      const outbox = yield* TransactionOutbox;
      const diagnostics = yield* Diagnostics;
      const authGate = yield* AuthGate;
      const breaker = yield* CircuitBreaker;
      const transactionBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);
      // Follow-up refreshes belong to the SDK runtime, so disposing it stops
      // them instead of leaving timers behind.
      const serviceScope = yield* Effect.scope;

      const inFlightTransactions = MutableHashMap.empty<string, InFlightTransaction>();

      const refreshPerson = Effect.fn("TransactionService.refreshPerson")(function* () {
        const distinctId = yield* identityManager.getDistinctId();
        yield* personInfoManager.refresh(distinctId);
      });

      /**
       * Refreshes grants after a purchase, then twice more at 2 s and 5 s.
       * The server needs a moment to turn an accepted receipt into an
       * entitlement, and without the follow-ups `hasPerk` stays false for the
       * first seconds after a successful purchase — exactly when the app is
       * about to unlock the thing the user just paid for.
       */
      const refreshGrantsAfterPurchase = Effect.fn("TransactionService.refreshGrantsAfterPurchase")(
        function* () {
          yield* refreshPerson();
          yield* Effect.forkIn(
            Effect.fn("TransactionService.followUpGrantRefreshes")(function* () {
              yield* Effect.sleep(Duration.seconds(2));
              yield* refreshPerson();
              yield* Effect.sleep(Duration.seconds(3));
              yield* refreshPerson();
            })(),
            serviceScope,
          );
        },
      );

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
        distinctIdOverride?: string,
      ) =>
        Effect.suspend(() => {
          if (transaction.purchaseState !== "purchased") {
            return Effect.as(
              Effect.logDebug("Skipping transaction that is not purchased", {
                purchaseState: transaction.purchaseState,
                transactionId: transaction.transactionId,
              }),
              false,
            );
          }

          const transactionProcessingKey = buildTransactionProcessingKey(transaction);
          const processedCacheKey = getProcessedTransactionCacheKey(transactionProcessingKey);
          const existing = MutableHashMap.get(inFlightTransactions, transactionProcessingKey);
          if (Option.isSome(existing)) {
            if (readOnlyOverride !== false) {
              return Deferred.await(existing.value.deferred);
            }

            existing.value.ownerClaimed = true;
            return Effect.flatMap(Deferred.await(existing.value.deferred), (accepted) =>
              accepted
                ? Effect.as(
                    finalizeSkippedStoreFinalization(
                      transaction,
                      schema,
                      existing.value,
                      processedCacheKey,
                    ),
                    true,
                  )
                : Effect.succeed(false),
            );
          }

          const deferred = Deferred.makeUnsafe<boolean, unknown>();
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
              // An expired marker is a miss: the cache serves expired entries
              // for offline reads, but a processed-transaction record past its
              // lifetime must not stop a receipt from syncing again.
              const liveHit = Option.filter(cachedTransaction, (hit) => !hit.isExpired);
              const cachedState = Option.isSome(liveHit)
                ? liveHit.value.value === true
                  ? { backendAccepted: true, storeFinalized: true }
                  : liveHit.value.value === false
                    ? undefined
                    : liveHit.value.value
                : undefined;

              if (cachedState?.storeFinalized) {
                yield* outbox.ack(transactionProcessingKey);
                return true;
              }

              if (cachedState?.backendAccepted) {
                yield* outbox.ack(transactionProcessingKey);
              }

              if (
                transaction.store !== "development" &&
                transaction.platform === "android" &&
                !transaction.purchaseToken
              ) {
                yield* diagnostics.emit({
                  code: DIAGNOSTIC_CODES.TRANSACTION_RECEIPT_DROPPED,
                  kind: "eviction",
                  message: `Discarded an Android receipt for "${transaction.transactionId}" that carries no purchase token, so it can never be verified`,
                  operation: "syncTransaction",
                  retryable: false,
                });
                yield* outbox.ack(transactionProcessingKey);
                return false;
              }

              if (!cachedState?.backendAccepted) {
                const distinctId = distinctIdOverride ?? (yield* identityManager.getDistinctId());
                // Written before the first network call so a receipt observed
                // just before the app dies is still delivered next launch.
                yield* outbox.enqueue(
                  transactionProcessingKey,
                  toTransactionRecord(transaction),
                  distinctId,
                );
                const commonHeaders = yield* getCommonSdkHeaders();

                const headers = { ...commonHeaders, "x-distinct-id": distinctId };
                const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
                if (authGate.isPaused() && !authProbe) {
                  yield* outbox.postpone(transactionProcessingKey);
                  return false;
                }
                const allowed = yield* breaker.canAttempt(transactionBreakerKey, "syncTransaction");
                if (!allowed) {
                  if (authProbe) yield* authGate.completeProbe(false);
                  yield* outbox.postpone(transactionProcessingKey);
                  return false;
                }

                // Bounded like every other request: a receipt sync that hangs
                // stays queued rather than wedging the purchase flow.
                const syncAttempt: Effect.Effect<boolean, unknown> =
                  transaction.store === "development"
                    ? Effect.map(
                        withRequestTimeout(
                          "developmentPurchase",
                          apiClient.sdk.developmentPurchase({
                            headers,
                            payload: {
                              devTransactionId: transaction.transactionId,
                              productSlug: resolveTransactionProductSlug(
                                transaction,
                                schema.products,
                              ),
                              purchaseDate: transaction.purchaseDate,
                              quantity: transaction.quantity,
                            },
                          }),
                        ),
                        (response) => response.accepted,
                      )
                    : Effect.map(
                        withRequestTimeout(
                          "syncTransaction",
                          apiClient.sdk.syncTransaction({
                            headers,
                            payload: mapTransactionToSyncPayload(transaction, schema.products),
                          }),
                        ),
                        (response) => response.accepted,
                      );
                const outcome = yield* Effect.result(syncAttempt);

                if (Result.isFailure(outcome)) {
                  const status = httpStatusOf(outcome.failure);
                  const statusCode = Option.getOrUndefined(status);
                  if (authProbe) {
                    yield* authGate.completeProbe(
                      statusCode !== undefined && !isAuthStatus(statusCode),
                    );
                  }
                  if (statusCode !== undefined && isAuthStatus(statusCode)) {
                    yield* breaker.releaseProbe(transactionBreakerKey);
                    yield* authGate.pause("syncTransaction", statusCode);
                  } else if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
                    yield* breaker.recordFailure(transactionBreakerKey);
                  } else {
                    yield* breaker.releaseProbe(transactionBreakerKey);
                  }
                  yield* diagnostics.emit({
                    code: DIAGNOSTIC_CODES.TRANSACTION_SYNC_DEFERRED,
                    httpStatus: Option.getOrUndefined(status),
                    kind: "transport",
                    message: `Receipt for "${transaction.transactionId}" stays queued because the backend could not confirm it`,
                    operation: "syncTransaction",
                    retryable: true,
                  });
                  yield* outbox.postpone(transactionProcessingKey);
                  return false;
                }

                if (authProbe) yield* authGate.completeProbe(true);
                yield* breaker.recordSuccess(transactionBreakerKey);
                if (outcome.success !== true) {
                  yield* diagnostics.emit({
                    code: DIAGNOSTIC_CODES.TRANSACTION_SYNC_DEFERRED,
                    kind: "transport",
                    message: `Receipt for "${transaction.transactionId}" stays queued because the backend did not accept it`,
                    operation: "syncTransaction",
                    retryable: true,
                  });
                  yield* outbox.postpone(transactionProcessingKey);
                  return false;
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
                // Acked only now: the receipt leaves the outbox once the
                // server has taken responsibility for it.
                yield* outbox.ack(transactionProcessingKey);
              }

              if (!entry.ownerClaimed && (readOnlyOverride ?? sdkConfiguration.readOnly)) {
                entry.storeFinalizationPending = true;
                return true;
              }

              yield* finalizeWithStore(transaction, schema, processedCacheKey);
              return true;
            },
          )();

          return Effect.exit(execution).pipe(
            Effect.tap((exit) => Deferred.done(deferred, exit)),
            Effect.flatMap((exit) =>
              Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
            ),
            // Also runs when the processing fiber is interrupted: callers that
            // joined the deferred are released rather than left waiting on a
            // promise nobody will settle. `interrupt` is a no-op once `done`
            // has already completed it.
            Effect.ensuring(
              Effect.andThen(
                Deferred.interrupt(deferred),
                Effect.sync(() => {
                  MutableHashMap.remove(inFlightTransactions, transactionProcessingKey);
                }),
              ),
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
          const accepted = yield* processTransaction(transaction, schema);
          if (accepted) yield* refreshGrantsAfterPurchase();
        },
      );

      const reconcileObservedTransactionsAndRefresh = Effect.fn(
        "TransactionService.reconcileObservedTransactionsAndRefresh",
      )(function* (schema: RuntimeSchema) {
        yield* reconcileObservedTransactions(schema);
        yield* refreshPerson();
      });

      /**
       * Buys a product and reports whether the backend accepted the receipt.
       * `false` means the receipt is in the outbox waiting for the server;
       * the purchase itself went through with the store.
       */
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
        const accepted = yield* processTransaction(
          transaction,
          schema,
          readOnlyAtPurchaseStart,
          distinctId,
        );
        if (accepted) yield* refreshGrantsAfterPurchase();
        return accepted;
      });

      const restorePurchases = reconcileObservedTransactionsAndRefresh;

      const startTransactionObserver = (onPurchase?: (transaction: Transaction) => void) =>
        paymentAdapter.initConnection(onPurchase);

      const endConnection = () => paymentAdapter.endConnection();

      /**
       * Re-attempts every receipt whose cool-down has elapsed. Called on boot
       * and whenever the app returns to the foreground, so an outage during a
       * purchase costs delivery latency rather than the purchase itself.
       * Failures postpone the entry instead of surfacing.
       */
      const syncOutbox = Effect.fn("TransactionService.syncOutbox")(function* (
        schema: RuntimeSchema,
      ) {
        const entries = yield* outbox.due();
        yield* Effect.forEach(
          entries,
          Effect.fn("TransactionService.syncOutboxEntry")(function* (entry) {
            const transaction = fromTransactionRecord(entry.transaction);
            if (transaction === undefined) {
              yield* outbox.ack(entry.key);
              return;
            }
            const exit = yield* Effect.exit(
              processTransaction(transaction, schema, undefined, entry.distinctId || undefined),
            );
            if (Exit.isSuccess(exit)) {
              return;
            }
            yield* diagnostics.emit({
              code: DIAGNOSTIC_CODES.TRANSACTION_SYNC_DEFERRED,
              kind: "transport",
              message: `Receipt for "${transaction.transactionId}" is still queued: ${String(Cause.squash(exit.cause))}`,
              operation: "syncTransaction",
              retryable: true,
            });
            yield* outbox.postpone(entry.key);
          }),
          { concurrency: 1 },
        );
      });

      return {
        endConnection,
        syncOutbox,
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
