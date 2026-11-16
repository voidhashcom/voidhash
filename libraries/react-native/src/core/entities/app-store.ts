import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { ProductSlug } from "../schema/registry";
import {
  EnvironmentValue,
  enumOrUnknown,
  listOrEmpty,
  optionalNullable,
  PaymentModeValue,
  PeriodValue,
  PriceValue,
} from "./decoding";
import type { Offer, PaymentMode, Period, Price } from "./product";
import type { Environment, Transaction } from "./transaction";

/*
 * The App Store's own view of products and transactions, with StoreKit's
 * field names. The native client sends each as JSON (dates as milliseconds
 * since the epoch); the decoders here read it forward-compatibly.
 */

/** StoreKit's `Product.ProductType`. */
export type AppStoreProductType =
  | "consumable"
  | "nonConsumable"
  | "autoRenewable"
  | "nonRenewable"
  | "unknown";

/** StoreKit's `Product.SubscriptionOffer.OfferType`. */
export type AppStoreOfferType = "introductory" | "promotional" | "winBack" | "unknown";

/** A StoreKit `Product.SubscriptionOffer`, whether or not this end user can buy it. */
export interface AppStoreOffer {
  /** The offer's id in App Store Connect; absent for the introductory offer. */
  readonly id?: string;
  readonly type: AppStoreOfferType;
  readonly paymentMode: PaymentMode;
  /** The length of one period of the offer. */
  readonly period: Period;
  /** How many periods the offer lasts. */
  readonly periodCount: number;
  /** What one period costs; zero for a free trial. */
  readonly price: Price;
}

/** A StoreKit `Product` as the App Store reports it. */
export interface AppStoreProductInfo {
  readonly subscriptionGroupId?: string;
  /** The product's level in its subscription group (iOS 16.4 and later). */
  readonly subscriptionGroupLevel?: number;
  /** The subscription group's name (iOS 16.4 and later). */
  readonly subscriptionGroupDisplayName?: string;
  readonly isFamilyShareable: boolean;
  readonly productType: AppStoreProductType;
  /** The introductory offer, whether or not this end user is eligible for it. */
  readonly introductoryOffer?: AppStoreOffer;
  readonly promotionalOffers: ReadonlyArray<AppStoreOffer>;
  /** Win-back offers (iOS 18 and later). */
  readonly winBackOffers: ReadonlyArray<AppStoreOffer>;
  /** Whether this end user can get the group's introductory offer; absent when unknown. */
  readonly isEligibleForIntroOffer?: boolean;
}

/** StoreKit's `Transaction.OwnershipType`. */
export type AppStoreOwnershipType = "purchased" | "familyShared" | "unknown";

/** StoreKit's `Transaction.RevocationReason`. */
export type AppStoreRevocationReason = "developerIssue" | "other" | "unknown";

/** A StoreKit `Transaction` as the App Store reports it. */
export interface AppStoreTransactionInfo {
  readonly ownershipType: AppStoreOwnershipType;
  /** The ISO 3166-1 alpha-2 country of the storefront it was bought in. */
  readonly storefrontCountryCode?: string;
  /** Whether the end user upgraded to another subscription in the group. */
  readonly isUpgraded: boolean;
  /** When the App Store refunded or revoked it, in milliseconds since the epoch. */
  readonly revocationDate?: number;
  readonly revocationReason?: AppStoreRevocationReason;
  readonly appTransactionId?: string;
  /** The transaction's signed JWS, for your own server to verify. */
  readonly jwsRepresentation: string;
}

/** StoreKit's `Product.SubscriptionInfo.RenewalState`. */
export type AppStoreSubscriptionState =
  | "subscribed"
  | "expired"
  | "inBillingRetryPeriod"
  | "inGracePeriod"
  | "revoked"
  | "unknown";

/** StoreKit's `RenewalInfo.ExpirationReason`. */
export type AppStoreExpirationReason =
  | "autoRenewDisabled"
  | "billingError"
  | "didNotConsentToPriceIncrease"
  | "productUnavailable"
  | "unknown";

/** StoreKit's `RenewalInfo.PriceIncreaseStatus`. */
export type AppStorePriceIncreaseStatus = "noIncreasePending" | "pending" | "agreed" | "unknown";

/** A StoreKit `Product.SubscriptionInfo.RenewalInfo`. */
export interface AppStoreRenewalInfo {
  readonly willAutoRenew: boolean;
  /** The product the subscription renews into. */
  readonly autoRenewProductId?: string;
  readonly expirationReason?: AppStoreExpirationReason;
  /** When the billing grace period ends, in milliseconds since the epoch. */
  readonly gracePeriodExpiresAt?: number;
  readonly isInBillingRetry: boolean;
  readonly priceIncreaseStatus?: AppStorePriceIncreaseStatus;
  /** What the next renewal costs. */
  readonly renewalPrice?: Price;
  readonly eligibleWinBackOfferIds: ReadonlyArray<string>;
}

/** One of a subscription group's statuses on this device: the end user's own. */
export interface AppStoreSubscriptionStatus {
  readonly state: AppStoreSubscriptionState;
  /** The subscription's latest transaction. */
  readonly transaction: Transaction;
  readonly renewalInfo: AppStoreRenewalInfo;
}

/** StoreKit's `AppStore.Platform`. */
export type AppStorePlatform = "iOS" | "macOS" | "tvOS" | "visionOS" | "unknown";

/** StoreKit's `AppTransaction`: how the end user got the app. */
export interface AppTransaction {
  /** The app version the end user first got. */
  readonly originalAppVersion: string;
  /** When the end user first got the app, in milliseconds since the epoch. */
  readonly originalPurchaseDate: number;
  readonly environment: Environment;
  readonly appTransactionId?: string;
  readonly originalPlatform?: AppStorePlatform;
  /** The app transaction's signed JWS, for your own server to verify. */
  readonly jwsRepresentation: string;
}

/** How `beginRefundRequest()` ended: Apple received the request, or the end user closed the sheet. */
export type RefundRequestStatus = "success" | "userCancelled";

/**
 * A purchase the end user started outside the app, such as a promoted
 * in-app purchase or a win-back offer on the App Store. Complete it with
 * `purchase()`.
 */
export interface AppStorePurchaseIntent {
  readonly productSlug: ProductSlug;
  /** The offer the end user chose, when they chose one. */
  readonly offer?: Offer;
}

const AppStoreOfferValue = Schema.Struct({
  id: optionalNullable(Schema.String),
  type: enumOrUnknown(["introductory", "promotional", "winBack"]),
  paymentMode: PaymentModeValue,
  period: PeriodValue,
  periodCount: Schema.Number,
  price: PriceValue,
});

const AppStoreProductJson = Schema.fromJsonString(
  Schema.Struct({
    subscriptionGroupId: optionalNullable(Schema.String),
    subscriptionGroupLevel: optionalNullable(Schema.Number),
    subscriptionGroupDisplayName: optionalNullable(Schema.String),
    isFamilyShareable: Schema.Boolean,
    productType: enumOrUnknown(["consumable", "nonConsumable", "autoRenewable", "nonRenewable"]),
    introductoryOffer: optionalNullable(AppStoreOfferValue),
    promotionalOffers: listOrEmpty(AppStoreOfferValue),
    winBackOffers: listOrEmpty(AppStoreOfferValue),
    isEligibleForIntroOffer: optionalNullable(Schema.Boolean),
  }),
);

const AppStoreTransactionJson = Schema.fromJsonString(
  Schema.Struct({
    ownershipType: enumOrUnknown(["purchased", "familyShared"]),
    storefrontCountryCode: optionalNullable(Schema.String),
    isUpgraded: Schema.Boolean,
    revocationDate: optionalNullable(Schema.Number),
    revocationReason: optionalNullable(enumOrUnknown(["developerIssue", "other"])),
    appTransactionId: optionalNullable(Schema.String),
    jwsRepresentation: Schema.String,
  }),
);

const AppStoreRenewalInfoJson = Schema.fromJsonString(
  Schema.Struct({
    willAutoRenew: Schema.Boolean,
    autoRenewProductId: optionalNullable(Schema.String),
    expirationReason: optionalNullable(
      enumOrUnknown([
        "autoRenewDisabled",
        "billingError",
        "didNotConsentToPriceIncrease",
        "productUnavailable",
      ]),
    ),
    gracePeriodExpiresAt: optionalNullable(Schema.Number),
    isInBillingRetry: Schema.Boolean,
    priceIncreaseStatus: optionalNullable(
      enumOrUnknown(["noIncreasePending", "pending", "agreed"]),
    ),
    renewalPrice: optionalNullable(PriceValue),
    eligibleWinBackOfferIds: listOrEmpty(Schema.String),
  }),
);

const AppTransactionJson = Schema.fromJsonString(
  Schema.Struct({
    originalAppVersion: Schema.String,
    originalPurchaseDate: Schema.Number,
    environment: EnvironmentValue,
    appTransactionId: optionalNullable(Schema.String),
    originalPlatform: optionalNullable(enumOrUnknown(["iOS", "macOS", "tvOS", "visionOS"])),
    jwsRepresentation: Schema.String,
  }),
);

/** Reads a product's App Store part; `None` when it is not one. */
export const decodeAppStoreProduct = (json: string): Option.Option<AppStoreProductInfo> =>
  Schema.decodeUnknownOption(AppStoreProductJson)(json);

/** Reads a transaction's App Store part; `None` when it is not one. */
export const decodeAppStoreTransaction = (json: string): Option.Option<AppStoreTransactionInfo> =>
  Schema.decodeUnknownOption(AppStoreTransactionJson)(json);

/** Reads a subscription status's renewal info; `None` when it is not one. */
export const decodeAppStoreRenewalInfo = (json: string): Option.Option<AppStoreRenewalInfo> =>
  Schema.decodeUnknownOption(AppStoreRenewalInfoJson)(json);

/** Reads the app transaction; `None` when it is not one. */
export const decodeAppTransaction = (json: string): Option.Option<AppTransaction> =>
  Schema.decodeUnknownOption(AppTransactionJson)(json);
