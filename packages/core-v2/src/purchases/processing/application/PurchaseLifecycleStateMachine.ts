import { SubscriptionStatus } from "@voidhash/lib";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import type * as Schema from "effect/Schema";

import {
  EntitlementSync,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  PurchaseWebhookDispatcher,
  PurchaseWebhookOutbox,
  type PurchasePortError,
  type PurchaseStateRepositoryShape,
  type PurchaseSubscriptionRecord,
  type PurchaseSubscriptionUpdate,
  type PurchaseTransactionRecord,
} from "../../application/ports.ts";
import {
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type {
  CancelSubscriptionInput,
  CompleteOneTimePurchaseInput,
  ExpireSubscriptionInput,
  PurchaseActionContext,
  RenewSubscriptionInput,
  RevokeSubscriptionInput,
  StartSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import {
  PurchaseProcessingResult,
  type PurchaseProcessingMoney,
} from "../../domain/PurchaseProcessing.ts";
import {
  purchaseActionSpanAttributes,
  purchaseTypeFor,
  moneyFromStoredTransaction,
  storedMoneyColumns,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toCanceledAnalyticsInputs,
  toExpiredAnalyticsInputs,
  toOneTimePurchaseAnalyticsInputs,
  toRenewedAnalyticsInputs,
  toRevokedAnalyticsInputs,
  toStartedAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";
import { subscriptionStatusForInactiveEvent } from "../domain/PurchaseLifecycle.ts";
import {
  toPurchaseCompletedWebhookEvent,
  toSubscriptionCancelledWebhookEvent,
  toSubscriptionCreatedWebhookEvent,
  toSubscriptionExpiredWebhookEvent,
  toSubscriptionRenewedWebhookEvent,
} from "../domain/WebhookEventMapper.ts";
import {
  dispatchLifecycleEvents,
  emptyPurchaseResult,
  mapPurchasePortErrors,
  purchaseProviderKeyOf,
  reservePurchaseLedgerRow,
  resolvePurchaseContext,
  stageLifecycleEvents,
  stagePurchaseRevenue,
  storeSubscriptionIdOf,
  subscriptionIdentifierError,
  webhookContextOf,
  type ResolvedPurchaseContext,
  type WebhookBuilder,
} from "./PurchaseActionSupport.ts";

type Action = typeof PurchaseActionContext.Type;

interface TransactionResult {
  readonly alreadyExisted: boolean;
  readonly id: Option.Option<string>;
}

export interface PurchaseLifecycleStateMachineShape {
  readonly startSubscription: (
    input: typeof StartSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly renewSubscription: (
    input: typeof RenewSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly cancelSubscription: (
    input: typeof CancelSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly expireSubscription: (
    input: typeof ExpireSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly revokeSubscription: (
    input: typeof RevokeSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly completeOneTimePurchase: (
    input: typeof CompleteOneTimePurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

const makePurchaseLifecycleStateMachine = Effect.fn("makePurchaseLifecycleStateMachine")(
  function* () {
    const ids = yield* PurchaseIdGenerator;
    const repository = yield* PurchaseStateRepository;
    const unitOfWork = yield* PurchaseUnitOfWork;
    const dispatcher = yield* PurchaseWebhookDispatcher;

    const resolveContext = (input: Action) => resolvePurchaseContext(repository, input);

    const findOrCreateTransaction = (
      txRepository: PurchaseStateRepositoryShape,
      input: {
        readonly action: Action;
        readonly context: ResolvedPurchaseContext;
        readonly money: Option.Option<PurchaseProcessingMoney>;
      },
    ): Effect.Effect<TransactionResult, PurchasePortError> =>
      Effect.gen(function* () {
        if (Option.isNone(input.action.providerTransactionId)) {
          return { alreadyExisted: false, id: Option.none() };
        }
        const providerTransactionId = input.action.providerTransactionId.value;
        const existing = yield* txRepository.findTransactionByProviderTransactionId({
          paymentProviderConfigurationProductId: input.context.configurationProduct.id,
          storeTransactionId: providerTransactionId,
        });
        if (existing !== undefined) {
          // First observed without a price (typically the SDK path); the
          // provider event carrying the money completes the row.
          if (existing.currency === null && Option.isSome(input.money)) {
            yield* txRepository.backfillTransactionMoney({
              ...storedMoneyColumns(input.money),
              id: existing.id,
            });
          }
          return { alreadyExisted: true, id: Option.some(existing.id) };
        }
        const inserted = yield* txRepository.insertTransactionIfAbsent({
          ...storedMoneyColumns(input.money),
          id: ids.generate("transaction"),
          lastEventOccurredAt: input.action.occurredAt,
          occurredAt: input.action.occurredAt,
          paymentProviderConfigurationProductId: input.context.configurationProduct.id,
          personId: input.context.personId,
          providerEnvironment: input.action.providerEnvironment,
          storeTransactionId: providerTransactionId,
        });
        return { alreadyExisted: !inserted.inserted, id: Option.some(inserted.row.id) };
      });

    const newSubscriptionRow = (
      input: typeof StartSubscriptionInput.Type | typeof RenewSubscriptionInput.Type,
      context: ResolvedPurchaseContext,
      subscriptionKey: string,
      purchasedAt: Date,
    ) => ({
      billingRetryAt: null,
      isCancelAtPeriodEnd: false,
      canceledAt: null,
      cancellationReason: null,
      expiresAt: Option.getOrNull(input.expiresAt),
      extendedTo: null,
      gracePeriodExpiresAt: null,
      id: ids.generate("subscription"),
      initialTransactionId: Option.getOrElse(
        Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]),
        () => subscriptionKey,
      ),
      isTrial: input.isTrial,
      lastEventOccurredAt: input.occurredAt,
      latestTransactionId: Option.getOrElse(
        Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]),
        () => subscriptionKey,
      ),
      paymentProviderConfigurationProductId: context.configurationProduct.id,
      pendingPriceAmount: null,
      pendingPriceCurrency: null,
      pendingPriceEffectiveAt: null,
      pendingProductChangeId: null,
      personId: context.personId,
      providerEnvironment: input.providerEnvironment,
      purchasedAt,
      redeemedOfferAt: null,
      redeemedOfferId: null,
      startsAt: input.startsAt,
      status: SubscriptionStatus.Active,
      storeSubscriptionId: subscriptionKey,
    });

    /**
     * Projection patch a paid period applies: a new expiry, the latest
     * transaction, and a clean slate for billing-retry and cancellation state.
     */
    const paidPeriodPatch = (
      input: typeof StartSubscriptionInput.Type | typeof RenewSubscriptionInput.Type,
      subscriptionKey: string,
    ) => ({
      billingRetryAt: null,
      canceledAt: null,
      expiresAt: Option.getOrNull(input.expiresAt),
      gracePeriodExpiresAt: null,
      isCancelAtPeriodEnd: false,
      isTrial: input.isTrial,
      latestTransactionId: Option.getOrElse(
        Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]),
        () => subscriptionKey,
      ),
      startsAt: input.startsAt,
      status: SubscriptionStatus.Active,
    });

    /**
     * Re-points a series to the product the event was billed under. Covers a
     * pending change completing at renewal as well as immediate upgrades and
     * crossgrades that never announced a pending change.
     */
    const productSwapPatch = (
      existing: PurchaseSubscriptionRecord,
      context: ResolvedPurchaseContext,
    ): { paymentProviderConfigurationProductId?: string; pendingProductChangeId?: null } => {
      if (existing.paymentProviderConfigurationProductId === context.configurationProduct.id) {
        return {};
      }
      return {
        paymentProviderConfigurationProductId: context.configurationProduct.id,
        pendingProductChangeId: null,
      };
    };

    const findSeries = (
      txRepository: PurchaseStateRepositoryShape,
      input: Action,
      context: ResolvedPurchaseContext,
      subscriptionKey: string,
    ) =>
      txRepository.findSubscriptionSeries({
        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        paymentProviderConfigurationProductId: context.configurationProduct.id,
        storeSubscriptionId: subscriptionKey,
      });

    const startSubscription = (input: typeof StartSubscriptionInput.Type) =>
      mapPurchasePortErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionIdOf(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const outbox = yield* PurchaseWebhookOutbox;
              const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
              if (P.hasProperty(claim, "result")) return { deliveries: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const series = yield* findSeries(txRepository, input, context, subscriptionKey.value);
              let subscriptionId: string;
              let newlyInserted = false;
              let reObserved: boolean;
              if (
                series !== undefined &&
                series.paymentProviderConfigurationProductId !== context.configurationProduct.id
              ) {
                const updated = yield* txRepository.updateSubscriptionIfFresher({
                  ...paidPeriodPatch(input, subscriptionKey.value),
                  ...productSwapPatch(series, context),
                  id: series.id,
                  occurredAt: input.occurredAt,
                });
                if (updated.affectedRows === 0) {
                  yield* Effect.logInfo(
                    `startSubscription: stale event; watermark guard rejected product change (subscriptionId=${series.id}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
                subscriptionId = series.id;
                reObserved = transaction.alreadyExisted;
              } else {
                const inserted = yield* txRepository.insertSubscriptionIfAbsent(
                  newSubscriptionRow(input, context, subscriptionKey.value, input.purchasedAt),
                );
                subscriptionId = inserted.row.id;
                newlyInserted = inserted.inserted;
                reObserved = !inserted.inserted || transaction.alreadyExisted;
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stagePurchaseRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toStartedAnalyticsInputs(
                    input,
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: reObserved,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscriptionId),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              let event: WebhookBuilder = null;
              if (newlyInserted) {
                event = () =>
                  toSubscriptionCreatedWebhookEvent(
                    input,
                    { purchasedAt: input.purchasedAt, subscriptionId },
                    webhookContextOf(context),
                  );
              }
              const deliveries = yield* stageLifecycleEvents(outbox, input.projectId, [event]);
              return { deliveries, result };
            }),
          );
          yield* dispatchLifecycleEvents(dispatcher, input.projectId, outcome.deliveries);
          return outcome.result;
        }),
      );

    const renewSubscription = (input: typeof RenewSubscriptionInput.Type) =>
      mapPurchasePortErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionIdOf(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const outbox = yield* PurchaseWebhookOutbox;
              const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
              if (P.hasProperty(claim, "result")) return { deliveries: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const existing = yield* findSeries(
                txRepository,
                input,
                context,
                subscriptionKey.value,
              );
              let subscriptionId: string;
              let projectionAdvanced: boolean;
              let newlyInserted: boolean;
              // A trial period followed by a paid renewal is the conversion
              // the trial insights count; only the previous projection knows.
              const convertedFromTrial =
                existing !== undefined && existing.isTrial && !input.isTrial;
              if (existing === undefined) {
                const inserted = yield* txRepository.insertSubscriptionIfAbsent(
                  newSubscriptionRow(input, context, subscriptionKey.value, input.renewedAt),
                );
                subscriptionId = inserted.row.id;
                projectionAdvanced = inserted.inserted;
                newlyInserted = inserted.inserted;
              } else {
                const updated = yield* txRepository.updateSubscriptionIfFresher({
                  ...paidPeriodPatch(input, subscriptionKey.value),
                  ...productSwapPatch(existing, context),
                  id: existing.id,
                  occurredAt: input.occurredAt,
                });
                if (updated.affectedRows === 0) {
                  yield* Effect.logInfo(
                    `renewSubscription: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
                subscriptionId = existing.id;
                projectionAdvanced = updated.affectedRows > 0;
                newlyInserted = false;
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stagePurchaseRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toRenewedAnalyticsInputs(
                    { ...input, convertedFromTrial },
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscriptionId),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              const renewalAdvanced = projectionAdvanced && !transaction.alreadyExisted;
              let createdEvent: WebhookBuilder = null;
              if (renewalAdvanced && newlyInserted) {
                createdEvent = () =>
                  toSubscriptionCreatedWebhookEvent(
                    input,
                    { purchasedAt: input.renewedAt, subscriptionId },
                    webhookContextOf(context),
                  );
              }
              let renewedEvent: WebhookBuilder = null;
              if (renewalAdvanced) {
                renewedEvent = () =>
                  toSubscriptionRenewedWebhookEvent(
                    input,
                    { subscriptionId },
                    webhookContextOf(context),
                  );
              }
              const deliveries = yield* stageLifecycleEvents(outbox, input.projectId, [
                createdEvent,
                renewedEvent,
              ]);
              return { deliveries, result };
            }),
          );
          yield* dispatchLifecycleEvents(dispatcher, input.projectId, outcome.deliveries);
          return outcome.result;
        }),
      );

    const mutateKnownSubscription = <I extends Action>(input: {
      readonly action: I;
      readonly buildEvents: (
        subscriptionId: string,
        mapperContext: RevenueAnalyticsMapperContext,
      ) => ReadonlyArray<RevenueEvent>;
      readonly buildWebhook: (
        existing: PurchaseSubscriptionRecord,
        updated: boolean,
        context: ResolvedPurchaseContext,
      ) => WebhookBuilder;
      readonly methodName: "cancelSubscription" | "expireSubscription";
      readonly update: (
        existing: PurchaseSubscriptionRecord,
      ) => Omit<PurchaseSubscriptionUpdate, "id" | "occurredAt">;
    }) =>
      mapPurchasePortErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input.action));
          const context = yield* resolveContext(input.action);
          const subscriptionKey = storeSubscriptionIdOf(input.action);
          if (Option.isNone(subscriptionKey)) {
            return yield* subscriptionIdentifierError(input.action);
          }
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const outbox = yield* PurchaseWebhookOutbox;
              const claim = yield* reservePurchaseLedgerRow(ids, ledger, input.action);
              if (P.hasProperty(claim, "result")) return { deliveries: [], result: claim.result };
              const existing = yield* findSeries(
                txRepository,
                input.action,
                context,
                subscriptionKey.value,
              );
              if (existing === undefined) {
                const result = emptyPurchaseResult(context.personId);
                yield* ledger.finalize({ reservation: claim.reservation, result });
                return { deliveries: [], result };
              }
              const updated = yield* txRepository.updateSubscriptionIfFresher({
                ...input.update(existing),
                id: existing.id,
                occurredAt: input.action.occurredAt,
              });
              if (updated.affectedRows === 0) {
                yield* Effect.logInfo(
                  `${input.methodName}: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.action.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stagePurchaseRevenue({
                action: input.action,
                buildEvents: (mapperContext) => input.buildEvents(existing.id, mapperContext),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.id),
                    transactionId: Option.none(),
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              const deliveries = yield* stageLifecycleEvents(outbox, input.action.projectId, [
                input.buildWebhook(existing, updated.affectedRows > 0, context),
              ]);
              return { deliveries, result };
            }),
          );
          yield* dispatchLifecycleEvents(dispatcher, input.action.projectId, outcome.deliveries);
          return outcome.result;
        }),
      );

    const cancelSubscription = (input: typeof CancelSubscriptionInput.Type) =>
      mutateKnownSubscription({
        action: input,
        buildEvents: (subscriptionId, mapperContext) =>
          toCanceledAnalyticsInputs(
            { ...input, cancelAtPeriodEnd: input.isCancelAtPeriodEnd },
            { personId: input.personId, subscriptionId: Option.some(subscriptionId) },
            mapperContext,
          ),
        buildWebhook: (existing, updated, context) => {
          const alreadyCancelled =
            existing.canceledAt?.getTime() === input.canceledAt.getTime() &&
            existing.isCancelAtPeriodEnd === input.isCancelAtPeriodEnd;
          if (!updated || alreadyCancelled) return null;
          let status = existing.status;
          if (!input.isCancelAtPeriodEnd) status = subscriptionStatusForInactiveEvent();
          return () =>
            toSubscriptionCancelledWebhookEvent(
              input,
              { expiresAt: existing.expiresAt, status, subscriptionId: existing.id },
              webhookContextOf(context),
            );
        },
        methodName: "cancelSubscription",
        update: (existing) => {
          let status = existing.status;
          if (!input.isCancelAtPeriodEnd) status = subscriptionStatusForInactiveEvent();
          return {
            isCancelAtPeriodEnd: input.isCancelAtPeriodEnd,
            canceledAt: input.canceledAt,
            cancellationReason: Option.getOrNull(input.cancellationReason),
            status,
          };
        },
      });

    const expireSubscription = (input: typeof ExpireSubscriptionInput.Type) =>
      mutateKnownSubscription({
        action: input,
        buildEvents: (subscriptionId, mapperContext) =>
          toExpiredAnalyticsInputs(
            input,
            { personId: input.personId, subscriptionId: Option.some(subscriptionId) },
            mapperContext,
          ),
        buildWebhook: (existing, updated, context) => {
          const alreadyExpired =
            existing.status === subscriptionStatusForInactiveEvent() &&
            existing.expiresAt?.getTime() === input.expiredAt.getTime();
          if (!updated || alreadyExpired) return null;
          return () =>
            toSubscriptionExpiredWebhookEvent(
              input,
              { subscriptionId: existing.id },
              webhookContextOf(context),
            );
        },
        methodName: "expireSubscription",
        update: () => ({
          expiresAt: input.expiredAt,
          status: subscriptionStatusForInactiveEvent(),
        }),
      });

    const revokeSubscription = (input: typeof RevokeSubscriptionInput.Type) =>
      mapPurchasePortErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const subscriptionKey = storeSubscriptionIdOf(input);
          if (Option.isNone(subscriptionKey)) return yield* subscriptionIdentifierError(input);
          return yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
              if (P.hasProperty(claim, "result")) return claim.result;
              const existing = yield* findSeries(
                txRepository,
                input,
                context,
                subscriptionKey.value,
              );
              if (existing === undefined) {
                const result = emptyPurchaseResult(context.personId);
                yield* ledger.finalize({ reservation: claim.reservation, result });
                return result;
              }
              const subscriptionUpdate = yield* txRepository.updateSubscriptionIfFresher({
                canceledAt: input.revokedAt,
                cancellationReason: Option.getOrNull(input.revocationReason),
                expiresAt: input.revokedAt,
                id: existing.id,
                occurredAt: input.occurredAt,
                status: subscriptionStatusForInactiveEvent(),
              });
              if (subscriptionUpdate.affectedRows === 0) {
                yield* Effect.logInfo(
                  `revokeSubscription: stale event; watermark guard rejected subscription update (subscriptionId=${existing.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              let transaction: PurchaseTransactionRecord | typeof Schema.Undefined.Type;
              if (Option.isSome(input.providerTransactionId)) {
                transaction = yield* txRepository.findTransactionByProviderTransactionId({
                  paymentProviderConfigurationProductId: context.configurationProduct.id,
                  storeTransactionId: input.providerTransactionId.value,
                });
                if (transaction !== undefined) {
                  const transactionUpdate = yield* txRepository.updateTransactionIfFresher({
                    id: transaction.id,
                    occurredAt: input.occurredAt,
                    revocationReason: Option.getOrNull(input.revocationReason),
                    revokedAt: input.revokedAt,
                  });
                  if (transactionUpdate.affectedRows === 0) {
                    yield* Effect.logWarning(
                      `revokeSubscription: transaction watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                    );
                  }
                } else {
                  yield* Effect.logWarning(
                    `revokeSubscription: no prior transaction row (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
              }
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              let money = Option.none<PurchaseProcessingMoney>();
              if (transaction !== undefined) money = moneyFromStoredTransaction(transaction);
              return yield* stagePurchaseRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toRevokedAnalyticsInputs(
                    { ...input, money },
                    { personId: context.personId, subscriptionId: Option.some(existing.id) },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.id),
                    transactionId: Option.none(),
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
            }),
          );
        }),
      );

    const completeOneTimePurchase = (input: typeof CompleteOneTimePurchaseInput.Type) =>
      mapPurchasePortErrors(
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          const context = yield* resolveContext(input);
          const providerKey = purchaseProviderKeyOf(input);
          if (Option.isNone(providerKey)) {
            return yield* new PurchaseProcessingServiceError({
              cause: `One-time purchase event has no provider identifier (providerTransactionId and providerSubscriptionId both absent; providerEventType=${input.providerEventType})`,
            });
          }
          const outcome = yield* unitOfWork.transact(
            Effect.gen(function* () {
              const txRepository = yield* PurchaseStateRepository;
              const ledger = yield* PurchaseLedgerWriteStore;
              const entitlements = yield* EntitlementSync;
              const outbox = yield* PurchaseWebhookOutbox;
              const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
              if (P.hasProperty(claim, "result")) return { deliveries: [], result: claim.result };
              const transaction = yield* findOrCreateTransaction(txRepository, {
                action: input,
                context,
                money: input.money,
              });
              const inserted = yield* txRepository.insertPurchaseIfAbsent({
                id: ids.generate("purchase"),
                lastEventOccurredAt: null,
                paymentProviderConfigurationProductId: context.configurationProduct.id,
                personId: context.personId,
                providerEnvironment: input.providerEnvironment,
                providerKey: providerKey.value,
                refundedAt: null,
                refundReason: null,
                revokedAt: null,
                revocationReason: null,
                type: purchaseTypeFor(input.purchaseType),
              });
              const changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
              const result = yield* stagePurchaseRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toOneTimePurchaseAnalyticsInputs(
                    input,
                    { personId: context.personId, transactionId: transaction.id },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted || !inserted.inserted,
                    personId: context.personId,
                    purchaseId: Option.some(inserted.row.id),
                    subscriptionId: Option.none(),
                    transactionId: transaction.id,
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              let event: WebhookBuilder = null;
              if (inserted.inserted) {
                event = () =>
                  toPurchaseCompletedWebhookEvent(
                    input,
                    { providerKey: providerKey.value, purchaseId: inserted.row.id },
                    webhookContextOf(context),
                  );
              }
              const deliveries = yield* stageLifecycleEvents(outbox, input.projectId, [event]);
              return { deliveries, result };
            }),
          );
          yield* dispatchLifecycleEvents(dispatcher, input.projectId, outcome.deliveries);
          return outcome.result;
        }),
      );

    return {
      cancelSubscription,
      completeOneTimePurchase,
      expireSubscription,
      renewSubscription,
      revokeSubscription,
      startSubscription,
    } satisfies PurchaseLifecycleStateMachineShape;
  },
)();

/** Core state-machine slice for subscription and one-time-purchase lifecycle actions. */
export class PurchaseLifecycleStateMachine extends Context.Service<
  PurchaseLifecycleStateMachine,
  PurchaseLifecycleStateMachineShape
>()("@voidhash/core-v2/purchases/PurchaseLifecycleStateMachine", {
  make: makePurchaseLifecycleStateMachine,
}) {
  static readonly layer = Layer.effect(PurchaseLifecycleStateMachine)(
    PurchaseLifecycleStateMachine.make,
  );
}
