/** Billing period of a {@link PaywallProduct}. */
export type PaywallProductPeriod = "month" | "year" | "week" | "lifetime";

/**
 * A purchasable product surfaced to a paywall by the native SDK, per contract
 * §7.1. The SDK maps the release's product slugs through its native store
 * metadata (StoreKit / Play Billing) to build this list.
 */
export interface PaywallProduct {
  /** Store product identifier (App Store / Play Store). */
  readonly id: string;
  /** Voidhash product slug. */
  readonly slug: string;
  /** Human-readable name, e.g. "Yearly Pro". */
  readonly displayName: string;
  readonly description?: string;
  /** Raw price amount, when known. */
  readonly price?: number;
  /** Localized, currency-formatted price, e.g. "$59.99". */
  readonly priceString: string;
  readonly currencyCode?: string;
  readonly period?: PaywallProductPeriod;
  /** Free-trial duration string, e.g. "7d", when the product offers one. */
  readonly trialPeriod?: string;
}

/** Author-configurable values the dashboard/experiments can override at runtime. */
export type PaywallVariables = Readonly<Record<string, string | number | boolean>>;

/** Platform the paywall is being presented on. */
export type PaywallPlatform = "ios" | "android" | "web";

/** Safe-area insets in logical/CSS pixels. */
export interface PaywallSafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** A screen-space rectangle in logical/CSS pixels. */
export interface PaywallDimensions {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

/** Rectangle exposed by {@link useDimensions}. */
export type PaywallDimensionTarget = "screen" | "window";

/** Screen and window rectangles available to a paywall. */
export interface PaywallDimensionsByTarget {
  readonly screen: PaywallDimensions;
  readonly window: PaywallDimensions;
}

/**
 * Everything a paywall needs at runtime beyond its own React tree (contract
 * §7.1). The native host injects it as `window.__VOIDHASH_PAYWALL__` when it
 * can, and/or delivers it late via a `configure` bridge message; Studio
 * supplies it with mock data.
 */
export interface PaywallRuntimeConfig {
  readonly products: ReadonlyArray<PaywallProduct>;
  readonly variables: PaywallVariables;
  readonly locale?: string;
  readonly platform?: PaywallPlatform;
  readonly safeAreaInsets?: PaywallSafeAreaInsets;
  readonly dimensions?: PaywallDimensionsByTarget;
  /** Product selected when the paywall first renders. Defaults to the first. */
  readonly defaultSelectedProductId?: string;
}

/** Global name under which the native host injects the runtime config. */
export const RUNTIME_CONFIG_GLOBAL = "__VOIDHASH_PAYWALL__";

declare global {
  interface Window {
    [RUNTIME_CONFIG_GLOBAL]?: PaywallRuntimeConfig;
  }
}

/** A frozen empty config used wherever no products/variables are available. */
export const EMPTY_RUNTIME_CONFIG: PaywallRuntimeConfig = {
  products: [],
  variables: {},
};

/**
 * Fills a partial config (e.g. a `configure` message payload or tree-renderer
 * fixtures) into a complete {@link PaywallRuntimeConfig}.
 */
export const normalizeRuntimeConfig = (
  input: Partial<PaywallRuntimeConfig> | undefined,
): PaywallRuntimeConfig => ({
  products: input?.products ?? [],
  variables: input?.variables ?? {},
  locale: input?.locale,
  platform: input?.platform,
  safeAreaInsets: input?.safeAreaInsets,
  dimensions: input?.dimensions,
  defaultSelectedProductId: input?.defaultSelectedProductId,
});

/**
 * Reads the runtime config the native host injected onto `window`. Falls back
 * to an empty config so the paywall renders immediately (contract §7.1) and
 * picks up products/variables from a later `configure` message.
 */
export const readInjectedConfig = (): PaywallRuntimeConfig => {
  if (typeof window === "undefined") {
    return EMPTY_RUNTIME_CONFIG;
  }
  const injected = window[RUNTIME_CONFIG_GLOBAL];
  return injected ? normalizeRuntimeConfig(injected) : EMPTY_RUNTIME_CONFIG;
};
