import type {
  PaywallRuntimeConfig,
  PaywallRuntimeConfigProduct,
  PaywallRuntimeConfigProductPeriod,
} from "../../internal/paywall-bridge/protocol";
import type { SubscriptionProduct } from "../entities/product";
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
  interval: string | undefined,
): PaywallRuntimeConfigProductPeriod | undefined {
  if (!interval) {
    return;
  }
  return PERIOD_BY_NORMALIZED_INTERVAL[interval.trim().toLowerCase()];
}

function mapProductToRuntimeConfigProduct(
  product: SubscriptionProduct,
): PaywallRuntimeConfigProduct {
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.displayName,
    description: product.description.length > 0 ? product.description : undefined,
    price: Number.isFinite(product.price) ? product.price : undefined,
    priceString: product.displayPrice,
    currencyCode: product.currency.length > 0 ? product.currency : undefined,
    // `interval` is only present when the adapter produced a full
    // SubscriptionProduct; plain Product instances leave it undefined.
    period: mapStoreIntervalToPeriod((product as Partial<SubscriptionProduct>).interval),
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
  productsBySlug: Readonly<Record<string, SubscriptionProduct | null>>;
  platform: "ios" | "android" | "unknown";
  locale: string | undefined;
  onSkippedProductSlug?: (slug: string) => void;
}): PaywallRuntimeConfig {
  const products: PaywallRuntimeConfigProduct[] = [];

  for (const slug of options.runtime.productSlugs) {
    const product = options.productsBySlug[slug] ?? null;
    if (!product) {
      options.onSkippedProductSlug?.(slug);
      continue;
    }
    products.push(mapProductToRuntimeConfigProduct(product));
  }

  return {
    products,
    variables: options.runtime.variables,
    locale: options.locale,
    platform: options.platform === "unknown" ? undefined : options.platform,
    defaultSelectedProductId: products[0]?.id,
  };
}
