import { Context, Effect, Layer, Option } from "effect";

import {
  EntitlementSync,
  PurchaseEventPublisher,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  type PurchaseLedgerReservation,
  type PurchaseLedgerWriteStoreShape,
  type PurchasePortError,
  type PurchaseRecord,
  type PurchaseStateRepositoryShape,
  type PurchaseTransactionRecord,
} from "../../application/ports.ts";
import {
  PurchaseProcessingProductNotMappedError,
  PurchaseProcessingServiceError,
  type PurchaseProcessingError,
} from "../../application/ports/PurchaseStateStore.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import type {
  PurchaseActionContext,
  RefundPurchaseInput,
  ReverseRefundInput,
  RevokePurchaseInput,
} from "../../domain/PurchaseAction.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import {
  describePurchaseErrorCause,
  moneyFromStoredTransaction,
  purchaseActionSpanAttributes,
  purchaseProcessingResultSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import {
  toPurchaseRevokedAnalyticsInputs,
  toRefundedAnalyticsInputs,
  toRefundReversedAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";
import {
  toPurchaseRefundedWebhookEvent,
  type WebhookEventMapperContext,
  type WebhookLifecycleEvent,
} from "../domain/WebhookEventMapper.ts";

type Action = typeof PurchaseActionContext.Type;
type WebhookBuilder = (() => WebhookLifecycleEvent) | null;

interface ResolvedContext {
  readonly configurationProduct: {
    readonly id: string;
    readonly productId: string;
    readonly productSlug: string | null;
    readonly providerProductKey: string;
  };
  readonly distinctId: string;
  readonly personId: string;
}

interface StagedRevenueInput {
  readonly action: Action;
  readonly buildEvents: (context: RevenueAnalyticsMapperContext) => ReadonlyArray<RevenueEvent>;
  readonly buildResult: (eventIds: ReadonlyArray<string>) => PurchaseProcessingResult;
  readonly context: ResolvedContext;
  readonly ledger: PurchaseLedgerWriteStoreShape;
  readonly repository: PurchaseStateRepositoryShape;
  readonly reservation: PurchaseLedgerReservation;
}

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

const emptyResult = (personId: string) =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: false,
    personId,
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

const makePurchaseRefundStateMachine = Effect.gen(function* () {
  const ids = yield* PurchaseIdGenerator;
  const repository = yield* PurchaseStateRepository;
  const unitOfWork = yield* PurchaseUnitOfWork;
  const publisher = yield* PurchaseEventPublisher;

  const resolveContext = (input: Action) =>
    Effect.gen(function* () {
      const configurationProduct = yield* repository.resolveConfigurationProduct(
        input.paymentProviderConfigurationProductId,
      );
      if (
        configurationProduct === undefined ||
        configurationProduct.productProjectId !== input.projectId ||
        configurationProduct.paymentProviderConfigurationId !== input.paymentProviderConfigurationId
      ) {
        return yield* new PurchaseProcessingProductNotMappedError({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
        });
      }
      const person = yield* repository.findPerson(input.personId);
      if (person === undefined || person.projectId !== input.projectId) {
        return yield* new PurchaseProcessingServiceError({
          cause: `Resolved person ${input.personId} not found for project ${input.projectId}`,
        });
      }
      return {
        configurationProduct: {
          id: configurationProduct.id,
          productId: configurationProduct.productId,
          productSlug: configurationProduct.productSlug,
          providerProductKey: configurationProduct.providerProductKey,
        },
        distinctId: person.primaryDistinctId ?? person.id,
        personId: person.id,
      } satisfies ResolvedContext;
    });

  const webhookContext = (context: ResolvedContext): WebhookEventMapperContext => ({
    distinctId: context.distinctId,
    productId: context.configurationProduct.productId,
    productSlug: context.configurationProduct.productSlug,
    providerProductId: context.configurationProduct.providerProductKey,
  });

  const reserve = (ledger: PurchaseLedgerWriteStoreShape, input: Action) =>
    ledger.reserve({
      id: ids.generate("purchaseLedger"),
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      personId: input.personId,
      projectId: input.projectId,
      providerEventType: input.providerEventType,
      providerId: input.providerId,
      rawProviderPayload: Option.getOrNull(input.rawProviderPayload),
      source: input.source,
    });

  const stageRevenue = (input: StagedRevenueInput) =>
    Effect.gen(function* () {
      const mapping = yield* input.repository.resolveConfigurationProduct(
        input.action.paymentProviderConfigurationProductId,
      );
      if (
        mapping === undefined ||
        mapping.productProjectId !== input.action.projectId ||
        mapping.paymentProviderConfigurationId !== input.action.paymentProviderConfigurationId
      ) {
        return yield* new PurchaseProcessingServiceError({
          cause: `Revenue product mapping ${input.action.paymentProviderConfigurationProductId} is missing or outside project ${input.action.projectId}`,
        });
      }
      const [token, distinctId] = yield* Effect.all([
        input.repository.findPublicApiToken(input.action.projectId),
        input.repository.resolveDistinctId(input.context.personId),
      ]);
      const events = input.buildEvents({
        distinctId,
        idempotencyKey: input.action.idempotencyKey,
        organizationId: input.action.organizationId,
        productId: mapping.productId,
        projectId: input.action.projectId,
        providerProductKey: mapping.providerProductKey,
        token: token ?? `vh_server_revenue_${input.action.projectId}`,
      });
      const result = input.buildResult(events.map((event) => event.eventId));
      yield* Effect.annotateCurrentSpan({
        ...purchaseProcessingResultSpanAttributes(result),
        "voidhash.analytics.event_count": events.length,
      });
      yield* input.ledger.stageEvents({ events, reservation: input.reservation, result });
      return result;
    });

  const findTransaction = (
    txRepository: PurchaseStateRepositoryShape,
    action: Action,
    context: ResolvedContext,
  ) => {
    if (Option.isNone(action.providerTransactionId)) {
      return Effect.succeed<PurchaseTransactionRecord | undefined>(undefined);
    }
    return txRepository.findTransactionByProviderTransactionId({
      paymentProviderConfigurationProductId: context.configurationProduct.id,
      storeTransactionId: action.providerTransactionId.value,
    });
  };

  const providerKey = (action: Action) =>
    Option.firstSomeOf([action.providerTransactionId, action.providerSubscriptionId]);

  const findPurchase = (
    txRepository: PurchaseStateRepositoryShape,
    action: Action,
    context: ResolvedContext,
  ) => {
    const key = providerKey(action);
    if (Option.isNone(key)) return Effect.succeed<PurchaseRecord | undefined>(undefined);
    return txRepository.findPurchaseByProviderKey({
      paymentProviderConfigurationProductId: context.configurationProduct.id,
      providerKey: key.value,
    });
  };

  const mapErrors = <A, E extends PurchaseProcessingError | PurchasePortError>(
    effect: Effect.Effect<A, E>,
  ) =>
    effect.pipe(
      Effect.mapError((error): PurchaseProcessingError => {
        if (error._tag === "PurchasePortError") {
          return new PurchaseProcessingServiceError({ cause: describePurchaseErrorCause(error) });
        }
        return error;
      }),
    );

  const publish = (projectId: string, builder: WebhookBuilder) => {
    if (builder === null) return Effect.void;
    return Effect.sync(builder).pipe(
      Effect.flatMap((event) => publisher.publish({ ...event, projectId })),
      Effect.catchCause((cause) =>
        Effect.logWarning("failed to publish purchase refund event", { cause, projectId }),
      ),
    );
  };

  const refundPurchase = (input: typeof RefundPurchaseInput.Type) =>
    mapErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        const outcome = yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const claim = yield* reserve(ledger, input);
            if (claim._tag === "duplicate") return { event: null, result: claim.result };

            if (input.partialRefundMoney !== undefined) {
              const partialRefundMoney = input.partialRefundMoney;
              const result = yield* stageRevenue({
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
              return { event: null, result };
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
                const key = providerKey(input);
                yield* Effect.logWarning(
                  `refundPurchase: purchase row watermark rejected (providerKey=${Option.getOrElse(key, () => "—")}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isNone(providerKey(input))) {
              yield* Effect.logWarning(
                "refundPurchase: no purchase provider key; skipping purchase row update",
              );
            }
            if (transaction === undefined && purchase === undefined) {
              yield* Effect.logWarning(
                "refundPurchase: no transaction and no purchase row for the refund subject; finalizing an empty ledger row without analytics",
              );
              const result = emptyResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return { event: null, result };
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (purchaseUpdated) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            let money = Option.none<ReturnType<typeof moneyFromStoredTransaction>>();
            if (transaction !== undefined) {
              money = Option.some(moneyFromStoredTransaction(transaction));
            }
            let purchaseId = Option.none<string>();
            if (purchase !== undefined) purchaseId = Option.some(purchase.id);
            const result = yield* stageRevenue({
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
                  webhookContext(context),
                );
            }
            return { event, result };
          }),
        );
        yield* publish(input.projectId, outcome.event);
        return outcome.result;
      }),
    );

  const revokePurchase = (input: typeof RevokePurchaseInput.Type) =>
    mapErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        const key = providerKey(input);
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
            const claim = yield* reserve(ledger, input);
            if (claim._tag === "duplicate") return claim.result;
            const purchase = yield* findPurchase(txRepository, input, context);
            if (purchase === undefined) {
              const result = emptyResult(context.personId);
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
            let money = Option.none<ReturnType<typeof moneyFromStoredTransaction>>();
            if (transaction !== undefined) {
              money = Option.some(moneyFromStoredTransaction(transaction));
            }
            return yield* stageRevenue({
              action: input,
              buildEvents: (mapperContext) =>
                toPurchaseRevokedAnalyticsInputs(
                  {
                    ...input,
                    money,
                  },
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
    mapErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
        const context = yield* resolveContext(input);
        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const claim = yield* reserve(ledger, input);
            if (claim._tag === "duplicate") return claim.result;
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
                const key = providerKey(input);
                yield* Effect.logWarning(
                  `reverseRefund: purchase row watermark rejected (providerKey=${Option.getOrElse(key, () => "—")}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
            } else if (Option.isNone(providerKey(input))) {
              yield* Effect.logWarning(
                "reverseRefund: no purchase provider key; skipping purchase row update",
              );
            }
            if (transaction === undefined && purchase === undefined) {
              yield* Effect.logWarning(
                "reverseRefund: no transaction and no purchase row for the reversal subject; finalizing an empty ledger row without analytics",
              );
              const result = emptyResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return result;
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (purchaseUpdated) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            let money = Option.none<ReturnType<typeof moneyFromStoredTransaction>>();
            if (transaction !== undefined) {
              money = Option.some(moneyFromStoredTransaction(transaction));
            }
            return yield* stageRevenue({
              action: input,
              buildEvents: (mapperContext) =>
                toRefundReversedAnalyticsInputs(
                  {
                    ...input,
                    money,
                  },
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
});

/** Core state-machine slice for refunds, refund reversals, and purchase revocations. */
export class PurchaseRefundStateMachine extends Context.Service<
  PurchaseRefundStateMachine,
  PurchaseRefundStateMachineShape
>()("@voidhash/core-v2/purchases/PurchaseRefundStateMachine", {
  make: makePurchaseRefundStateMachine,
}) {
  static readonly layer = Layer.effect(PurchaseRefundStateMachine)(PurchaseRefundStateMachine.make);
}
