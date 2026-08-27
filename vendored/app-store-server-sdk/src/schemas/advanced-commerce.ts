import { Schema } from "effect";
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
export const AdvancedCommerceDescriptorsSchema = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
});

export type AdvancedCommerceDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceDescriptorsSchema
>;

/**
 * Discount offer for an auto-renewable subscription via Advanced Commerce API.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/offer
 */
export const AdvancedCommerceOfferSchema = Schema.Struct({
  period: Schema.Union([AdvancedCommerceOfferPeriodSchema, Schema.String]),
  periodCount: Schema.Number,
  price: Schema.Number,
  reason: Schema.Union([AdvancedCommerceOfferReasonSchema, Schema.String]),
});

export type AdvancedCommerceOffer = Schema.Schema.Type<typeof AdvancedCommerceOfferSchema>;

/**
 * Metadata included in every Advanced Commerce request.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/requestinfo
 */
export const AdvancedCommerceRequestInfoSchema = Schema.Struct({
  appAccountToken: Schema.OptionFromOptionalKey(Schema.String),
  consistencyToken: Schema.OptionFromOptionalKey(Schema.String),
  requestReferenceId: Schema.String,
});

export type AdvancedCommerceRequestInfo = Schema.Schema.Type<
  typeof AdvancedCommerceRequestInfoSchema
>;

/** Base shape for items identified by SKU. */
export const AdvancedCommerceBaseItemSchema = Schema.Struct({
  SKU: Schema.String,
});

/** Item with description and display name extension. */
export const AdvancedCommerceItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});

/**
 * One-time charge product details.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/onetimechargeitem
 */
export const AdvancedCommerceOneTimeChargeItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  price: Schema.Number,
});

export type AdvancedCommerceOneTimeChargeItem = Schema.Schema.Type<
  typeof AdvancedCommerceOneTimeChargeItemSchema
>;

/**
 * Subscription item used in create requests.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptioncreateitem
 */
export const AdvancedCommerceSubscriptionCreateItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferSchema),
  price: Schema.Number,
});

export type AdvancedCommerceSubscriptionCreateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCreateItemSchema
>;

/**
 * Refund target item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/refunditem
 */
export const AdvancedCommerceRequestRefundItemSchema = Schema.Struct({
  SKU: Schema.String,
  refundReason: Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  refundType: Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  revoke: Schema.OptionFromOptionalKey(Schema.Boolean),
  refundAmount: Schema.OptionFromOptionalKey(Schema.Number),
});

export type AdvancedCommerceRequestRefundItem = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundItemSchema
>;

/**
 * Price-increase information for an Advanced Commerce subscription renewal.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercepriceincreaseinfo
 */
export const AdvancedCommercePriceIncreaseInfoSchema = Schema.Struct({
  dependentSKUs: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  status: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommercePriceIncreaseInfoStatusSchema, Schema.String]),
  ),
});

export type AdvancedCommercePriceIncreaseInfo = Schema.Schema.Type<
  typeof AdvancedCommercePriceIncreaseInfoSchema
>;

/**
 * Refund detail attached to a transaction item.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerefund
 */
export const AdvancedCommerceRefundSchema = Schema.Struct({
  refundAmount: Schema.OptionFromOptionalKey(Schema.Number),
  refundDate: Schema.OptionFromOptionalKey(Schema.Number),
  refundReason: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  ),
  refundType: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  ),
});

export type AdvancedCommerceRefund = Schema.Schema.Type<typeof AdvancedCommerceRefundSchema>;

/**
 * Renewal item for Advanced Commerce renewals.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerenewalitem
 */
export const AdvancedCommerceRenewalItemSchema = Schema.Struct({
  SKU: Schema.OptionFromOptionalKey(Schema.String),
  description: Schema.OptionFromOptionalKey(Schema.String),
  displayName: Schema.OptionFromOptionalKey(Schema.String),
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferSchema),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  priceIncreaseInfo: Schema.OptionFromOptionalKey(AdvancedCommercePriceIncreaseInfoSchema),
});

export type AdvancedCommerceRenewalItem = Schema.Schema.Type<
  typeof AdvancedCommerceRenewalItemSchema
>;

/**
 * Transaction item for Advanced Commerce transactions.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercetransactionitem
 */
export const AdvancedCommerceTransactionItemSchema = Schema.Struct({
  SKU: Schema.OptionFromOptionalKey(Schema.String),
  description: Schema.OptionFromOptionalKey(Schema.String),
  displayName: Schema.OptionFromOptionalKey(Schema.String),
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferSchema),
  price: Schema.OptionFromOptionalKey(Schema.Number),
  refunds: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceRefundSchema)),
  revocationDate: Schema.OptionFromOptionalKey(Schema.Number),
});

export type AdvancedCommerceTransactionItem = Schema.Schema.Type<
  typeof AdvancedCommerceTransactionItemSchema
>;

/**
 * Renewal info for Advanced Commerce subscriptions, embedded in JWSRenewalInfoDecodedPayload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercerenewalinfo
 */
export const AdvancedCommerceRenewalInfoSchema = Schema.Struct({
  consistencyToken: Schema.OptionFromOptionalKey(Schema.String),
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceDescriptorsSchema),
  items: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceRenewalItemSchema)),
  period: Schema.OptionFromOptionalKey(Schema.Union([AdvancedCommercePeriodSchema, Schema.String])),
  requestReferenceId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.OptionFromOptionalKey(Schema.String),
});

export type AdvancedCommerceRenewalInfo = Schema.Schema.Type<
  typeof AdvancedCommerceRenewalInfoSchema
>;

/**
 * Transaction info for Advanced Commerce transactions, embedded in JWSTransactionDecodedPayload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/advancedcommercetransactioninfo
 */
export const AdvancedCommerceTransactionInfoSchema = Schema.Struct({
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceDescriptorsSchema),
  estimatedTax: Schema.OptionFromOptionalKey(Schema.Number),
  items: Schema.OptionFromOptionalKey(Schema.Array(AdvancedCommerceTransactionItemSchema)),
  period: Schema.OptionFromOptionalKey(Schema.Union([AdvancedCommercePeriodSchema, Schema.String])),
  requestReferenceId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.OptionFromOptionalKey(Schema.String),
  taxExclusivePrice: Schema.OptionFromOptionalKey(Schema.Number),
  taxRate: Schema.OptionFromOptionalKey(Schema.String),
});

export type AdvancedCommerceTransactionInfo = Schema.Schema.Type<
  typeof AdvancedCommerceTransactionInfoSchema
>;

/**
 * Renewal commitment info attached to renewal payload.
 * @see https://developer.apple.com/documentation/appstoreserverapi/renewalcommitmentinfo
 */
export const RenewalCommitmentInfoSchema = Schema.Struct({
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

export type RenewalCommitmentInfo = Schema.Schema.Type<typeof RenewalCommitmentInfoSchema>;

/**
 * Transaction-level commitment information.
 * @see https://developer.apple.com/documentation/appstoreserverapi/transactioncommitmentinfo
 */
export const TransactionCommitmentInfoSchema = Schema.Struct({
  billingPeriodNumber: Schema.OptionFromOptionalKey(Schema.Number),
  commitmentExpiresDate: Schema.OptionFromOptionalKey(Schema.Number),
  commitmentPrice: Schema.OptionFromOptionalKey(Schema.Number),
  totalBillingPeriods: Schema.OptionFromOptionalKey(Schema.Number),
});

export type TransactionCommitmentInfo = Schema.Schema.Type<typeof TransactionCommitmentInfoSchema>;

// ===== Modify/Migrate item schemas =====

/**
 * Item added to a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyadditem
 */
export const AdvancedCommerceSubscriptionModifyAddItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferSchema),
  price: Schema.Number,
});

export type AdvancedCommerceSubscriptionModifyAddItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyAddItemSchema
>;

/**
 * Item swapped within a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifychangeitem
 */
export const AdvancedCommerceSubscriptionModifyChangeItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  currentSKU: Schema.String,
  offer: Schema.OptionFromOptionalKey(AdvancedCommerceOfferSchema),
  price: Schema.Number,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
  reason: Schema.Union([AdvancedCommerceReasonSchema, Schema.String]),
});

export type AdvancedCommerceSubscriptionModifyChangeItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyChangeItemSchema
>;

/**
 * Item removed from a subscription via the modify endpoint.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyremoveitem
 */
export const AdvancedCommerceSubscriptionModifyRemoveItemSchema = Schema.Struct({
  SKU: Schema.String,
});

export type AdvancedCommerceSubscriptionModifyRemoveItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyRemoveItemSchema
>;

/**
 * Period change request for modifying a subscription.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifyperiodchange
 */
export const AdvancedCommerceSubscriptionModifyPeriodChangeSchema = Schema.Struct({
  period: Schema.Union([AdvancedCommercePeriodSchema, Schema.String]),
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});

export type AdvancedCommerceSubscriptionModifyPeriodChange = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyPeriodChangeSchema
>;

/**
 * Descriptors used when modifying subscription metadata.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmodifydescriptors
 */
export const AdvancedCommerceSubscriptionModifyDescriptorsSchema = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});

export type AdvancedCommerceSubscriptionModifyDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyDescriptorsSchema
>;

/**
 * Descriptors used when changing subscription metadata.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionchangemetadatadescriptors
 */
export const AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});

export type AdvancedCommerceSubscriptionChangeMetadataDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema
>;

/**
 * Descriptors used during a subscription migration.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigratedescriptors
 */
export const AdvancedCommerceSubscriptionMigrateDescriptorsSchema = Schema.Struct({
  description: Schema.String,
  displayName: Schema.String,
});

export type AdvancedCommerceSubscriptionMigrateDescriptors = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateDescriptorsSchema
>;

/**
 * Subscription metadata change item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionchangemetadataitem
 */
export const AdvancedCommerceSubscriptionChangeMetadataItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
  currentSKU: Schema.String,
  effective: Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
});

export type AdvancedCommerceSubscriptionChangeMetadataItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataItemSchema
>;

/**
 * Reactivate subscription item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionreactivateitem
 */
export const AdvancedCommerceSubscriptionReactivateItemSchema = Schema.Struct({
  SKU: Schema.String,
});

export type AdvancedCommerceSubscriptionReactivateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionReactivateItemSchema
>;

/**
 * Migrate item for subscription migrations.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigrateitem
 */
export const AdvancedCommerceSubscriptionMigrateItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});

export type AdvancedCommerceSubscriptionMigrateItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateItemSchema
>;

/**
 * Migrate renewal item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionmigraterenewalitem
 */
export const AdvancedCommerceSubscriptionMigrateRenewalItemSchema = Schema.Struct({
  SKU: Schema.String,
  description: Schema.String,
  displayName: Schema.String,
});

export type AdvancedCommerceSubscriptionMigrateRenewalItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateRenewalItemSchema
>;

/**
 * Price change item.
 * @see https://developer.apple.com/documentation/advancedcommerceapi/subscriptionpricechangeitem
 */
export const AdvancedCommerceSubscriptionPriceChangeItemSchema = Schema.Struct({
  SKU: Schema.String,
  price: Schema.Number,
  dependentSKUs: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  effective: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceEffectiveSchema, Schema.String]),
  ),
});

export type AdvancedCommerceSubscriptionPriceChangeItem = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeItemSchema
>;

// ===== Requests =====

const acRequestBase = {
  requestInfo: AdvancedCommerceRequestInfoSchema,
  storefront: Schema.OptionFromOptionalKey(Schema.String),
};

export const AdvancedCommerceOneTimeChargeCreateRequestSchema = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("CREATE_ONE_TIME_CHARGE")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  item: AdvancedCommerceOneTimeChargeItemSchema,
  taxCode: Schema.String,
});

export type AdvancedCommerceOneTimeChargeCreateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceOneTimeChargeCreateRequestSchema
>;

export const AdvancedCommerceSubscriptionCreateRequestSchema = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("CREATE_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  descriptors: AdvancedCommerceDescriptorsSchema,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionCreateItemSchema),
  period: Schema.Union([AdvancedCommercePeriodSchema, Schema.String]),
  previousTransactionId: Schema.OptionFromOptionalKey(Schema.String),
  taxCode: Schema.String,
});

export type AdvancedCommerceSubscriptionCreateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCreateRequestSchema
>;

export const AdvancedCommerceRequestRefundRequestSchema = Schema.Struct({
  ...acRequestBase,
  items: Schema.NonEmptyArray(AdvancedCommerceRequestRefundItemSchema),
  refundRiskingPreference: Schema.OptionFromOptionalKey(Schema.Boolean),
  currency: Schema.OptionFromOptionalKey(Schema.String),
});

export type AdvancedCommerceRequestRefundRequest = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundRequestSchema
>;

export const AdvancedCommerceSubscriptionCancelRequestSchema = Schema.Struct({
  ...acRequestBase,
});

export type AdvancedCommerceSubscriptionCancelRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCancelRequestSchema
>;

export const AdvancedCommerceSubscriptionRevokeRequestSchema = Schema.Struct({
  ...acRequestBase,
  refundRiskingPreference: Schema.OptionFromOptionalKey(Schema.Boolean),
  refundReason: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundReasonSchema, Schema.String]),
  ),
  refundType: Schema.OptionFromOptionalKey(
    Schema.Union([AdvancedCommerceRefundTypeSchema, Schema.String]),
  ),
});

export type AdvancedCommerceSubscriptionRevokeRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionRevokeRequestSchema
>;

export const AdvancedCommerceSubscriptionPriceChangeRequestSchema = Schema.Struct({
  ...acRequestBase,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionPriceChangeItemSchema),
  currency: Schema.OptionFromOptionalKey(Schema.String),
});

export type AdvancedCommerceSubscriptionPriceChangeRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeRequestSchema
>;

export const AdvancedCommerceSubscriptionChangeMetadataRequestSchema = Schema.Struct({
  ...acRequestBase,
  items: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionChangeMetadataItemSchema),
  ),
  descriptors: Schema.OptionFromOptionalKey(
    AdvancedCommerceSubscriptionChangeMetadataDescriptorsSchema,
  ),
});

export type AdvancedCommerceSubscriptionChangeMetadataRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataRequestSchema
>;

export const AdvancedCommerceSubscriptionMigrateRequestSchema = Schema.Struct({
  ...acRequestBase,
  descriptors: AdvancedCommerceSubscriptionMigrateDescriptorsSchema,
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionMigrateItemSchema),
  taxCode: Schema.String,
  targetProductId: Schema.String,
  retainBillingCycle: Schema.OptionFromOptionalKey(Schema.Boolean),
});

export type AdvancedCommerceSubscriptionMigrateRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateRequestSchema
>;

export const AdvancedCommerceSubscriptionModifyInAppRequestSchema = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("MODIFY_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  currency: Schema.String,
  descriptors: Schema.OptionFromOptionalKey(AdvancedCommerceSubscriptionModifyDescriptorsSchema),
  taxCode: Schema.String,
  transactionId: Schema.String,
  retainBillingCycle: Schema.OptionFromOptionalKey(Schema.Boolean),
  addItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyAddItemSchema),
  ),
  changeItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyChangeItemSchema),
  ),
  removeItems: Schema.OptionFromOptionalKey(
    Schema.Array(AdvancedCommerceSubscriptionModifyRemoveItemSchema),
  ),
  periodChange: Schema.OptionFromOptionalKey(AdvancedCommerceSubscriptionModifyPeriodChangeSchema),
});

export type AdvancedCommerceSubscriptionModifyInAppRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionModifyInAppRequestSchema
>;

export const AdvancedCommerceSubscriptionReactivateInAppRequestSchema = Schema.Struct({
  ...acRequestBase,
  operation: Schema.OptionFromOptionalKey(Schema.Literal("REACTIVATE_SUBSCRIPTION")),
  version: Schema.OptionFromOptionalKey(Schema.Literal("1")),
  items: Schema.NonEmptyArray(AdvancedCommerceSubscriptionReactivateItemSchema),
  transactionId: Schema.String,
});

export type AdvancedCommerceSubscriptionReactivateInAppRequest = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionReactivateInAppRequestSchema
>;

// ===== Responses =====

const acResponseFields = {
  signedRenewalInfo: Schema.OptionFromOptionalKey(Schema.String),
  signedTransactionInfo: Schema.OptionFromOptionalKey(Schema.String),
};

export const AdvancedCommerceRequestRefundResponseSchema = Schema.Struct({ ...acResponseFields });
export type AdvancedCommerceRequestRefundResponse = Schema.Schema.Type<
  typeof AdvancedCommerceRequestRefundResponseSchema
>;

export const AdvancedCommerceSubscriptionCancelResponseSchema = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionCancelResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionCancelResponseSchema
>;

export const AdvancedCommerceSubscriptionRevokeResponseSchema = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionRevokeResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionRevokeResponseSchema
>;

export const AdvancedCommerceSubscriptionPriceChangeResponseSchema = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionPriceChangeResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionPriceChangeResponseSchema
>;

export const AdvancedCommerceSubscriptionChangeMetadataResponseSchema = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionChangeMetadataResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionChangeMetadataResponseSchema
>;

export const AdvancedCommerceSubscriptionMigrateResponseSchema = Schema.Struct({
  ...acResponseFields,
});
export type AdvancedCommerceSubscriptionMigrateResponse = Schema.Schema.Type<
  typeof AdvancedCommerceSubscriptionMigrateResponseSchema
>;
