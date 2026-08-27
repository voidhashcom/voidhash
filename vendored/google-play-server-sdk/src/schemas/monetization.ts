import { Schema } from "effect";

import { BasePlanState } from "./enums.ts";

/**
 * Money amount
 */
export const Money = Schema.Struct({
  currencyCode: Schema.optional(Schema.String),
  units: Schema.optional(Schema.String),
  nanos: Schema.optional(Schema.Number),
});

export type Money = typeof Money.Type;

/**
 * Price
 */
export const Price = Schema.Struct({
  priceMicros: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String),
});

export type Price = typeof Price.Type;

/**
 * Regional base plan config
 */
export const RegionalBasePlanConfig = Schema.Struct({
  regionCode: Schema.String,
  newSubscriberAvailability: Schema.optional(Schema.Boolean),
  price: Schema.optional(Money),
});

export type RegionalBasePlanConfig = typeof RegionalBasePlanConfig.Type;

/**
 * Offer tag
 */
export const OfferTag = Schema.Struct({
  tag: Schema.optional(Schema.String),
});

export type OfferTag = typeof OfferTag.Type;

/**
 * Auto renewing base plan type
 */
export const AutoRenewingBasePlanType = Schema.Struct({
  billingPeriodDuration: Schema.optional(Schema.String), // ISO 8601
  gracePeriodDuration: Schema.optional(Schema.String),
  accountHoldDuration: Schema.optional(Schema.String),
  resubscribeState: Schema.optional(Schema.String),
  prorationMode: Schema.optional(Schema.String),
  legacyCompatible: Schema.optional(Schema.Boolean),
  legacyCompatibleSubscriptionOfferId: Schema.optional(Schema.String),
});

export type AutoRenewingBasePlanType = typeof AutoRenewingBasePlanType.Type;

/**
 * Prepaid base plan type
 */
export const PrepaidBasePlanType = Schema.Struct({
  billingPeriodDuration: Schema.optional(Schema.String),
  timeExtension: Schema.optional(Schema.String),
});

export type PrepaidBasePlanType = typeof PrepaidBasePlanType.Type;

/**
 * Installments base plan type
 */
export const InstallmentsBasePlanType = Schema.Struct({
  billingPeriodDuration: Schema.optional(Schema.String),
  committedPaymentsCount: Schema.optional(Schema.Number),
  renewalType: Schema.optional(Schema.String),
  gracePeriodDuration: Schema.optional(Schema.String),
});

export type InstallmentsBasePlanType = typeof InstallmentsBasePlanType.Type;

/**
 * Other regions base plan config
 */
export const OtherRegionsBasePlanConfig = Schema.Struct({
  usdPrice: Schema.optional(Money),
  eurPrice: Schema.optional(Money),
  newSubscriberAvailability: Schema.optional(Schema.Boolean),
});

export type OtherRegionsBasePlanConfig = typeof OtherRegionsBasePlanConfig.Type;

/**
 * Base plan for subscriptions
 */
export const BasePlan = Schema.Struct({
  basePlanId: Schema.String,
  state: Schema.optional(BasePlanState),
  autoRenewingBasePlanType: Schema.optional(AutoRenewingBasePlanType),
  prepaidBasePlanType: Schema.optional(PrepaidBasePlanType),
  installmentsBasePlanType: Schema.optional(InstallmentsBasePlanType),
  regionalConfigs: Schema.optional(Schema.Array(RegionalBasePlanConfig)),
  otherRegionsConfig: Schema.optional(OtherRegionsBasePlanConfig),
  offerTags: Schema.optional(Schema.Array(OfferTag)),
});

export type BasePlan = typeof BasePlan.Type;

/**
 * Subscription listing (localized info)
 */
export const SubscriptionListing = Schema.Struct({
  languageCode: Schema.String,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  benefits: Schema.optional(Schema.Array(Schema.String)),
});

export type SubscriptionListing = typeof SubscriptionListing.Type;

/**
 * Subscription tax and compliance settings
 */
export const SubscriptionTaxAndComplianceSettings = Schema.Struct({
  eeaWithdrawalRightType: Schema.optional(Schema.String),
  isTokenizedDigitalAsset: Schema.optional(Schema.Boolean),
  productTaxCategoryCode: Schema.optional(Schema.String),
});

export type SubscriptionTaxAndComplianceSettings = typeof SubscriptionTaxAndComplianceSettings.Type;

/**
 * Subscription product
 */
export const Subscription = Schema.Struct({
  packageName: Schema.optional(Schema.String),
  productId: Schema.String,
  basePlans: Schema.optional(Schema.Array(BasePlan)),
  listings: Schema.optional(Schema.Array(SubscriptionListing)),
  taxAndComplianceSettings: Schema.optional(SubscriptionTaxAndComplianceSettings),
  archived: Schema.optional(Schema.Boolean),
  restrictedPaymentCountries: Schema.optional(
    Schema.Struct({
      regionCodes: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});

export type Subscription = typeof Subscription.Type;

/**
 * List subscriptions response
 */
export const ListSubscriptionsResponse = Schema.Struct({
  subscriptions: Schema.optional(Schema.Array(Subscription)),
  nextPageToken: Schema.optional(Schema.String),
});

export type ListSubscriptionsResponse = typeof ListSubscriptionsResponse.Type;

/**
 * Subscription offer phase
 */
export const SubscriptionOfferPhase = Schema.Struct({
  recurrenceCount: Schema.optional(Schema.Number),
  duration: Schema.optional(Schema.String),
  regionalConfigs: Schema.optional(
    Schema.Array(
      Schema.Struct({
        regionCode: Schema.String,
        price: Schema.optional(Money),
        absoluteDiscount: Schema.optional(Money),
        relativeDiscount: Schema.optional(Schema.Number),
        free: Schema.optional(Schema.Unknown),
      }),
    ),
  ),
  otherRegionsConfig: Schema.optional(Schema.Unknown),
});

export type SubscriptionOfferPhase = typeof SubscriptionOfferPhase.Type;

/**
 * Subscription offer targeting
 */
export const SubscriptionOfferTargeting = Schema.Struct({
  acquisitionRule: Schema.optional(Schema.Unknown),
  upgradeRule: Schema.optional(Schema.Unknown),
});

export type SubscriptionOfferTargeting = typeof SubscriptionOfferTargeting.Type;

/**
 * Subscription offer
 */
export const SubscriptionOffer = Schema.Struct({
  packageName: Schema.optional(Schema.String),
  productId: Schema.optional(Schema.String),
  basePlanId: Schema.optional(Schema.String),
  offerId: Schema.String,
  state: Schema.optional(Schema.String),
  phases: Schema.optional(Schema.Array(SubscriptionOfferPhase)),
  targeting: Schema.optional(SubscriptionOfferTargeting),
  offerTags: Schema.optional(Schema.Array(OfferTag)),
  regionalConfigs: Schema.optional(Schema.Array(Schema.Unknown)),
  otherRegionsConfig: Schema.optional(Schema.Unknown),
});

export type SubscriptionOffer = typeof SubscriptionOffer.Type;

/**
 * One-time product listing
 */
export const OneTimeProductListing = Schema.Struct({
  languageCode: Schema.String,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  benefits: Schema.optional(Schema.Array(Schema.String)),
});

export type OneTimeProductListing = typeof OneTimeProductListing.Type;

/**
 * Purchase option for one-time products
 */
export const PurchaseOption = Schema.Struct({
  purchaseOptionId: Schema.String,
  state: Schema.optional(Schema.String),
  regionalConfigs: Schema.optional(Schema.Array(Schema.Unknown)),
  otherRegionsConfig: Schema.optional(Schema.Unknown),
});

export type PurchaseOption = typeof PurchaseOption.Type;

/**
 * One-time product
 */
export const OneTimeProduct = Schema.Struct({
  packageName: Schema.optional(Schema.String),
  productId: Schema.String,
  listings: Schema.optional(Schema.Array(OneTimeProductListing)),
  purchaseOptions: Schema.optional(Schema.Array(PurchaseOption)),
  taxAndComplianceSettings: Schema.optional(Schema.Unknown),
});

export type OneTimeProduct = typeof OneTimeProduct.Type;

/**
 * List one-time products response
 */
export const ListOneTimeProductsResponse = Schema.Struct({
  oneTimeProducts: Schema.optional(Schema.Array(OneTimeProduct)),
  nextPageToken: Schema.optional(Schema.String),
});

export type ListOneTimeProductsResponse = typeof ListOneTimeProductsResponse.Type;

/**
 * Google API error details
 */
export const GoogleApiErrorDetail = Schema.Struct({
  "@type": Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  domain: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Unknown),
});

export type GoogleApiErrorDetail = typeof GoogleApiErrorDetail.Type;

/**
 * Google API error response
 */
export const GoogleApiError = Schema.Struct({
  error: Schema.Struct({
    code: Schema.Number,
    message: Schema.String,
    status: Schema.optional(Schema.String),
    details: Schema.optional(Schema.Array(GoogleApiErrorDetail)),
  }),
});

export type GoogleApiError = typeof GoogleApiError.Type;
