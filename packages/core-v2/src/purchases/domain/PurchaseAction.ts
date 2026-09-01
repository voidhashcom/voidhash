import * as Schema from "effect/Schema";

import { PaymentProviderId } from "./ProviderConfiguration.ts";
import { PurchaseEventSource, PurchaseProcessingMoney } from "./PurchaseProcessing.ts";
import { SubscriptionTransferMode } from "./SubscriptionTransfer.ts";

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const ProviderEnvironment = Schema.Literals([1, 2, 3]);
export type ProviderEnvironment = typeof ProviderEnvironment.Type;

const purchaseActionFields = {
  providerId: PaymentProviderId,
  source: PurchaseEventSource,
  projectId: NonEmptyString,
  organizationId: NonEmptyString,
  paymentProviderConfigurationId: NonEmptyString,
  paymentProviderConfigurationProductId: NonEmptyString,
  personId: NonEmptyString,
  providerEnvironment: ProviderEnvironment,
  providerEventType: NonEmptyString,
  providerTransactionId: Schema.Option(NonEmptyString),
  providerSubscriptionId: Schema.Option(NonEmptyString),
  providerWebhookNotificationId: Schema.Option(NonEmptyString),
  occurredAt: Schema.Date,
  receivedAt: Schema.Date,
  rawProviderPayload: Schema.Option(Schema.Unknown),
  idempotencyKey: NonEmptyString,
};

export const PurchaseActionContext = Schema.Struct(purchaseActionFields);
export type PurchaseActionContext = typeof PurchaseActionContext.Type;

export const StartSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  startsAt: Schema.Date,
  expiresAt: Schema.Option(Schema.Date),
  purchasedAt: Schema.Date,
  isTrial: Schema.Boolean,
});
export type StartSubscriptionInput = typeof StartSubscriptionInput.Type;

export const RenewSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  startsAt: Schema.Date,
  expiresAt: Schema.Option(Schema.Date),
  renewedAt: Schema.Date,
  isTrial: Schema.Boolean,
});
export type RenewSubscriptionInput = typeof RenewSubscriptionInput.Type;

const CancelSubscriptionInputValue = Schema.Struct({
  ...purchaseActionFields,
  canceledAt: Schema.Date,
  isCancelAtPeriodEnd: Schema.Boolean,
  cancellationReason: Schema.Option(Schema.String),
});
export const CancelSubscriptionInput = CancelSubscriptionInputValue.pipe(
  Schema.encodeKeys({ isCancelAtPeriodEnd: "cancelAtPeriodEnd" }),
);
export type CancelSubscriptionInput = typeof CancelSubscriptionInput.Type;

export const ExpireSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  expiredAt: Schema.Date,
});
export type ExpireSubscriptionInput = typeof ExpireSubscriptionInput.Type;

export const RevokeSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  revokedAt: Schema.Date,
  revocationReason: Schema.Option(Schema.String),
});
export type RevokeSubscriptionInput = typeof RevokeSubscriptionInput.Type;

export const CompleteOneTimePurchaseInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  purchasedAt: Schema.Date,
  purchaseType: Schema.Literals(["one-time", "consumable"]),
});
export type CompleteOneTimePurchaseInput = typeof CompleteOneTimePurchaseInput.Type;

export const RefundPurchaseInput = Schema.Struct({
  ...purchaseActionFields,
  refundedAt: Schema.Date,
  refundReason: Schema.Option(Schema.String),
  /**
   * Present for a PARTIAL refund: the newly-refunded delta amounts. The
   * projection rows and entitlement are left untouched; only the
   * ledger/analytics event is emitted with these amounts.
   */
  partialRefundMoney: Schema.optional(PurchaseProcessingMoney),
});
export type RefundPurchaseInput = typeof RefundPurchaseInput.Type;

export const RevokePurchaseInput = Schema.Struct({
  ...purchaseActionFields,
  revokedAt: Schema.Date,
  revocationReason: Schema.Option(Schema.String),
});
export type RevokePurchaseInput = typeof RevokePurchaseInput.Type;

export const ReverseRefundInput = Schema.Struct({
  ...purchaseActionFields,
  reversedAt: Schema.Date,
});
export type ReverseRefundInput = typeof ReverseRefundInput.Type;

export const EnterBillingRetryInput = Schema.Struct({
  ...purchaseActionFields,
  billingRetryAt: Schema.Date,
  gracePeriodExpiresAt: Schema.Option(Schema.Date),
});
export type EnterBillingRetryInput = typeof EnterBillingRetryInput.Type;

export const ExtendSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  extendedTo: Schema.Date,
});
export type ExtendSubscriptionInput = typeof ExtendSubscriptionInput.Type;

export const ChangeRenewalPreferenceInput = Schema.Struct({
  ...purchaseActionFields,
  newProviderProductKey: NonEmptyString,
  newPaymentProviderConfigurationProductId: Schema.Option(NonEmptyString),
});
export type ChangeRenewalPreferenceInput = typeof ChangeRenewalPreferenceInput.Type;

export const RedeemOfferInput = Schema.Struct({
  ...purchaseActionFields,
  offerId: Schema.Option(Schema.String),
  redeemedAt: Schema.Date,
});
export type RedeemOfferInput = typeof RedeemOfferInput.Type;

export const RecordPriceIncreaseInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  effectiveAt: Schema.Option(Schema.Date),
});
export type RecordPriceIncreaseInput = typeof RecordPriceIncreaseInput.Type;

export const ResumeAutoRenewInput = Schema.Struct({
  ...purchaseActionFields,
  resumedAt: Schema.Date,
});
export type ResumeAutoRenewInput = typeof ResumeAutoRenewInput.Type;

export const SubscriptionTransferTriggerReason = Schema.Literals(["appstore_restore", "manual"]);
export type SubscriptionTransferTriggerReason = typeof SubscriptionTransferTriggerReason.Type;

const transferFields = {
  fromPersonId: NonEmptyString,
  toPersonId: NonEmptyString,
  transferMode: SubscriptionTransferMode,
  providerId: PaymentProviderId,
  paymentProviderConfigurationId: NonEmptyString,
  projectId: NonEmptyString,
  organizationId: NonEmptyString,
  occurredAt: Schema.Date,
  source: PurchaseEventSource,
  triggerReason: SubscriptionTransferTriggerReason,
};

export const TransferSubscriptionInput = Schema.Struct({
  subscriptionId: NonEmptyString,
  ...transferFields,
});
export type TransferSubscriptionInput = typeof TransferSubscriptionInput.Type;

export const TransferPurchaseInput = Schema.Struct({
  purchaseId: NonEmptyString,
  ...transferFields,
});
export type TransferPurchaseInput = typeof TransferPurchaseInput.Type;
