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
  type PurchaseRecord,
  type PurchaseStateRepositoryShape,
  type PurchaseTransactionRecord,
} from "../../application/ports.ts";
import {
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type {
  PurchaseActionContext,
  RefundPurchaseInput,
  ReverseRefundInput,
  RevokePurchaseInput,
} from "../../domain/PurchaseAction.ts";
import {
  PurchaseProcessingResult,
  type PurchaseProcessingMoney,
} from "../../domain/PurchaseProcessing.ts";
import {
  moneyFromStoredTransaction,
  purchaseActionSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toPurchaseRevokedAnalyticsInputs,
  toRefundedAnalyticsInputs,
  toRefundReversedAnalyticsInputs,
} from "../domain/RevenueEventMapper.ts";
import { toPurchaseRefundedWebhookEvent } from "../domain/WebhookEventMapper.ts";
import {
  dispatchLifecycleEvents,
  emptyPurchaseResult,
  mapPurchasePortErrors,
  purchaseProviderKeyOf,
  reservePurchaseLedgerRow,
  resolvePurchaseContext,
  stageLifecycleEvents,
  stagePurchaseRevenue,
  webhookContextOf,
  type ResolvedPurchaseContext,
  type WebhookBuilder,
} from "./PurchaseActionSupport.ts";

type Action = typeof PurchaseActionContext.Type;

export interface PurchaseRefundStateMachineShape {
  readonly refundPurchase: (
    input: typeof RefundPurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly reverseRefund: (
    input: typeof ReverseRefundInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly revokePurchase: (
    input: typeof RevokePurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

const makePurchaseRefundStateMachine = Effect.fn("makePurchaseRefundStateMachine")(function* () {
  const ids = yield* PurchaseIdGenerator;
  const repository = yield* PurchaseStateRepository;
  const unitOfWork = yield* PurchaseUnitOfWork;
  const dispatcher = yield* PurchaseWebhookDispatcher;

  const resolveContext = (input: Action) => resolvePurchaseContext(repository, input);

  const findTransaction = (
    txRepository: PurchaseStateRepositoryShape,
    action: Action,
    context: ResolvedPurchaseContext,
  ) => {
    if (Option.isNone(action.providerTransactionId)) {
      return Effect.succeed<PurchaseTransactionRecord | typeof Schema.Undefined.Type>(undefined);
    }
    return txRepository.findTransactionByProviderTransactionId({
      paymentProviderConfigurationProductId: context.configurationProduct.id,
      storeTransactionId: action.providerTransactionId.value,
    });
  };

  const findPurchase = (
    txRepository: PurchaseStateRepositoryShape,
    action: Action,
    context: ResolvedPurchaseContext,
  ) => {
    const key = purchaseProviderKeyOf(action);
    if (Option.isNone(key)) {
      return Effect.succeed<PurchaseRecord | typeof Schema.Undefined.Type>(undefined);
    }
    return txRepository.findPurchaseByProviderKey({
      paymentProviderConfigurationProductId: context.configurationProduct.id,
      providerKey: key.value,
    });
  };

  const storedMoney = (transaction: PurchaseTransactionRecord | typeof Schema.Undefined.Type) => {
    if (transaction === undefined) return Option.none<PurchaseProcessingMoney>();
    return moneyFromStoredTransaction(transaction);
  };

  const refundPurchase = (input: typeof RefundPurchaseInput.Type) =>
    mapPurchasePortErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        const outcome = yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const outbox = yield* PurchaseWebhookOutbox;
            const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
            if (P.hasProperty(claim, "result")) return { deliveries: [], result: claim.result };

            if (input.partialRefundMoney !== undefined) {
              const partialRefundMoney = input.partialRefundMoney;
              const result = yield* stagePurchaseRevenue({
                action: input,
                buildEvents: (mapperContext) =>
                  toRefundedAnalyticsInputs(
                    { ...input, money: Option.some(partialRefundMoney) },
                    { personId: context.personId },
                    mapperContext,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds: [],
                    idempotent: false,
                    personId: context.personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                context,
                ledger,
                repository: txRepository,
                reservation: claim.reservation,
              });
              return { deliveries: [], result };
            }

            const transaction = yield* findTransaction(txRepository, input, context);
            const purchase = yield* findPurchase(txRepository, input, context);
            if (Option.isNone(input.providerTransactionId)) {
              yield* Effect.logWarning(
                "refundPurchase: no providerTransactionId; skipping transaction row update",
              );
            }
            let transactionNewlyRefunded = false;
            if (transaction !== undefined) {
              const updated = yield* txRepository.updateTransactionIfFresher({
                id: transaction.id,
                occurredAt: input.occurredAt,
                refundReason: Option.getOrNull(input.refundReason),
                refundedAt: input.refundedAt,
              });
              transactionNewlyRefunded =
                updated.affectedRows > 0 &&
                transaction.refundedAt?.getTime() !== input.refundedAt.getTime();
              if (updated.affectedRows === 0 && Option.isSome(input.providerTransactionId)) {
                yield* Effect.logWarning(
                  `refundPurchase: transaction watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()}); analytics will still emit`,
                );
              }
            } else if (Option.isSome(input.providerTransactionId)) {
              yield* Effect.logWarning(
                `refundPurchase: no prior transaction row (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()}); analytics will still emit`,
              );
            }
            let purchaseUpdated = false;
            let purchaseNewlyRefunded = false;
            if (purchase !== undefined) {
              const updated = yield* txRepository.updatePurchaseIfFresher({
                id: purchase.id,
                occurredAt: input.occurredAt,
                refundReason: Option.getOrNull(input.refundReason),
                refundedAt: input.refundedAt,
              });
              purchaseUpdated = updated.affectedRows > 0;
              purchaseNewlyRefunded =
                purchaseUpdated && purchase.refundedAt?.getTime() !== input.refundedAt.getTime();
              if (!purchaseUpdated) {
                const key = purchaseProviderKeyOf(input);
                yield* Effect.logWarning(
                  `refundPurchase: purchase row watermark rejected (providerKey=${Option.getOrElse(key, () => "—")}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isNone(purchaseProviderKeyOf(input))) {
              yield* Effect.logWarning(
                "refundPurchase: no purchase provider key; skipping purchase row update",
              );
            }
            if (transaction === undefined && purchase === undefined) {
              yield* Effect.logWarning(
                "refundPurchase: no transaction and no purchase row for the refund subject; finalizing an empty ledger row without analytics",
              );
              const result = emptyPurchaseResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return { deliveries: [], result };
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (purchaseUpdated) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            const money = storedMoney(transaction);
            let purchaseId = Option.none<string>();
            if (purchase !== undefined) purchaseId = Option.some(purchase.id);
            const result = yield* stagePurchaseRevenue({
              action: input,
              buildEvents: (mapperContext) =>
                toRefundedAnalyticsInputs(
                  { ...input, money },
                  { personId: context.personId },
                  mapperContext,
                ),
              buildResult: (analyticsEventIds) =>
                new PurchaseProcessingResult({
                  analyticsEventIds,
                  changedGrantIds,
                  idempotent: false,
                  personId: context.personId,
                  purchaseId,
                  subscriptionId: Option.none(),
                  transactionId: Option.none(),
                }),
              context,
              ledger,
              repository: txRepository,
              reservation: claim.reservation,
            });
            let event: WebhookBuilder = null;
            if (purchaseNewlyRefunded || transactionNewlyRefunded) {
              event = () =>
                toPurchaseRefundedWebhookEvent(
                  input,
                  { money, purchaseId: Option.getOrNull(purchaseId) },
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

  const revokePurchase = (input: typeof RevokePurchaseInput.Type) =>
    mapPurchasePortErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        const key = purchaseProviderKeyOf(input);
        if (Option.isNone(key)) {
          return yield* new PurchaseProcessingServiceError({
            cause: `Purchase event has no purchase identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
          });
        }
        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
            if (P.hasProperty(claim, "result")) return claim.result;
            const purchase = yield* findPurchase(txRepository, input, context);
            if (purchase === undefined) {
              const result = emptyPurchaseResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return result;
            }
            const transaction = yield* findTransaction(txRepository, input, context);
            if (transaction !== undefined) {
              const transactionUpdate = yield* txRepository.updateTransactionIfFresher({
                id: transaction.id,
                occurredAt: input.occurredAt,
                revocationReason: Option.getOrNull(input.revocationReason),
                revokedAt: input.revokedAt,
              });
              if (
                transactionUpdate.affectedRows === 0 &&
                Option.isSome(input.providerTransactionId)
              ) {
                yield* Effect.logWarning(
                  `revokePurchase: transaction watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isNone(input.providerTransactionId)) {
              yield* Effect.logWarning(
                "revokePurchase: no providerTransactionId; skipping transaction row update",
              );
            } else {
              yield* Effect.logWarning(
                `revokePurchase: no prior transaction row (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
              );
            }
            const updated = yield* txRepository.updatePurchaseIfFresher({
              id: purchase.id,
              occurredAt: input.occurredAt,
              revocationReason: Option.getOrNull(input.revocationReason),
              revokedAt: input.revokedAt,
            });
            if (updated.affectedRows === 0) {
              yield* Effect.logWarning(
                `revokePurchase: purchase row watermark rejected (providerKey=${key.value}, occurredAt=${input.occurredAt.toISOString()})`,
              );
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (updated.affectedRows > 0) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            const money = storedMoney(transaction);
            return yield* stagePurchaseRevenue({
              action: input,
              buildEvents: (mapperContext) =>
                toPurchaseRevokedAnalyticsInputs(
                  { ...input, money },
                  { personId: context.personId },
                  mapperContext,
                ),
              buildResult: (analyticsEventIds) =>
                new PurchaseProcessingResult({
                  analyticsEventIds,
                  changedGrantIds,
                  idempotent: false,
                  personId: context.personId,
                  purchaseId: Option.some(purchase.id),
                  subscriptionId: Option.none(),
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

  const reverseRefund = (input: typeof ReverseRefundInput.Type) =>
    mapPurchasePortErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const claim = yield* reservePurchaseLedgerRow(ids, ledger, input);
            if (P.hasProperty(claim, "result")) return claim.result;
            const transaction = yield* findTransaction(txRepository, input, context);
            const purchase = yield* findPurchase(txRepository, input, context);
            if (Option.isNone(input.providerTransactionId)) {
              yield* Effect.logWarning(
                "reverseRefund: no providerTransactionId; skipping transaction row update",
              );
            }
            if (transaction !== undefined) {
              const transactionUpdate = yield* txRepository.updateTransactionIfFresher({
                id: transaction.id,
                occurredAt: input.occurredAt,
                refundReason: null,
                refundedAt: null,
              });
              if (
                transactionUpdate.affectedRows === 0 &&
                Option.isSome(input.providerTransactionId)
              ) {
                yield* Effect.logWarning(
                  `reverseRefund: transaction watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isSome(input.providerTransactionId)) {
              yield* Effect.logWarning(
                `reverseRefund: no prior transaction row (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
              );
            }
            let purchaseUpdated = false;
            if (purchase !== undefined) {
              const updated = yield* txRepository.updatePurchaseIfFresher({
                id: purchase.id,
                occurredAt: input.occurredAt,
                refundReason: null,
                refundedAt: null,
              });
              purchaseUpdated = updated.affectedRows > 0;
              if (!purchaseUpdated) {
                const key = purchaseProviderKeyOf(input);
                yield* Effect.logWarning(
                  `reverseRefund: purchase row watermark rejected (providerKey=${Option.getOrElse(key, () => "—")}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isNone(purchaseProviderKeyOf(input))) {
              yield* Effect.logWarning(
                "reverseRefund: no purchase provider key; skipping purchase row update",
              );
            }
            if (transaction === undefined && purchase === undefined) {
              yield* Effect.logWarning(
                "reverseRefund: no transaction and no purchase row for the reversal subject; finalizing an empty ledger row without analytics",
              );
              const result = emptyPurchaseResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return result;
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (purchaseUpdated) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            const money = storedMoney(transaction);
            return yield* stagePurchaseRevenue({
              action: input,
              buildEvents: (mapperContext) =>
                toRefundReversedAnalyticsInputs(
                  { ...input, money },
                  { personId: context.personId },
                  mapperContext,
                ),
              buildResult: (analyticsEventIds) =>
                new PurchaseProcessingResult({
                  analyticsEventIds,
                  changedGrantIds,
                  idempotent: false,
                  personId: context.personId,
                  purchaseId: Option.none(),
                  subscriptionId: Option.none(),
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

  return {
    refundPurchase,
    reverseRefund,
    revokePurchase,
  } satisfies PurchaseRefundStateMachineShape;
})();

/** Core state-machine slice for refunds, refund reversals, and purchase revocations. */
export class PurchaseRefundStateMachine extends Context.Service<
  PurchaseRefundStateMachine,
  PurchaseRefundStateMachineShape
>()("@voidhash/core-v2/purchases/PurchaseRefundStateMachine", {
  make: makePurchaseRefundStateMachine,
}) {
  static readonly layer = Layer.effect(PurchaseRefundStateMachine)(PurchaseRefundStateMachine.make);
}
