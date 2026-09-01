import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type PurchaseProcessingError,
  type PurchaseStateStoreShape,
} from "../../application/ports/PurchaseStateStore.ts";
import type {
  PurchaseActionContext,
  TransferPurchaseInput,
  TransferSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import type { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";
import {
  purchaseActionSpanAttributes,
  purchaseProcessingResultSpanAttributes,
  transferSpanAttributes,
} from "../domain/PurchaseProcessingHelpers.ts";
import { PurchaseLifecycleStateMachine } from "./PurchaseLifecycleStateMachine.ts";
import { PurchaseRefundStateMachine } from "./PurchaseRefundStateMachine.ts";
import { PurchaseSubscriptionMutationMachine } from "./PurchaseSubscriptionMutationMachine.ts";
import { PurchaseTransferStateMachine } from "./PurchaseTransferStateMachine.ts";

const makePurchaseStateMachine = Effect.fn("makePurchaseStateMachine")(function* () {
  const lifecycle = yield* PurchaseLifecycleStateMachine;
  const refunds = yield* PurchaseRefundStateMachine;
  const subscriptionMutations = yield* PurchaseSubscriptionMutationMachine;
  const transfers = yield* PurchaseTransferStateMachine;

  const observeAction = <I extends typeof PurchaseActionContext.Type>(
    handler: (input: I) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>,
    input: I,
  ) =>
    Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input)).pipe(
      Effect.andThen(handler(input)),
      Effect.tap((result) =>
        Effect.annotateCurrentSpan(purchaseProcessingResultSpanAttributes(result)),
      ),
    );

  const observeTransfer = <
    I extends typeof TransferSubscriptionInput.Type | typeof TransferPurchaseInput.Type,
  >(
    handler: (input: I) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>,
    input: I,
  ) =>
    Effect.annotateCurrentSpan(transferSpanAttributes(input)).pipe(
      Effect.andThen(handler(input)),
      Effect.tap((result) =>
        Effect.annotateCurrentSpan(purchaseProcessingResultSpanAttributes(result)),
      ),
    );

  return {
    cancelSubscription: (input) => observeAction(lifecycle.cancelSubscription, input),
    changeRenewalPreference: (input) =>
      observeAction(subscriptionMutations.changeRenewalPreference, input),
    completeOneTimePurchase: (input) => observeAction(lifecycle.completeOneTimePurchase, input),
    enterBillingRetry: (input) => observeAction(subscriptionMutations.enterBillingRetry, input),
    expireSubscription: (input) => observeAction(lifecycle.expireSubscription, input),
    extendSubscription: (input) => observeAction(subscriptionMutations.extendSubscription, input),
    recordPriceIncrease: (input) => observeAction(subscriptionMutations.recordPriceIncrease, input),
    redeemOffer: (input) => observeAction(subscriptionMutations.redeemOffer, input),
    refundPurchase: (input) => observeAction(refunds.refundPurchase, input),
    renewSubscription: (input) => observeAction(lifecycle.renewSubscription, input),
    resumeAutoRenew: (input) => observeAction(subscriptionMutations.resumeAutoRenew, input),
    reverseRefund: (input) => observeAction(refunds.reverseRefund, input),
    revokePurchase: (input) => observeAction(refunds.revokePurchase, input),
    revokeSubscription: (input) => observeAction(lifecycle.revokeSubscription, input),
    startSubscription: (input) => observeAction(lifecycle.startSubscription, input),
    transferPurchase: (input) => observeTransfer(transfers.transferPurchase, input),
    transferSubscription: (input) => observeTransfer(transfers.transferSubscription, input),
  } satisfies PurchaseStateStoreShape;
})();

/** Provider-neutral transactional state machine implementing all normalized purchase actions. */
export class PurchaseStateMachine extends Context.Service<
  PurchaseStateMachine,
  PurchaseStateStoreShape
>()("@voidhash/core-v2/purchases/PurchaseStateMachine", { make: makePurchaseStateMachine }) {
  static readonly layer = Layer.effect(PurchaseStateMachine)(PurchaseStateMachine.make);
}
