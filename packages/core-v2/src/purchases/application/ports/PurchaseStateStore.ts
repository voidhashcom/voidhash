import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type {
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
import type { PurchaseProcessingResult } from "../../domain/PurchaseProcessing.ts";

export class PurchaseProcessingServiceError extends Schema.TaggedErrorClass<PurchaseProcessingServiceError>(
  "PurchaseProcessingServiceError",
)("PurchaseProcessingServiceError", { cause: Schema.String }) {}

export class PurchaseProcessingProductNotMappedError extends Schema.TaggedErrorClass<PurchaseProcessingProductNotMappedError>(
  "PurchaseProcessingProductNotMappedError",
)("PurchaseProcessingProductNotMappedError", {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderConfigurationProductId: Schema.String,
}) {}

export type PurchaseProcessingError =
  | PurchaseProcessingServiceError
  | PurchaseProcessingProductNotMappedError;

export interface PurchaseStateStoreShape {
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
  readonly refundPurchase: (
    input: typeof RefundPurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly revokePurchase: (
    input: typeof RevokePurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly reverseRefund: (
    input: typeof ReverseRefundInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
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
  readonly transferSubscription: (
    input: typeof TransferSubscriptionInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
  readonly transferPurchase: (
    input: typeof TransferPurchaseInput.Type,
  ) => Effect.Effect<PurchaseProcessingResult, PurchaseProcessingError>;
}

export class PurchaseStateStore extends Context.Service<
  PurchaseStateStore,
  PurchaseStateStoreShape
>()("@voidhash/core-v2/purchases/PurchaseStateStore") {}
