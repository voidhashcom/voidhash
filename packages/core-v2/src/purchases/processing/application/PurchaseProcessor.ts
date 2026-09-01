import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  CancelSubscriptionInput,
  ChangeRenewalPreferenceInput,
  CompleteOneTimePurchaseInput,
  EnterBillingRetryInput,
  ExpireSubscriptionInput,
  ExtendSubscriptionInput,
  RecordPriceIncreaseInput,
  RedeemOfferInput,
  RefundPurchaseInput,
  RenewSubscriptionInput,
  ResumeAutoRenewInput,
  ReverseRefundInput,
  RevokePurchaseInput,
  RevokeSubscriptionInput,
  StartSubscriptionInput,
  TransferPurchaseInput,
  TransferSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import {
  PurchaseProcessingServiceError,
  PurchaseStateStore,
  type PurchaseStateStoreShape,
} from "../../application/ports/PurchaseStateStore.ts";

export type PurchaseProcessorShape = {
  readonly [Method in keyof PurchaseStateStoreShape]: (
    input: unknown,
  ) => ReturnType<PurchaseStateStoreShape[Method]>;
};

const makePurchaseProcessor = Effect.fn("makePurchaseProcessor")(function* () {
  const store = yield* PurchaseStateStore;
  const decodeAction = <S extends Schema.Top>(schema: S, input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.mapError((error) => new PurchaseProcessingServiceError({ cause: String(error) })),
    );

  return {
    startSubscription: (input) =>
      decodeAction(StartSubscriptionInput, input).pipe(Effect.flatMap(store.startSubscription)),
    renewSubscription: (input) =>
      decodeAction(RenewSubscriptionInput, input).pipe(Effect.flatMap(store.renewSubscription)),
    cancelSubscription: (input) =>
      decodeAction(CancelSubscriptionInput, input).pipe(Effect.flatMap(store.cancelSubscription)),
    expireSubscription: (input) =>
      decodeAction(ExpireSubscriptionInput, input).pipe(Effect.flatMap(store.expireSubscription)),
    revokeSubscription: (input) =>
      decodeAction(RevokeSubscriptionInput, input).pipe(Effect.flatMap(store.revokeSubscription)),
    completeOneTimePurchase: (input) =>
      decodeAction(CompleteOneTimePurchaseInput, input).pipe(
        Effect.flatMap(store.completeOneTimePurchase),
      ),
    refundPurchase: (input) =>
      decodeAction(RefundPurchaseInput, input).pipe(Effect.flatMap(store.refundPurchase)),
    revokePurchase: (input) =>
      decodeAction(RevokePurchaseInput, input).pipe(Effect.flatMap(store.revokePurchase)),
    reverseRefund: (input) =>
      decodeAction(ReverseRefundInput, input).pipe(Effect.flatMap(store.reverseRefund)),
    enterBillingRetry: (input) =>
      decodeAction(EnterBillingRetryInput, input).pipe(Effect.flatMap(store.enterBillingRetry)),
    extendSubscription: (input) =>
      decodeAction(ExtendSubscriptionInput, input).pipe(Effect.flatMap(store.extendSubscription)),
    changeRenewalPreference: (input) =>
      decodeAction(ChangeRenewalPreferenceInput, input).pipe(
        Effect.flatMap(store.changeRenewalPreference),
      ),
    redeemOffer: (input) =>
      decodeAction(RedeemOfferInput, input).pipe(Effect.flatMap(store.redeemOffer)),
    recordPriceIncrease: (input) =>
      decodeAction(RecordPriceIncreaseInput, input).pipe(Effect.flatMap(store.recordPriceIncrease)),
    resumeAutoRenew: (input) =>
      decodeAction(ResumeAutoRenewInput, input).pipe(Effect.flatMap(store.resumeAutoRenew)),
    transferSubscription: (input) =>
      decodeAction(TransferSubscriptionInput, input).pipe(
        Effect.flatMap(store.transferSubscription),
      ),
    transferPurchase: (input) =>
      decodeAction(TransferPurchaseInput, input).pipe(Effect.flatMap(store.transferPurchase)),
  } satisfies PurchaseProcessorShape;
})();

export class PurchaseProcessor extends Context.Service<PurchaseProcessor, PurchaseProcessorShape>()(
  "@voidhash/core-v2/purchases/PurchaseProcessor",
  { make: makePurchaseProcessor },
) {
  static readonly layer = Layer.effect(PurchaseProcessor)(PurchaseProcessor.make);
}
