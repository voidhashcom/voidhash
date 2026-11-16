import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { enumOrUnknown, listOrEmpty, optionalNullable, PriceValue } from "./decoding";
import type { Price } from "./product";

/*
 * Google Play's own view of products and purchases, with Play Billing's field
 * names. The native client sends each as JSON; the decoders here read it
 * forward-compatibly.
 */

/** Play Billing's `ProductType`: `subs` for subscriptions, `inapp` for one-time products. */
export type GooglePlayProductType = "subs" | "inapp" | "unknown";

/** Play Billing's `RecurrenceMode` of a pricing phase. */
export type GooglePlayRecurrenceMode = "infinite" | "finite" | "nonRecurring" | "unknown";

/** A Play Billing `PricingPhase`. */
export interface GooglePlayPricingPhase {
  readonly formattedPrice: string;
  readonly priceAmountMicros: number;
  readonly priceCurrencyCode: string;
  /** ISO 8601 duration, such as `P1M`. */
  readonly billingPeriod: string;
  readonly billingCycleCount: number;
  readonly recurrenceMode: GooglePlayRecurrenceMode;
}

/** A Play Billing installment plan of a subscription offer. */
export interface GooglePlayInstallmentPlan {
  readonly commitmentPaymentsCount: number;
  readonly subsequentCommitmentPaymentsCount: number;
}

/** A Play Billing `SubscriptionOfferDetails`: a base plan, or an offer on one. */
export interface GooglePlaySubscriptionOffer {
  readonly basePlanId: string;
  /** Absent for the base plan itself. */
  readonly offerId?: string;
  /** Pass it as `googlePlay.offerToken` to buy exactly this offer. */
  readonly offerToken: string;
  readonly offerTags: ReadonlyArray<string>;
  readonly pricingPhases: ReadonlyArray<GooglePlayPricingPhase>;
  readonly installmentPlan?: GooglePlayInstallmentPlan;
}

/** A Play Billing `OneTimePurchaseOfferDetails`. */
export interface GooglePlayOneTimeOffer {
  readonly purchaseOptionId?: string;
  readonly offerId?: string;
  /** Pass it as `googlePlay.offerToken` to buy exactly this offer. */
  readonly offerToken: string;
  readonly offerTags: ReadonlyArray<string>;
  readonly price: Price;
  /** The price before the discount. */
  readonly fullPrice?: Price;
  readonly discountPercentage?: number;
  readonly limitedQuantity?: {
    readonly maximumQuantity: number;
    readonly remainingQuantity: number;
  };
  /** When the offer can be bought; an open end is absent. */
  readonly validTimeWindow?: { readonly startTimeMillis?: number; readonly endTimeMillis?: number };
  readonly preorder?: { readonly releaseTimeMillis: number; readonly presaleEndTimeMillis: number };
  readonly rental?: { readonly rentalPeriod: string; readonly rentalExpirationPeriod?: string };
}

/** A Play Billing `ProductDetails` as Google Play reports it. */
export interface GooglePlayProductInfo {
  /** The Google Play product id. */
  readonly productId: string;
  readonly productType: GooglePlayProductType;
  /** The base plan this product is bound to in Studio. */
  readonly basePlanId?: string;
  /** Every offer Google Play returned, on every base plan. */
  readonly subscriptionOffers: ReadonlyArray<GooglePlaySubscriptionOffer>;
  readonly oneTimeOffers: ReadonlyArray<GooglePlayOneTimeOffer>;
}

/** Play Billing's `Purchase.PurchaseState`. */
export type GooglePlayPurchaseState = "purchased" | "pending" | "unknown";

/** A Play Billing `Purchase` as Google Play reports it. */
export interface GooglePlayTransactionInfo {
  readonly orderId?: string;
  readonly purchaseToken: string;
  readonly productIds: ReadonlyArray<string>;
  readonly purchaseState: GooglePlayPurchaseState;
  readonly isAcknowledged: boolean;
  readonly isAutoRenewing?: boolean;
  /** The account id the purchase was made with: the end user's Voidhash identity. */
  readonly obfuscatedAccountId?: string;
  readonly obfuscatedProfileId?: string;
  /**
   * Whether Google Play suspended the subscription (its payment method
   * failed). A suspended purchase grants nothing.
   */
  readonly isSuspended: boolean;
}

/**
 * How `showInAppMessages()` ended: nothing to do, or the end user fixed their
 * payment method for the subscription whose purchase token it names.
 */
export type GooglePlayInAppMessageResult =
  | { readonly status: "noActionNeeded" }
  | { readonly status: "subscriptionStatusUpdated"; readonly purchaseToken: string };

/** A Play Billing feature `isFeatureSupported()` asks about, by `BillingClient.FeatureType`. */
export type GooglePlayBillingFeature =
  | "subscriptions"
  | "subscriptionsUpdate"
  | "inAppMessaging"
  | "productDetails"
  | "billingConfig"
  | "alternativeBillingOnly"
  | "externalOffer";

const GooglePlaySubscriptionOfferValue = Schema.Struct({
  basePlanId: Schema.String,
  offerId: optionalNullable(Schema.String),
  offerToken: Schema.String,
  offerTags: listOrEmpty(Schema.String),
  pricingPhases: listOrEmpty(
    Schema.Struct({
      formattedPrice: Schema.String,
      priceAmountMicros: Schema.Number,
      priceCurrencyCode: Schema.String,
      billingPeriod: Schema.String,
      billingCycleCount: Schema.Number,
      recurrenceMode: enumOrUnknown(["infinite", "finite", "nonRecurring"]),
    }),
  ),
  installmentPlan: optionalNullable(
    Schema.Struct({
      commitmentPaymentsCount: Schema.Number,
      subsequentCommitmentPaymentsCount: Schema.Number,
    }),
  ),
});

const GooglePlayOneTimeOfferValue = Schema.Struct({
  purchaseOptionId: optionalNullable(Schema.String),
  offerId: optionalNullable(Schema.String),
  offerToken: Schema.String,
  offerTags: listOrEmpty(Schema.String),
  price: PriceValue,
  fullPrice: optionalNullable(PriceValue),
  discountPercentage: optionalNullable(Schema.Number),
  limitedQuantity: optionalNullable(
    Schema.Struct({ maximumQuantity: Schema.Number, remainingQuantity: Schema.Number }),
  ),
  validTimeWindow: optionalNullable(
    Schema.Struct({
      startTimeMillis: optionalNullable(Schema.Number),
      endTimeMillis: optionalNullable(Schema.Number),
    }),
  ),
  preorder: optionalNullable(
    Schema.Struct({ releaseTimeMillis: Schema.Number, presaleEndTimeMillis: Schema.Number }),
  ),
  rental: optionalNullable(
    Schema.Struct({
      rentalPeriod: Schema.String,
      rentalExpirationPeriod: optionalNullable(Schema.String),
    }),
  ),
});

const GooglePlayProductJson = Schema.fromJsonString(
  Schema.Struct({
    productId: Schema.String,
    productType: enumOrUnknown(["subs", "inapp"]),
    basePlanId: optionalNullable(Schema.String),
    subscriptionOffers: listOrEmpty(GooglePlaySubscriptionOfferValue),
    oneTimeOffers: listOrEmpty(GooglePlayOneTimeOfferValue),
  }),
);

const GooglePlayTransactionJson = Schema.fromJsonString(
  Schema.Struct({
    orderId: optionalNullable(Schema.String),
    purchaseToken: Schema.String,
    productIds: listOrEmpty(Schema.String),
    purchaseState: enumOrUnknown(["purchased", "pending"]),
    isAcknowledged: Schema.Boolean,
    isAutoRenewing: optionalNullable(Schema.Boolean),
    obfuscatedAccountId: optionalNullable(Schema.String),
    obfuscatedProfileId: optionalNullable(Schema.String),
    isSuspended: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  }),
);

/** Reads a product's Google Play part; `None` when it is not one. */
export const decodeGooglePlayProduct = (json: string): Option.Option<GooglePlayProductInfo> =>
  Schema.decodeUnknownOption(GooglePlayProductJson)(json);

/** Reads a transaction's Google Play part; `None` when it is not one. */
export const decodeGooglePlayTransaction = (
  json: string,
): Option.Option<GooglePlayTransactionInfo> =>
  Schema.decodeUnknownOption(GooglePlayTransactionJson)(json);
