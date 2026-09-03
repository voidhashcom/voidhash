import { SubscriptionStatus } from "@voidhash/lib";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

import {
  EntitlementSync,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  type PurchaseSubscriptionUpdate,
} from "../../application/ports.ts";
import type {
  ChangeRenewalPreferenceInput,
  EnterBillingRetryInput,
  ExtendSubscriptionInput,
  PurchaseActionContext,
  RecordPriceIncreaseInput,
  RedeemOfferInput,
  ResumeAutoRenewInput,
} from "../../domain/PurchaseAction.ts";
import type { PurchaseProcessingError } from "../../application/ports/PurchaseStateStore.ts";
import { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import type { RevenueEvent } from "../../contract/RevenueEvents.ts";
import { purchaseActionSpanAttributes } from "../domain/PurchaseProcessingHelpers.ts";
import {
  toAutoRenewResumedAnalyticsInputs,
  toBillingRetryAnalyticsInputs,
  toExtendedAnalyticsInputs,
  toOfferRedeemedAnalyticsInputs,
  toPriceIncreaseAnalyticsInputs,
  toRenewalPreferenceChangeAnalyticsInputs,
  type RevenueAnalyticsMapperContext,
} from "../domain/RevenueEventMapper.ts";
import {
  emptyPurchaseResult,
  mapPurchasePortErrors,
  reservePurchaseLedgerRow,
  resolvePurchaseContext,
  stagePurchaseRevenue,
  storeSubscriptionIdOf,
  subscriptionIdentifierError,
} from "./PurchaseActionSupport.ts";

type Action = typeof PurchaseActionContext.Type;
type SubscriptionPatch = Omit<PurchaseSubscriptionUpdate, "id" | "occurredAt">;

interface ApplyMutationInput<I extends Action> {
  readonly action: I;
  readonly buildEvents: (
    result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
    context: RevenueAnalyticsMapperContext,
  ) => ReadonlyArray<RevenueEvent>;
  readonly buildPatch: (existing: {
    readonly expiresAt: Option.Option<Date>;
    readonly id: string;
    readonly status: number;
  }) => SubscriptionPatch;
  readonly methodName: string;
  readonly syncPerksOnApply: boolean;
}

export interface PurchaseSubscriptionMutationMachineShape {
  readonly enterBillingRetry: (
    input: typeof EnterBillingRetryInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly extendSubscription: (
    input: typeof ExtendSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly changeRenewalPreference: (
    input: typeof ChangeRenewalPreferenceInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly redeemOffer: (
    input: typeof RedeemOfferInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly recordPriceIncrease: (
    input: typeof RecordPriceIncreaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly resumeAutoRenew: (
    input: typeof ResumeAutoRenewInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

const makePurchaseSubscriptionMutationMachine = Effect.fn(
  "makePurchaseSubscriptionMutationMachine",
)(function* () {
  const ids = yield* PurchaseIdGenerator;
  const repository = yield* PurchaseStateRepository;
  const unitOfWork = yield* PurchaseUnitOfWork;

  const applyMutation = <I extends Action>(input: ApplyMutationInput<I>) =>
    mapPurchasePortErrors(
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input.action));
        const context = yield* resolvePurchaseContext(repository, input.action);
        const storeSubscriptionId = storeSubscriptionIdOf(input.action);
        if (Option.isNone(storeSubscriptionId)) {
          return yield* subscriptionIdentifierError(input.action);
        }

        return yield* unitOfWork.transact(
          Effect.gen(function* () {
            const txRepository = yield* PurchaseStateRepository;
            const ledger = yield* PurchaseLedgerWriteStore;
            const entitlements = yield* EntitlementSync;
            const claim = yield* reservePurchaseLedgerRow(ids, ledger, input.action);
            if (P.hasProperty(claim, "result")) return claim.result;

            const existing = yield* txRepository.findSubscriptionSeries({
              paymentProviderConfigurationId: input.action.paymentProviderConfigurationId,
              paymentProviderConfigurationProductId: context.configurationProduct.id,
              storeSubscriptionId: storeSubscriptionId.value,
            });
            if (existing === undefined) {
              const result = emptyPurchaseResult(context.personId);
              yield* ledger.finalize({ reservation: claim.reservation, result });
              return result;
            }

            const updated = yield* txRepository.updateSubscriptionIfFresher({
              ...input.buildPatch({
                ...existing,
                expiresAt: Option.fromNullishOr(existing.expiresAt),
              }),
              id: existing.id,
              occurredAt: input.action.occurredAt,
            });
            if (updated.affectedRows === 0) {
              yield* Effect.logInfo(
                `${input.methodName}: stale event; watermark guard rejected projection update (subscriptionId=${existing.id}, occurredAt=${input.action.occurredAt.toISOString()})`,
              );
            }
            let changedGrantIds: ReadonlyArray<string> = [];
            if (input.syncPerksOnApply) {
              changedGrantIds = yield* entitlements.syncUnlockedPerks(context.personId);
            }
            return yield* stagePurchaseRevenue({
              action: input.action,
              buildEvents: (mapperContext) =>
                input.buildEvents(
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

  return {
    changeRenewalPreference: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) =>
          toRenewalPreferenceChangeAnalyticsInputs(input, result, context),
        buildPatch: () =>
          Option.match(input.newPaymentProviderConfigurationProductId, {
            onNone: () => ({}),
            onSome: (pendingProductChangeId) => ({ pendingProductChangeId }),
          }),
        methodName: "changeRenewalPreference",
        syncPerksOnApply: false,
      }),
    enterBillingRetry: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toBillingRetryAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          billingRetryAt: input.billingRetryAt,
          gracePeriodExpiresAt: Option.getOrNull(input.gracePeriodExpiresAt),
        }),
        methodName: "enterBillingRetry",
        syncPerksOnApply: false,
      }),
    extendSubscription: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toExtendedAnalyticsInputs(input, result, context),
        buildPatch: () => ({ expiresAt: input.extendedTo, extendedTo: input.extendedTo }),
        methodName: "extendSubscription",
        syncPerksOnApply: false,
      }),
    recordPriceIncrease: (input) => {
      const money = Option.getOrUndefined(input.money);
      return applyMutation({
        action: input,
        buildEvents: (result, context) => toPriceIncreaseAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          pendingPriceAmount: money?.grossAmount ?? null,
          pendingPriceCurrency: money?.currency ?? null,
          pendingPriceEffectiveAt: Option.getOrNull(input.effectiveAt),
        }),
        methodName: "recordPriceIncrease",
        syncPerksOnApply: false,
      });
    },
    redeemOffer: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toOfferRedeemedAnalyticsInputs(input, result, context),
        buildPatch: () => ({
          redeemedOfferAt: input.redeemedAt,
          redeemedOfferId: Option.getOrNull(input.offerId),
        }),
        methodName: "redeemOffer",
        syncPerksOnApply: false,
      }),
    resumeAutoRenew: (input) =>
      applyMutation({
        action: input,
        buildEvents: (result, context) => toAutoRenewResumedAnalyticsInputs(input, result, context),
        buildPatch: (existing) => {
          const periodStillRunning =
            Option.isNone(existing.expiresAt) ||
            existing.expiresAt.value.getTime() > input.occurredAt.getTime();
          const patch: SubscriptionPatch = {
            canceledAt: null,
            cancellationReason: null,
            isCancelAtPeriodEnd: false,
          };
          if (periodStillRunning) return { ...patch, status: SubscriptionStatus.Active };
          return patch;
        },
        methodName: "resumeAutoRenew",
        syncPerksOnApply: true,
      }),
  } satisfies PurchaseSubscriptionMutationMachineShape;
})();

/** Core state-machine slice for subscription metadata transitions. */
export class PurchaseSubscriptionMutationMachine extends Context.Service<
  PurchaseSubscriptionMutationMachine,
  PurchaseSubscriptionMutationMachineShape
>()("@voidhash/core-v2/purchases/PurchaseSubscriptionMutationMachine", {
  make: makePurchaseSubscriptionMutationMachine,
}) {
  static readonly layer = Layer.effect(PurchaseSubscriptionMutationMachine)(
    PurchaseSubscriptionMutationMachine.make,
  );
}
