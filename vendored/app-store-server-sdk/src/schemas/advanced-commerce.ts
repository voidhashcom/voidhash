import * as Schema from "effect/Schema";
import {
  AdvancedCommerceEffectiveSchema,
  AdvancedCommerceOfferPeriodSchema,
  AdvancedCommerceOfferReasonSchema,
  AdvancedCommercePeriodSchema,
  AdvancedCommercePriceIncreaseInfoStatusSchema,
  AdvancedCommerceReasonSchema,
  AdvancedCommerceRefundReasonSchema,
  AdvancedCommerceRefundTypeSchema,
  AutoRenewStatusSchema,
  RenewalBillingPlanTypeSchema,
} from "./enums.ts";

/**
 * The display name and description of a subscription product.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/descriptors
 */
export const AdvancedCommerceDescriptorsCodec = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
});
export type AdvancedCommerceDescriptorsCodec = typeof AdvancedCommerceDescriptorsCodec.Type;

export type AdvancedCommerceDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceDescriptorsCodec
>;

/**
 * Discount offer for an auto-renewable subscription via Advanced Commerce API.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/offer
 */
export const AdvancedCommerceOfferCodec = Schema.Struct({
  period: Schema.Union([AdvancedCommerceOfferPeriodSchema, Schema.String]),
  periodCount: Schema.Number,
  price: Schema.Number,
  reason: Schema.Union([AdvancedCommerceOfferReasonSchema, Schema.String]),
});
export type AdvancedCommerceOfferCodec = typeof AdvancedCommerceOfferCodec.Type;

export type AdvancedCommerceOffer = Schema.Schema.Type<typeof AdvancedCommerceOfferCodec>;

/**
 * Metadata included in every Advanced Commerce request.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/requestinfo
 */
export const AdvancedCommerceRequestInfoCodec = Schema.Struct({
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),
  consistencyToken: Schema.OptionFromOptionalKey(Schema.String),
  requestReferenceId: Schema.String,
});
export type AdvancedCommerceRequestInfoCodec = typeof AdvancedCommerceRequestInfoCodec.Type;

export type AdvancedCommerceRequestInfo = Schema.Schema.Type<
  typeof AdvancedCommerceRequestInfoCodec
>;

/** Base shape for items identified by SKU. */
export const AdvancedCommerceBaseItem = Schema.Struct({
  SKU: Schema.String,
});
export type AdvancedCommerceBaseItem = typeof AdvancedCommerceBaseItem.Type;

/** Item with description and display name extension. */
export const AdvancedCommerceItem = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});
export type AdvancedCommerceItem = typeof AdvancedCommerceItem.Type;

/**
 * One-time charge product details.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/onetimechargeitem
 */
export const AdvancedCommerceOneTimeChargeItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  price: Schema.Number,
});
export type AdvancedCommerceOneTimeChargeItemCodec = typeof AdvancedCommerceOneTimeChargeItemCodec.Type;

export type AdvancedCommerceOneTimeChargeItem = Schema.Schema.Type<
  typeof AdvancedCommerceOneTimeChargeItemCodec
>;

/**
 * Subscription item used in create requests.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptioncreateitem
 */
export const AdvancedCommerceSubscriptionCreateItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferCodec),
  price: Schema.Number,
});
export type AdvancedCommerceSubscriptionCreateItemCodec = typeof AdvancedCommerceSubscriptionCreateItemCodec.Type;

export type AdvancedCommerceSubscriptionCreateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCreateItemCodec
>;

/**
 * Refund target item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/refunditem
 */
export const AdvancedCommerceRequestRefundItemCodec = Schema.Struct({
  SKU: Schema.String,
  refundReason: Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  refundType: Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  revoke: Schema.OptionFromOptionalKey(Schema.Boolean),
  refundAmount: Schema.OptionFromOptionalKey(Schema.Number),
});
export type AdvancedCommerceRequestRefundItemCodec = typeof AdvancedCommerceRequestRefundItemCodec.Type;

export type AdvancedCommerceRequestRefundItem = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundItemCodec
>;

/**
 * Price-increase information for an Advanced Commerce subscription renewal.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercepriceincreaseinfo
 */
export const AdvancedCommercePriceIncreaseInfoCodec = Schema.Struct({
  dependentSKUs: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  status: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommercePriceIncreaseInfoStatusSchema, Schema.String]),
  ),
});
export type AdvancedCommercePriceIncreaseInfoCodec = typeof AdvancedCommercePriceIncreaseInfoCodec.Type;

export type AdvancedCommercePriceIncreaseInfo = Schema.Schema.Type<
  typeof AdvancedCommercePriceIncreaseInfoCodec
>;

/**
 * Refund detail attached to a transaction item.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerefund
 */
export const AdvancedCommerceRefundCodec = Schema.Struct({
  refundAmount: Schema.OptionFromOptionalKey(Schema.Number),
  refundDate: Schema.OptionFromOptionalKey(Schema.Number),
  refundReason: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  ),
  refundType: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  ),
});
export type AdvancedCommerceRefundCodec = typeof AdvancedCommerceRefundCodec.Type;

export type AdvancedCommerceRefund = Schema.Schema.Type<typeof AdvancedCommerceRefundCodec>;

/**
 * Renewal item for Advanced Commerce renewals.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerenewalitem
 */
export const AdvancedCommerceRenewalItemCodec = Schema.Struct({
  SKU: Schema.OptionFromOptionalKey(Schema.String),
  description: Schema.OptionFromOptionalKey(Schema.String),
  displayName: Schema.OptionFromOptionalKey(Schema.String),
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferCodec),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  priceIncreaseInfo: Schema.OptionFromOptionalKey(AdvancedCommercePriceIncreaseInfoCodec),
});
export type AdvancedCommerceRenewalItemCodec = typeof AdvancedCommerceRenewalItemCodec.Type;

export type AdvancedCommerceRenewalItem = Schema.Schema.Type<
  typeof AdvancedCommerceRenewalItemCodec
>;

/**
 * Transaction item for Advanced Commerce transactions.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercetransactionitem
 */
export const AdvancedCommerceTransactionItemCodec = Schema.Struct({
  SKU: Schema.OptionFromOptionalKey(Schema.String),
  description: Schema.OptionFromOptionalKey(Schema.String),
  displayName: Schema.OptionFromOptionalKey(Schema.String),
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferCodec),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  refunds: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceRefundCodec)),
  revocationDate: Schema.OptionFromOptionalKey(Schema.Number),
});
export type AdvancedCommerceTransactionItemCodec = typeof AdvancedCommerceTransactionItemCodec.Type;

export type AdvancedCommerceTransactionItem = Schema.Schema.Type<
  typeof AdvancedCommerceTransactionItemCodec
>;

/**
 * Renewal info for Advanced Commerce subscriptions, embedded in JWSRenewalInfoDecodedPayload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerenewalinfo
 */
export const AdvancedCommerceRenewalInfoCodec = Schema.Struct({
  consistencyToken: Schema.OptionFromOptionalKey(Schema.String),
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceDescriptorsCodec),
  items: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceRenewalItemCodec)),
  period: Schema.OptionFromOptionalKey(Schema.Union([AdvancedCommercePeriodSchema, Schema.String])),
  requestReferenceId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.OptionFromOptionalKey(Schema.String),
});
export type AdvancedCommerceRenewalInfoCodec = typeof AdvancedCommerceRenewalInfoCodec.Type;

export type AdvancedCommerceRenewalInfo = Schema.Schema.Type<
  typeof AdvancedCommerceRenewalInfoCodec
>;

/**
 * Transaction info for Advanced Commerce transactions, embedded in JWSTransactionDecodedPayload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercetransactioninfo
 */
export const AdvancedCommerceTransactionInfoCodec = Schema.Struct({
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceDescriptorsCodec),
  estimatedTax: Schema.OptionFromOptionalKey(Schema.Number),
  items: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceTransactionItemCodec)),
  period: Schema.OptionFromOptionalKey(Schema.Union([AdvancedCommercePeriodSchema, Schema.String])),
  requestReferenceId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.OptionFromOptionalKey(Schema.String),
  taxExclusivePrice: Schema.OptionFromOptionalKey(Schema.Number),
  taxRate: Schema.OptionFromOptionalKey(Schema.String),
});
export type AdvancedCommerceTransactionInfoCodec = typeof AdvancedCommerceTransactionInfoCodec.Type;

export type AdvancedCommerceTransactionInfo = Schema.Schema.Type<
  typeof AdvancedCommerceTransactionInfoCodec
>;

/**
 * Renewal commitment info attached to renewal payload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/renewalcommitmentinfo
 */
export const RenewalCommitmentInfoCodec = Schema.Struct({
  commitmentAutoRenewProductId: Schema.OptionFromOptionalKey(Schema.String),
  commitmentAutoRenewStatus: Schema.OptionFromOptionalKey(
    Schema.Union([AutoRenewStatusSchema, Schema.Number]),
  ),
  commitmentRenewalBillingPlanType: Schema.OptionFromOptionalKey(
    Schema.Union([RenewalBillingPlanTypeSchema, Schema.String]),
  ),
  commitmentRenewalDate: Schema.OptionFromOptionalKey(Schema.Number),
  commitmentRenewalPrice: Schema.OptionFromOptionalKey(Schema.Number),
});
export type RenewalCommitmentInfoCodec = typeof RenewalCommitmentInfoCodec.Type;

export type RenewalCommitmentInfo = Schema.Schema.Type<typeof RenewalCommitmentInfoCodec>;

/**
 * Transaction-level commitment information.
 * @see https://developer.apple.com/documentation/appstoreserverapi/transactioncommitmentinfo
 */
export const TransactionCommitmentInfoCodec = Schema.Struct({
  billingPeriodNumber: Schema.OptionFromOptionalKey(Schema.Number),
  commitmentExpiresDate: Schema.OptionFromOptionalKey(Schema.Number),
  commitmentPrice: Schema.OptionFromOptionalKey(Schema.Number),
  totalBillingPeriods: Schema.OptionFromOptionalKey(Schema.Number),
});
export type TransactionCommitmentInfoCodec = typeof TransactionCommitmentInfoCodec.Type;

export type TransactionCommitmentInfo = Schema.Schema.Type<typeof TransactionCommitmentInfoCodec>;

// ===== Modify/Migrate item schemas =====

/**
 * Item added to a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyadditem
 */
export const AdvancedCommerceSubscriptionModifyAddItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferCodec),
  price: Schema.Number,
});
export type AdvancedCommerceSubscriptionModifyAddItemCodec = typeof AdvancedCommerceSubscriptionModifyAddItemCodec.Type;

export type AdvancedCommerceSubscriptionModifyAddItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyAddItemCodec
>;

/**
 * Item swapped within a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifychangeitem
 */
export const AdvancedCommerceSubscriptionModifyChangeItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  currentSKU: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferCodec),
  price: Schema.Number,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
  reason: Schema.Union([AdvancedCommerceReasonSchema, Schema.String]),
});
export type AdvancedCommerceSubscriptionModifyChangeItemCodec = typeof AdvancedCommerceSubscriptionModifyChangeItemCodec.Type;

export type AdvancedCommerceSubscriptionModifyChangeItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyChangeItemCodec
>;

/**
 * Item removed from a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyremoveitem
 */
export const AdvancedCommerceSubscriptionModifyRemoveItemCodec = Schema.Struct({
  SKU: Schema.String,
});
export type AdvancedCommerceSubscriptionModifyRemoveItemCodec = typeof AdvancedCommerceSubscriptionModifyRemoveItemCodec.Type;

export type AdvancedCommerceSubscriptionModifyRemoveItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyRemoveItemCodec
>;

/**
 * Period change request for modifying a subscription.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyperiodchange
 */
export const AdvancedCommerceSubscriptionModifyPeriodChangeCodec = Schema.Struct({
  period: Schema.Union([AdvancedCommercePeriodSchema, Schema.String]),
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});
export type AdvancedCommerceSubscriptionModifyPeriodChangeCodec = typeof AdvancedCommerceSubscriptionModifyPeriodChangeCodec.Type;

export type AdvancedCommerceSubscriptionModifyPeriodChange = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyPeriodChangeCodec
>;

/**
 * Descriptors used when modifying subscription metadata.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifydescriptors
 */
export const AdvancedCommerceSubscriptionModifyDescriptorsCodec = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});
export type AdvancedCommerceSubscriptionModifyDescriptorsCodec = typeof AdvancedCommerceSubscriptionModifyDescriptorsCodec.Type;

export type AdvancedCommerceSubscriptionModifyDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyDescriptorsCodec
>;

/**
 * Descriptors used when changing subscription metadata.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionchangemetadatadescriptors
 */
export const AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});
export type AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec = typeof AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec.Type;

export type AdvancedCommerceSubscriptionChangeMetadataDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec
>;

/**
 * Descriptors used during a subscription migration.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigratedescriptors
 */
export const AdvancedCommerceSubscriptionMigrateDescriptorsCodec = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
});
export type AdvancedCommerceSubscriptionMigrateDescriptorsCodec = typeof AdvancedCommerceSubscriptionMigrateDescriptorsCodec.Type;

export type AdvancedCommerceSubscriptionMigrateDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateDescriptorsCodec
>;

/**
 * Subscription metadata change item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionchangemetadataitem
 */
export const AdvancedCommerceSubscriptionChangeMetadataItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  currentSKU: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});
export type AdvancedCommerceSubscriptionChangeMetadataItemCodec = typeof AdvancedCommerceSubscriptionChangeMetadataItemCodec.Type;

export type AdvancedCommerceSubscriptionChangeMetadataItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataItemCodec
>;

/**
 * Reactivate subscription item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionreactivateitem
 */
export const AdvancedCommerceSubscriptionReactivateItemCodec = Schema.Struct({
  SKU: Schema.String,
});
export type AdvancedCommerceSubscriptionReactivateItemCodec = typeof AdvancedCommerceSubscriptionReactivateItemCodec.Type;

export type AdvancedCommerceSubscriptionReactivateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionReactivateItemCodec
>;

/**
 * Migrate item for subscription migrations.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigrateitem
 */
export const AdvancedCommerceSubscriptionMigrateItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});
export type AdvancedCommerceSubscriptionMigrateItemCodec = typeof AdvancedCommerceSubscriptionMigrateItemCodec.Type;

export type AdvancedCommerceSubscriptionMigrateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateItemCodec
>;

/**
 * Migrate renewal item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigraterenewalitem
 */
export const AdvancedCommerceSubscriptionMigrateRenewalItemCodec = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});
export type AdvancedCommerceSubscriptionMigrateRenewalItemCodec = typeof AdvancedCommerceSubscriptionMigrateRenewalItemCodec.Type;

export type AdvancedCommerceSubscriptionMigrateRenewalItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateRenewalItemCodec
>;

/**
 * Price change item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionpricechangeitem
 */
export const AdvancedCommerceSubscriptionPriceChangeItemCodec = Schema.Struct({
  SKU: Schema.String,
  price: Schema.Number,
  dependentSKUs: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  effective: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
  ),
});
export type AdvancedCommerceSubscriptionPriceChangeItemCodec = typeof AdvancedCommerceSubscriptionPriceChangeItemCodec.Type;

export type AdvancedCommerceSubscriptionPriceChangeItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeItemCodec
>;

// ===== Requests =====

const acRequestBase = {
  requestInfo: AdvancedCommerceRequestInfoCodec,
  storefront: Schema.OptionFromOptionalKey(Schema.String),
};

export const AdvancedCommerceOneTimeChargeCreateRequestCodec = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("CREATE_ONE_TIME_CHARGE")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  item: AdvancedCommerceOneTimeChargeItemCodec,
  taxCode: Schema.String,
});
export type AdvancedCommerceOneTimeChargeCreateRequestCodec = typeof AdvancedCommerceOneTimeChargeCreateRequestCodec.Type;

export type AdvancedCommerceOneTimeChargeCreateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceOneTimeChargeCreateRequestCodec
>;

export const AdvancedCommerceSubscriptionCreateRequestCodec = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("CREATE_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  descriptors: AdvancedCommerceDescriptorsCodec,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionCreateItemCodec),
  period: Schema.Union([AdvancedCommercePeriodSchema, Schema.String]),
  previousTransactionId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.String,
});
export type AdvancedCommerceSubscriptionCreateRequestCodec = typeof AdvancedCommerceSubscriptionCreateRequestCodec.Type;

export type AdvancedCommerceSubscriptionCreateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCreateRequestCodec
>;

export const AdvancedCommerceRequestRefundRequestCodec = Schema.Struct({
  ...acRequestBase,
  items: Schema.NonEmptyArray(AdvancedCommerceRequestRefundItemCodec),
  refundRiskingPreference: Schema.OptionFromOptionalKey(Schema.Boolean),
  currency: Schema.OptionFromOptionalKey(Schema.String),
});
export type AdvancedCommerceRequestRefundRequestCodec = typeof AdvancedCommerceRequestRefundRequestCodec.Type;

export type AdvancedCommerceRequestRefundRequest = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundRequestCodec
>;

export const AdvancedCommerceSubscriptionCancelRequestCodec = Schema.Struct({
  ...acRequestBase,
});
export type AdvancedCommerceSubscriptionCancelRequestCodec = typeof AdvancedCommerceSubscriptionCancelRequestCodec.Type;

export type AdvancedCommerceSubscriptionCancelRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCancelRequestCodec
>;

export const AdvancedCommerceSubscriptionRevokeRequestCodec = Schema.Struct({
  ...acRequestBase,
  refundRiskingPreference: Schema.OptionFromOptionalKey(Schema.Boolean),
  refundReason: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  ),
  refundType: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  ),
});
export type AdvancedCommerceSubscriptionRevokeRequestCodec = typeof AdvancedCommerceSubscriptionRevokeRequestCodec.Type;

export type AdvancedCommerceSubscriptionRevokeRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionRevokeRequestCodec
>;

export const AdvancedCommerceSubscriptionPriceChangeRequestCodec = Schema.Struct({
  ...acRequestBase,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionPriceChangeItemCodec),
  currency: Schema.OptionFromOptionalKey(Schema.String),
});
export type AdvancedCommerceSubscriptionPriceChangeRequestCodec = typeof AdvancedCommerceSubscriptionPriceChangeRequestCodec.Type;

export type AdvancedCommerceSubscriptionPriceChangeRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeRequestCodec
>;

export const AdvancedCommerceSubscriptionChangeMetadataRequestCodec = Schema.Struct({
  ...acRequestBase,
  items: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionChangeMetadataItemCodec),
  ),
  descriptors: Schema.OptionFromOptionalKey(
    AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec,
  ),
});
export type AdvancedCommerceSubscriptionChangeMetadataRequestCodec = typeof AdvancedCommerceSubscriptionChangeMetadataRequestCodec.Type;

export type AdvancedCommerceSubscriptionChangeMetadataRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataRequestCodec
>;

export const AdvancedCommerceSubscriptionMigrateRequestCodec = Schema.Struct({
  ...acRequestBase,
  descriptors: AdvancedCommerceSubscriptionMigrateDescriptorsCodec,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionMigrateItemCodec),
  taxCode: Schema.String,
  targetProductId: Schema.String,
  retainBillingCycle: Schema.OptionFromOptionalKey(Schema.Boolean),
});
export type AdvancedCommerceSubscriptionMigrateRequestCodec = typeof AdvancedCommerceSubscriptionMigrateRequestCodec.Type;

export type AdvancedCommerceSubscriptionMigrateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateRequestCodec
>;

export const AdvancedCommerceSubscriptionModifyInAppRequestCodec = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("MODIFY_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceSubscriptionModifyDescriptorsCodec),
  taxCode: Schema.String,
  transactionId: Schema.String,
  retainBillingCycle: Schema.OptionFromOptionalKey(Schema.Boolean),
  addItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyAddItemCodec),
  ),
  changeItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyChangeItemCodec),
  ),
  removeItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyRemoveItemCodec),
  ),
  periodChange: Schema.OptionFromOptionalKey(AdvancedCommerceSubscriptionModifyPeriodChangeCodec),
});
export type AdvancedCommerceSubscriptionModifyInAppRequestCodec = typeof AdvancedCommerceSubscriptionModifyInAppRequestCodec.Type;

export type AdvancedCommerceSubscriptionModifyInAppRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyInAppRequestCodec
>;

export const AdvancedCommerceSubscriptionReactivateInAppRequestCodec = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("REACTIVATE_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionReactivateItemCodec),
  transactionId: Schema.String,
});
export type AdvancedCommerceSubscriptionReactivateInAppRequestCodec = typeof AdvancedCommerceSubscriptionReactivateInAppRequestCodec.Type;

export type AdvancedCommerceSubscriptionReactivateInAppRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionReactivateInAppRequestCodec
>;

// ===== Responses =====

const acResponseFields = {
  signedRenewalInfo: Schema.OptionFromOptionalKey(Schema.String),
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
};

export const AdvancedCommerceRequestRefundResponseCodec = Schema.Struct({ ...acResponseFields });
export type AdvancedCommerceRequestRefundResponseCodec = typeof AdvancedCommerceRequestRefundResponseCodec.Type;
export type AdvancedCommerceRequestRefundResponse = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundResponseCodec
>;

export const AdvancedCommerceSubscriptionCancelResponseCodec = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionCancelResponseCodec = typeof AdvancedCommerceSubscriptionCancelResponseCodec.Type;
export type AdvancedCommerceSubscriptionCancelResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCancelResponseCodec
>;

export const AdvancedCommerceSubscriptionRevokeResponseCodec = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionRevokeResponseCodec = typeof AdvancedCommerceSubscriptionRevokeResponseCodec.Type;
export type AdvancedCommerceSubscriptionRevokeResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionRevokeResponseCodec
>;

export const AdvancedCommerceSubscriptionPriceChangeResponseCodec = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionPriceChangeResponseCodec = typeof AdvancedCommerceSubscriptionPriceChangeResponseCodec.Type;
export type AdvancedCommerceSubscriptionPriceChangeResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeResponseCodec
>;

export const AdvancedCommerceSubscriptionChangeMetadataResponseCodec = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionChangeMetadataResponseCodec = typeof AdvancedCommerceSubscriptionChangeMetadataResponseCodec.Type;
export type AdvancedCommerceSubscriptionChangeMetadataResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataResponseCodec
>;

export const AdvancedCommerceSubscriptionMigrateResponseCodec = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionMigrateResponseCodec = typeof AdvancedCommerceSubscriptionMigrateResponseCodec.Type;
export type AdvancedCommerceSubscriptionMigrateResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateResponseCodec
>;

export { AdvancedCommerceDescriptorsCodec as AdvancedCommerceDescriptorsSchema };
export { AdvancedCommerceOfferCodec as AdvancedCommerceOfferSchema };
export { AdvancedCommerceRequestInfoCodec as AdvancedCommerceRequestInfoSchema };
export { AdvancedCommerceBaseItem as AdvancedCommerceBaseItemSchema };
export { AdvancedCommerceItem as AdvancedCommerceItemSchema };
export { AdvancedCommerceOneTimeChargeItemCodec as AdvancedCommerceOneTimeChargeItemSchema };
export { AdvancedCommerceSubscriptionCreateItemCodec as AdvancedCommerceSubscriptionCreateItemSchema };
export { AdvancedCommerceRequestRefundItemCodec as AdvancedCommerceRequestRefundItemSchema };
export { AdvancedCommercePriceIncreaseInfoCodec as AdvancedCommercePriceIncreaseInfoSchema };
export { AdvancedCommerceRefundCodec as AdvancedCommerceRefundSchema };
export { AdvancedCommerceRenewalItemCodec as AdvancedCommerceRenewalItemSchema };
export { AdvancedCommerceTransactionItemCodec as AdvancedCommerceTransactionItemSchema };
export { AdvancedCommerceRenewalInfoCodec as AdvancedCommerceRenewalInfoSchema };
export { AdvancedCommerceTransactionInfoCodec as AdvancedCommerceTransactionInfoSchema };
export { RenewalCommitmentInfoCodec as RenewalCommitmentInfoSchema };
export { TransactionCommitmentInfoCodec as TransactionCommitmentInfoSchema };
export { AdvancedCommerceSubscriptionModifyAddItemCodec as AdvancedCommerceSubscriptionModifyAddItemSchema };
export { AdvancedCommerceSubscriptionModifyChangeItemCodec as AdvancedCommerceSubscriptionModifyChangeItemSchema };
export { AdvancedCommerceSubscriptionModifyRemoveItemCodec as AdvancedCommerceSubscriptionModifyRemoveItemSchema };
export { AdvancedCommerceSubscriptionModifyPeriodChangeCodec as AdvancedCommerceSubscriptionModifyPeriodChangeSchema };
export { AdvancedCommerceSubscriptionModifyDescriptorsCodec as AdvancedCommerceSubscriptionModifyDescriptorsSchema };
export { AdvancedCommerceSubscriptionChangeMetadataDescriptorsCodec as AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema };
export { AdvancedCommerceSubscriptionMigrateDescriptorsCodec as AdvancedCommerceSubscriptionMigrateDescriptorsSchema };
export { AdvancedCommerceSubscriptionChangeMetadataItemCodec as AdvancedCommerceSubscriptionChangeMetadataItemSchema };
export { AdvancedCommerceSubscriptionReactivateItemCodec as AdvancedCommerceSubscriptionReactivateItemSchema };
export { AdvancedCommerceSubscriptionMigrateItemCodec as AdvancedCommerceSubscriptionMigrateItemSchema };
export { AdvancedCommerceSubscriptionMigrateRenewalItemCodec as AdvancedCommerceSubscriptionMigrateRenewalItemSchema };
export { AdvancedCommerceSubscriptionPriceChangeItemCodec as AdvancedCommerceSubscriptionPriceChangeItemSchema };
export { AdvancedCommerceOneTimeChargeCreateRequestCodec as AdvancedCommerceOneTimeChargeCreateRequestSchema };
export { AdvancedCommerceSubscriptionCreateRequestCodec as AdvancedCommerceSubscriptionCreateRequestSchema };
export { AdvancedCommerceRequestRefundRequestCodec as AdvancedCommerceRequestRefundRequestSchema };
export { AdvancedCommerceSubscriptionCancelRequestCodec as AdvancedCommerceSubscriptionCancelRequestSchema };
export { AdvancedCommerceSubscriptionRevokeRequestCodec as AdvancedCommerceSubscriptionRevokeRequestSchema };
export { AdvancedCommerceSubscriptionPriceChangeRequestCodec as AdvancedCommerceSubscriptionPriceChangeRequestSchema };
export { AdvancedCommerceSubscriptionChangeMetadataRequestCodec as AdvancedCommerceSubscriptionChangeMetadataRequestSchema };
export { AdvancedCommerceSubscriptionMigrateRequestCodec as AdvancedCommerceSubscriptionMigrateRequestSchema };
export { AdvancedCommerceSubscriptionModifyInAppRequestCodec as AdvancedCommerceSubscriptionModifyInAppRequestSchema };
export { AdvancedCommerceSubscriptionReactivateInAppRequestCodec as AdvancedCommerceSubscriptionReactivateInAppRequestSchema };
export { AdvancedCommerceRequestRefundResponseCodec as AdvancedCommerceRequestRefundResponseSchema };
export { AdvancedCommerceSubscriptionCancelResponseCodec as AdvancedCommerceSubscriptionCancelResponseSchema };
export { AdvancedCommerceSubscriptionRevokeResponseCodec as AdvancedCommerceSubscriptionRevokeResponseSchema };
export { AdvancedCommerceSubscriptionPriceChangeResponseCodec as AdvancedCommerceSubscriptionPriceChangeResponseSchema };
export { AdvancedCommerceSubscriptionChangeMetadataResponseCodec as AdvancedCommerceSubscriptionChangeMetadataResponseSchema };
export { AdvancedCommerceSubscriptionMigrateResponseCodec as AdvancedCommerceSubscriptionMigrateResponseSchema };
