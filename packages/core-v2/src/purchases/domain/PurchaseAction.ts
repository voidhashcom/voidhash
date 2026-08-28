import { Schema } from "effect";

import { PaymentProviderId } from "./ProviderConfiguration.ts";
import { PurchaseEventSource, PurchaseProcessingMoney } from "./PurchaseProcessing.ts";
import { SubscriptionTransferMode } from "./SubscriptionTransfer.ts";

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const ProviderEnvironment = Schema.Literals([1, 2, 3]);

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

export const StartSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  startsAt: Schema.Date,
  expiresAt: Schema.Option(Schema.Date),
  purchasedAt: Schema.Date,
  isTrial: Schema.Boolean,
});

export const RenewSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  startsAt: Schema.Date,
  expiresAt: Schema.Option(Schema.Date),
  renewedAt: Schema.Date,
  isTrial: Schema.Boolean,
});

export const CancelSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  canceledAt: Schema.Date,
  cancelAtPeriodEnd: Schema.Boolean,
  cancellationReason: Schema.Option(Schema.String),
});

export const ExpireSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  expiredAt: Schema.Date,
});

export const RevokeSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  revokedAt: Schema.Date,
  revocationReason: Schema.Option(Schema.String),
});

export const CompleteOneTimePurchaseInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  purchasedAt: Schema.Date,
  purchaseType: Schema.Literals(["one-time", "consumable"]),
});

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

export const RevokePurchaseInput = Schema.Struct({
  ...purchaseActionFields,
  revokedAt: Schema.Date,
  revocationReason: Schema.Option(Schema.String),
});

export const ReverseRefundInput = Schema.Struct({
  ...purchaseActionFields,
  reversedAt: Schema.Date,
});

export const EnterBillingRetryInput = Schema.Struct({
  ...purchaseActionFields,
  billingRetryAt: Schema.Date,
  gracePeriodExpiresAt: Schema.Option(Schema.Date),
});

export const ExtendSubscriptionInput = Schema.Struct({
  ...purchaseActionFields,
  extendedTo: Schema.Date,
});

export const ChangeRenewalPreferenceInput = Schema.Struct({
  ...purchaseActionFields,
  newProviderProductKey: NonEmptyString,
  newPaymentProviderConfigurationProductId: Schema.Option(NonEmptyString),
});

export const RedeemOfferInput = Schema.Struct({
  ...purchaseActionFields,
  offerId: Schema.Option(Schema.String),
  redeemedAt: Schema.Date,
});

export const RecordPriceIncreaseInput = Schema.Struct({
  ...purchaseActionFields,
  money: Schema.Option(PurchaseProcessingMoney),
  effectiveAt: Schema.Option(Schema.Date),
});

export const ResumeAutoRenewInput = Schema.Struct({
  ...purchaseActionFields,
  resumedAt: Schema.Date,
});

export const SubscriptionTransferTriggerReason = Schema.Literals(["appstore_restore", "manual"]);

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

export const TransferPurchaseInput = Schema.Struct({
  purchaseId: NonEmptyString,
  ...transferFields,
});
