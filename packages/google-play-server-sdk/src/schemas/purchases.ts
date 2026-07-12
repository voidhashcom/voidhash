import { Schema } from "effect";

import { AcknowledgementState, PurchaseState, SubscriptionState } from "./enums.ts";

/**
 * Auto renewing plan details
 */
export const AutoRenewingPlan = Schema.Struct({
  autoRenewEnabled: Schema.optional(Schema.Boolean),
  priceChangeDetails: Schema.optional(
    Schema.Struct({
      newPrice: Schema.optional(
        Schema.Struct({
          currencyCode: Schema.optional(Schema.String),
          units: Schema.optional(Schema.String),
          nanos: Schema.optional(Schema.Number),
        }),
      ),
      expectedNewPriceChargeTime: Schema.optional(Schema.String),
      priceChangeMode: Schema.optional(Schema.String),
      priceChangeState: Schema.optional(Schema.String),
    }),
  ),
});

export type AutoRenewingPlan = typeof AutoRenewingPlan.Type;

/**
 * Prepaid plan details
 */
export const PrepaidPlan = Schema.Struct({
  allowExtendAfterTime: Schema.optional(Schema.String),
});

export type PrepaidPlan = typeof PrepaidPlan.Type;

/**
 * Offer details for subscription line items
 */
export const OfferDetails = Schema.Struct({
  basePlanId: Schema.optional(Schema.String),
  offerId: Schema.optional(Schema.String),
  offerTags: Schema.optional(Schema.Array(Schema.String)),
});

export type OfferDetails = typeof OfferDetails.Type;

/**
 * Subscription purchase line item
 */
export const SubscriptionPurchaseLineItem = Schema.Struct({
  productId: Schema.optional(Schema.String),
  expiryTime: Schema.optional(Schema.String),
  autoRenewingPlan: Schema.optional(AutoRenewingPlan),
  prepaidPlan: Schema.optional(PrepaidPlan),
  offerDetails: Schema.optional(OfferDetails),
  latestSuccessfulOrderId: Schema.optional(Schema.String),
});

export type SubscriptionPurchaseLineItem = typeof SubscriptionPurchaseLineItem.Type;

/**
 * External account identifiers
 */
export const ExternalAccountIdentifiers = Schema.Struct({
  externalAccountId: Schema.optional(Schema.String),
  obfuscatedExternalAccountId: Schema.optional(Schema.String),
  obfuscatedExternalProfileId: Schema.optional(Schema.String),
});

export type ExternalAccountIdentifiers = typeof ExternalAccountIdentifiers.Type;

/**
 * Canceled state context
 */
export const CanceledStateContext = Schema.Struct({
  userInitiatedCancellation: Schema.optional(Schema.Unknown),
  systemInitiatedCancellation: Schema.optional(Schema.Unknown),
  developerInitiatedCancellation: Schema.optional(Schema.Unknown),
  replacementCancellation: Schema.optional(Schema.Unknown),
});

export type CanceledStateContext = typeof CanceledStateContext.Type;

/**
 * Paused state context
 */
export const PausedStateContext = Schema.Struct({
  autoResumeTime: Schema.optional(Schema.String),
});

export type PausedStateContext = typeof PausedStateContext.Type;

/**
 * Subscribe with Google info
 */
export const SubscribeWithGoogleInfo = Schema.Struct({
  emailAddress: Schema.optional(Schema.String),
  givenName: Schema.optional(Schema.String),
  familyName: Schema.optional(Schema.String),
  profileId: Schema.optional(Schema.String),
  profileName: Schema.optional(Schema.String),
});

export type SubscribeWithGoogleInfo = typeof SubscribeWithGoogleInfo.Type;

/**
 * Test purchase marker
 */
export const TestPurchase = Schema.Struct({});

export type TestPurchase = typeof TestPurchase.Type;

/**
 * Subscription purchase V2 response
 */
export const SubscriptionPurchaseV2 = Schema.Struct({
  kind: Schema.optional(Schema.String),
  subscriptionState: Schema.optional(SubscriptionState),
  acknowledgementState: Schema.optional(AcknowledgementState),
  startTime: Schema.optional(Schema.String),
  regionCode: Schema.optional(Schema.String),
  latestOrderId: Schema.optional(Schema.String),
  lineItems: Schema.optional(Schema.Array(SubscriptionPurchaseLineItem)),
  linkedPurchaseToken: Schema.optional(Schema.String),
  pausedStateContext: Schema.optional(PausedStateContext),
  canceledStateContext: Schema.optional(CanceledStateContext),
  testPurchase: Schema.optional(TestPurchase),
  externalAccountIdentifiers: Schema.optional(ExternalAccountIdentifiers),
  subscribeWithGoogleInfo: Schema.optional(SubscribeWithGoogleInfo),
});

export type SubscriptionPurchaseV2 = typeof SubscriptionPurchaseV2.Type;

/**
 * Product line item for product purchases V2
 */
export const ProductLineItem = Schema.Struct({
  productId: Schema.optional(Schema.String),
  offerDetails: Schema.optional(OfferDetails),
  quantity: Schema.optional(Schema.Number),
});

export type ProductLineItem = typeof ProductLineItem.Type;

/**
 * Purchase state context for product purchases V2
 */
export const PurchaseStateContext = Schema.Struct({
  purchaseState: Schema.optional(PurchaseState),
});

export type PurchaseStateContext = typeof PurchaseStateContext.Type;

/**
 * Test purchase context
 */
export const TestPurchaseContext = Schema.Struct({
  testPurchaseType: Schema.optional(Schema.String),
});

export type TestPurchaseContext = typeof TestPurchaseContext.Type;

/**
 * Product purchase V2 response
 */
export const ProductPurchaseV2 = Schema.Struct({
  kind: Schema.optional(Schema.String),
  acknowledgementState: Schema.optional(AcknowledgementState),
  orderId: Schema.optional(Schema.String),
  productLineItem: Schema.optional(Schema.Array(ProductLineItem)),
  purchaseCompletionTime: Schema.optional(Schema.String),
  purchaseStateContext: Schema.optional(PurchaseStateContext),
  regionCode: Schema.optional(Schema.String),
  testPurchaseContext: Schema.optional(TestPurchaseContext),
  obfuscatedExternalAccountId: Schema.optional(Schema.String),
  obfuscatedExternalProfileId: Schema.optional(Schema.String),
});

export type ProductPurchaseV2 = typeof ProductPurchaseV2.Type;

/**
 * Legacy product purchase response (V1)
 */
export const ProductPurchase = Schema.Struct({
  kind: Schema.optional(Schema.String),
  purchaseState: Schema.optional(Schema.Number), // 0=Purchased, 1=Canceled, 2=Pending
  acknowledgementState: Schema.optional(Schema.Number), // 0=Pending, 1=Acknowledged
  consumptionState: Schema.optional(Schema.Number), // 0=YetToBeConsumed, 1=Consumed
  orderId: Schema.optional(Schema.String),
  purchaseTimeMillis: Schema.optional(Schema.String),
  developerPayload: Schema.optional(Schema.String),
  purchaseType: Schema.optional(Schema.Number), // 0=Test, 1=Promo, 2=Rewarded
  productId: Schema.optional(Schema.String),
  quantity: Schema.optional(Schema.Number),
  obfuscatedExternalAccountId: Schema.optional(Schema.String),
  obfuscatedExternalProfileId: Schema.optional(Schema.String),
  regionCode: Schema.optional(Schema.String),
  refundableQuantity: Schema.optional(Schema.Number),
  purchaseToken: Schema.optional(Schema.String),
});

export type ProductPurchase = typeof ProductPurchase.Type;

/**
 * Voided purchase record
 */
export const VoidedPurchase = Schema.Struct({
  purchaseToken: Schema.String,
  purchaseTimeMillis: Schema.optional(Schema.String),
  voidedTimeMillis: Schema.optional(Schema.String),
  orderId: Schema.optional(Schema.String),
  voidedSource: Schema.optional(Schema.Number), // 0=User, 1=Developer, 2=Google
  voidedReason: Schema.optional(Schema.Number), // 0=Other, 1=Remorse, 2=NotReceived, 3=Defective, 4=Chargeback, 5=FriendlyFraud
  kind: Schema.optional(Schema.String),
  voidedQuantity: Schema.optional(Schema.Number),
  productType: Schema.optional(Schema.Number), // 0=Subscription, 1=Product
  refundType: Schema.optional(Schema.Number), // 0=FullRefund, 1=Revoke
});

export type VoidedPurchase = typeof VoidedPurchase.Type;

/**
 * Page info for paginated responses
 */
export const PageInfo = Schema.Struct({
  totalResults: Schema.optional(Schema.Number),
  resultPerPage: Schema.optional(Schema.Number),
  startIndex: Schema.optional(Schema.Number),
});

export type PageInfo = typeof PageInfo.Type;

/**
 * Token pagination
 */
export const TokenPagination = Schema.Struct({
  nextPageToken: Schema.optional(Schema.String),
  previousPageToken: Schema.optional(Schema.String),
});

export type TokenPagination = typeof TokenPagination.Type;

/**
 * Voided purchases list response
 */
export const VoidedPurchasesListResponse = Schema.Struct({
  voidedPurchases: Schema.optional(Schema.Array(VoidedPurchase)),
  pageInfo: Schema.optional(PageInfo),
  tokenPagination: Schema.optional(TokenPagination),
});

export type VoidedPurchasesListResponse = typeof VoidedPurchasesListResponse.Type;
