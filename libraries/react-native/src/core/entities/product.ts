import type { ProductSlug, RegisteredProductTypes } from "../schema/registry";
import type { AppStoreProductInfo } from "./app-store";
import type { GooglePlayProductInfo } from "./google-play";

/** An amount of money as the store sells it. */
export interface Price {
  /** The amount in the currency's units, such as `9.99`. */
  readonly amount: number;
  /** `amount` × 1,000,000, exact: use it to compare or add prices. */
  readonly amountMicros: number;
  /** ISO 4217 currency code, such as `USD`. */
  readonly currencyCode: string;
  /** The store's localized price, such as `$9.99`: show it as it is. */
  readonly formatted: string;
}

/** The unit of a {@link Period}. `unknown` is a unit this SDK version cannot read. */
export type PeriodUnit = "day" | "week" | "month" | "year" | "unknown";

/** A length of time, such as a billing period or a free trial. */
export interface Period {
  readonly unit: PeriodUnit;
  /** How many units, at least 1. Seven days are reported as one week. */
  readonly count: number;
  /** ISO 8601 duration, such as `P1W`, `P3M` or `P1Y`. */
  readonly iso8601: string;
}

/** How a {@link PricingPhase} is paid. */
export type PaymentMode = "freeTrial" | "payAsYouGo" | "payUpFront" | "unknown";

/** One phase of an offer: a price that applies for a number of billing cycles. */
export interface PricingPhase {
  readonly paymentMode: PaymentMode;
  /** What one cycle costs; zero for a free trial. */
  readonly price: Price;
  /** The length of one cycle. */
  readonly period: Period;
  /** How many cycles the phase lasts, at least 1. */
  readonly cycles: number;
}

/**
 * What an offer is:
 *
 * - `introductory`: a free trial or introductory price for new subscribers.
 * - `promotional`: a discount for current or former subscribers, or one you
 *   configured in Studio.
 * - `winBack`: an App Store offer to win back a former subscriber.
 * - `oneTime`: a discounted price of a one-time product on Google Play.
 */
export type OfferKind = "introductory" | "promotional" | "winBack" | "oneTime" | "unknown";

/** A discount the end user can buy a product with. */
export interface Offer {
  /**
   * On Google Play, the offer's id in Studio when it is configured there,
   * otherwise Google Play's offer id. On the App Store, a promotional offer's
   * Studio id (only offers configured in Studio are listed), a win-back
   * offer's App Store id, and `""` for the introductory offer, which has none.
   * Not unique on its own: key a list by `kind` and `id` together.
   */
  readonly id: string;
  readonly kind: OfferKind;
  /**
   * For a subscription offer, its phases before the regular price starts, in
   * order. Empty for a `oneTime` offer.
   */
  readonly phases: ReadonlyArray<PricingPhase>;
  /** For a `oneTime` offer, what the product costs with it; absent for subscription offers. */
  readonly price?: Price;
}

/** What a subscription product renews at. */
export interface SubscriptionInfo {
  /** The length of one billing period. */
  readonly period: Period;
  /**
   * The App Store subscription group id; on Google Play, the subscription's
   * product id; in development mode, the development product id.
   */
  readonly groupId: string;
  /**
   * The free trial or introductory price this end user can get right now;
   * absent when they are not eligible for one. A purchase applies it by
   * default.
   */
  readonly introOffer?: Offer;
  /** The regular price per day, rounded to the currency's minor units. */
  readonly pricePerDay: Price;
  /** The regular price per week. */
  readonly pricePerWeek: Price;
  /** The regular price per month. */
  readonly pricePerMonth: Price;
  /** The regular price per year. */
  readonly pricePerYear: Price;
}

/** The store that sells a product; `development` for test purchases in development mode. */
export type Store = "appStore" | "googlePlay" | "development" | "unknown";

/**
 * What kind of product it is: a `subscription`, a `consumable` that can be
 * bought again and again, a `nonConsumable` bought once, or (App Store only) a
 * `nonRenewingSubscription`.
 */
export type ProductType =
  | "subscription"
  | "consumable"
  | "nonConsumable"
  | "nonRenewingSubscription"
  | "unknown";

/** What every product has, whatever its type. */
interface ProductFields {
  /** The product's id in Voidhash, as `Subscription.productId` names it. */
  readonly productId: string;
  /** The product's slug in Studio. */
  readonly slug: ProductSlug;
  readonly store: Store;
  /** The product's id in the store: the App Store product id or the Google Play product id. */
  readonly storeProductId: string;
  /** The product's name in Studio. */
  readonly name: string;
  /** The product's title in the store, localized for the end user. */
  readonly displayName: string;
  /** The product's description in the store, localized for the end user. */
  readonly description: string;
  /** The regular price; on Google Play, the recurring price of the product's base plan. */
  readonly price: Price;
  /**
   * The offers this end user can buy the product with, besides the
   * introductory offer in `subscription.introOffer`.
   */
  readonly offers: ReadonlyArray<Offer>;
  /** The App Store's own view of the product; present when `store` is `appStore`. */
  readonly appStore?: AppStoreProductInfo;
  /** Google Play's own view of the product; present when `store` is `googlePlay`. */
  readonly googlePlay?: GooglePlayProductInfo;
}

/** A product that renews until it is canceled. */
export interface SubscriptionProduct extends ProductFields {
  readonly type: "subscription";
  readonly subscription: SubscriptionInfo;
}

/** A product that can be bought again and again, such as coins. */
export interface ConsumableProduct extends ProductFields {
  readonly type: "consumable";
  readonly subscription?: undefined;
}

/** A product bought once that stays bought, such as a lifetime unlock. */
export interface NonConsumableProduct extends ProductFields {
  readonly type: "nonConsumable";
  readonly subscription?: undefined;
}

/** An App Store subscription that does not renew by itself. */
export interface NonRenewingSubscriptionProduct extends ProductFields {
  readonly type: "nonRenewingSubscription";
  readonly subscription?: undefined;
}

/** A product of a type this SDK version cannot read. */
export interface UnknownTypeProduct extends ProductFields {
  readonly type: "unknown";
  readonly subscription?: SubscriptionInfo;
}

/** A product as the store sells it to this end user; narrow it on `type`. */
export type Product =
  | SubscriptionProduct
  | ConsumableProduct
  | NonConsumableProduct
  | NonRenewingSubscriptionProduct
  | UnknownTypeProduct;

/**
 * The product a slug of a Studio product type is, as the register of
 * `voidhash-cli types generate` names the type: a `subscription` is a
 * {@link SubscriptionProduct}, a `consumable` (Studio's one-time consumable)
 * a {@link ConsumableProduct}, and a `nonConsumable` (Studio's one-time) a
 * {@link NonConsumableProduct} or, when the App Store sells it as one, a
 * {@link NonRenewingSubscriptionProduct}. The SDK leaves out a product the
 * store sells as another type, reporting it, so a slug's product is of its
 * type or missing.
 */
export type ProductOfType<Type> = Type extends "subscription"
  ? SubscriptionProduct
  : Type extends "consumable"
    ? ConsumableProduct
    : Type extends "nonConsumable"
      ? NonConsumableProduct | NonRenewingSubscriptionProduct
      : Product;

/** The product `slug` names, by the product types in `Types`. */
export type ProductForSlugIn<Types, Slug> = Slug extends keyof Types
  ? ProductOfType<Types[Slug]>
  : Product;

/**
 * The product a slug names. With the types `voidhash-cli types generate`
 * writes, it is typed by its slug's Studio type (see {@link ProductOfType}),
 * so a subscription's slug is a {@link SubscriptionProduct}; without them,
 * any {@link Product}.
 */
export type ProductForSlug<Slug> = ProductForSlugIn<RegisteredProductTypes, Slug>;

/** The products `slugs` name, in their order; `undefined` where the store has none. */
export type ProductsForSlugsIn<Types, Slugs extends ReadonlyArray<unknown>> = {
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  -readonly [Index in keyof Slugs]: ProductForSlugIn<Types, Slugs[Index]> | undefined;
};

/** The products `slugs` name, typed per slug; see {@link ProductForSlug}. */
export type ProductsForSlugs<Slugs extends ReadonlyArray<unknown>> = ProductsForSlugsIn<
  RegisteredProductTypes,
  Slugs
>;

/**
 * How Google Play moves a subscriber from the subscription a purchase
 * replaces to the one it buys.
 *
 * - `withTimeProration`: nothing is charged now. The time left on the old
 *   subscription is converted, by price, into time on the new one, which
 *   moves the next billing date. The default; it suits upgrades and
 *   downgrades alike.
 * - `chargeProratedPrice`: the billing date stays, and the price difference
 *   for the rest of the period is charged now. Google Play accepts it only
 *   for an upgrade, a subscription that costs more per unit of time.
 * - `chargeFullPrice`: the full price of the new subscription is charged now,
 *   and what was left of the old one is credited to it.
 * - `withoutProration`: the billing date stays, and the new price is first
 *   charged on it.
 * - `deferred`: the old subscription runs until its next renewal, which
 *   renews into the new one. Until then the purchase's transaction names the
 *   old product, and the subscription reports the change as
 *   `renewsToProductSlug`.
 */
export type SubscriptionReplacementMode =
  | "withTimeProration"
  | "chargeProratedPrice"
  | "chargeFullPrice"
  | "withoutProration"
  | "deferred";

/**
 * The subscription a purchase replaces on Google Play: an upgrade, a
 * downgrade or a change of plan, instead of a second subscription next to the
 * first.
 */
export interface SubscriptionReplacement {
  /** The subscription product the end user has now and the purchase ends. */
  readonly product: Product;
  /** What Google Play charges when. Default `"withTimeProration"`. */
  readonly mode?: SubscriptionReplacementMode;
}
