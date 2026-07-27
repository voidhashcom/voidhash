import type {
  PaywallDimensionsByTarget,
  PaywallPlatform,
  PaywallRuntimeConfig,
  PaywallSafeAreaInsets,
} from "@voidhash/paywalls";

/**
 * Deterministic device metrics used by Studio paywall previews. Insets are
 * intentional preview fixtures rather than hardware specifications.
 */
export interface PreviewDeviceProfile {
  readonly id: string;
  readonly label: string;
  readonly platform: PaywallPlatform;
  readonly safeAreaInsets: PaywallSafeAreaInsets;
  readonly dimensions: PaywallDimensionsByTarget;
}

const dimensions = (width: number, height: number): PaywallDimensionsByTarget => ({
  screen: { width, height, x: 0, y: 0 },
  window: { width, height, x: 0, y: 0 },
});

export const IPHONE_SE_3_PREVIEW_PROFILE: PreviewDeviceProfile = {
  id: "iphone-se-3",
  label: "iPhone SE (3rd generation)",
  platform: "ios",
  safeAreaInsets: { top: 20, right: 0, bottom: 0, left: 0 },
  dimensions: dimensions(375, 667),
};

export const IPHONE_15_PRO_PREVIEW_PROFILE: PreviewDeviceProfile = {
  id: "iphone-15-pro",
  label: "iPhone 15 Pro",
  platform: "ios",
  safeAreaInsets: { top: 59, right: 0, bottom: 34, left: 0 },
  dimensions: dimensions(393, 852),
};

export const PIXEL_8_PREVIEW_PROFILE: PreviewDeviceProfile = {
  id: "pixel-8",
  label: "Pixel 8",
  platform: "android",
  safeAreaInsets: { top: 24, right: 0, bottom: 24, left: 0 },
  dimensions: dimensions(412, 915),
};

/** Device profiles available to a future Studio profile selector. */
export const PREVIEW_DEVICE_PROFILES: ReadonlyArray<PreviewDeviceProfile> = [
  IPHONE_SE_3_PREVIEW_PROFILE,
  IPHONE_15_PRO_PREVIEW_PROFILE,
  PIXEL_8_PREVIEW_PROFILE,
];

/** The profile currently used by Studio until device selection is exposed. */
export const DEFAULT_PREVIEW_DEVICE_PROFILE = IPHONE_15_PRO_PREVIEW_PROFILE;

/** Combines a device profile with Studio's representative products and variables. */
export const previewConfigForDevice = (profile: PreviewDeviceProfile): PaywallRuntimeConfig => ({
  defaultSelectedProductId: "com.example.app.yearly",
  locale: "en-US",
  platform: profile.platform,
  safeAreaInsets: profile.safeAreaInsets,
  dimensions: profile.dimensions,
  products: [
    {
      currencyCode: "USD",
      displayName: "Yearly",
      id: "com.example.app.yearly",
      period: "year",
      price: 59.99,
      priceString: "$59.99",
      slug: "yearly",
      trialPeriod: "7d",
    },
    {
      currencyCode: "USD",
      displayName: "Monthly",
      id: "com.example.app.monthly",
      period: "month",
      price: 9.99,
      priceString: "$9.99",
      slug: "monthly",
    },
    {
      currencyCode: "USD",
      displayName: "Lifetime",
      id: "com.example.app.lifetime",
      period: "lifetime",
      price: 199.99,
      priceString: "$199.99",
      slug: "lifetime",
    },
  ],
  variables: {
    accentColor: "#16a34a",
    ctaLabel: "Continue",
    showTrialBadge: true,
  },
});
