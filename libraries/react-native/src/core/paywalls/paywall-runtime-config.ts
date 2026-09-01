import type {
  PaywallRuntimeConfig,
  PaywallRuntimeConfigProduct,
  PaywallRuntimeConfigProductPeriod,
} from "../../internal/paywall-bridge/protocol";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { Product } from "../entities/product";
import type { ProductsBySlug } from "../products/product-service";
import type { PaywallReleaseRuntime } from "./paywall-service";

const PERIOD_BY_NORMALIZED_INTERVAL: Readonly<Record<string, PaywallRuntimeConfigProductPeriod>> = {
  // ISO-8601 billing periods (Play Billing `billingPeriod`).
  p1m: "month",
  p1y: "year",
  p1w: "week",
  p7d: "week",
  // Keyword variants seen across store SDK surfaces.
  month: "month",
  monthly: "month",
  year: "year",
  yearly: "year",
  annual: "year",
  week: "week",
  weekly: "week",
  lifetime: "lifetime",
};

/**
 * Maps a native store billing-interval string (StoreKit subscription period
 * unit or Play Billing ISO-8601 `billingPeriod`) to the contract §7.1 period
 * union. Returns `undefined` for unknown/missing intervals — `period` is
 * optional on the wire.
 */
export function mapStoreIntervalToPeriod(
  interval: Option.Option<string>,
): Option.Option<PaywallRuntimeConfigProductPeriod> {
  return Option.flatMap(interval, (value) =>
    Option.fromNullishOr(PERIOD_BY_NORMALIZED_INTERVAL[value.trim().toLowerCase()]),
  );
}

function mapProductToRuntimeConfigProduct(product: Product): PaywallRuntimeConfigProduct {
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.displayName,
    description: Str.isNonEmpty(product.description) ? product.description : undefined,
    price: Number.isFinite(product.price) ? product.price : undefined,
    priceString: product.displayPrice,
    currencyCode: Str.isNonEmpty(product.currency) ? product.currency : undefined,
    // `interval` is only present when the adapter produced a full
    // SubscriptionProduct; plain Product instances leave it undefined.
    period: Option.getOrUndefined(
      mapStoreIntervalToPeriod(
        "interval" in product && P.isString(product.interval)
          ? Option.some(product.interval)
          : Option.none(),
      ),
    ),
    // Trial metadata isn't surfaced by the current native adapters yet.
    trialPeriod: undefined,
  };
}

/**
 * Builds the contract §7.1 `PaywallRuntimeConfig` for a code-release paywall
 * from the release's runtime block and the products resolved from the native
 * store. Pure: product slugs that didn't resolve in the store are skipped
 * (reported via `onSkippedProductSlug`) and an empty products list is valid.
 */
export function buildPaywallRuntimeConfig(options: {
  runtime: PaywallReleaseRuntime;
  productsBySlug: ProductsBySlug;
  platform: "ios" | "android" | "unknown";
  locale: Option.Option<string>;
  onSkippedProductSlug: Option.Option<(slug: string) => void>;
}): PaywallRuntimeConfig {
  const initialProducts: ReadonlyArray<PaywallRuntimeConfigProduct> = [];
  const products = Arr.reduce(options.runtime.productSlugs, initialProducts, (items, slug) => {
    const product = options.productsBySlug[slug] ?? Option.none();
    if (Option.isSome(product)) {
      return [...items, mapProductToRuntimeConfigProduct(product.value)];
    }
    Option.map(options.onSkippedProductSlug, (onSkipped) => onSkipped(slug));
    return items;
  });

  return {
    products: Arr.fromIterable(products),
    variables: R.filter(
      options.runtime.variables,
      (value): value is string | number | boolean =>
        P.isString(value) || P.isNumber(value) || P.isBoolean(value),
    ),
    locale: Option.getOrUndefined(options.locale),
    platform: options.platform === "unknown" ? undefined : options.platform,
    defaultSelectedProductId: products[0]?.id,
  };
}
