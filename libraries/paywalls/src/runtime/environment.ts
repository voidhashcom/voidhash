import { useEffect, useState } from "react";

import type {
  PaywallDimensions,
  PaywallDimensionsByTarget,
  PaywallPlatform,
  PaywallRuntimeConfig,
  PaywallSafeAreaInsets,
} from "./config";

const ZERO_DIMENSIONS: PaywallDimensions = {
  width: 0,
  height: 0,
  x: 0,
  y: 0,
};

const ZERO_SAFE_AREA_INSETS: PaywallSafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const EMPTY_BROWSER_ENVIRONMENT: BrowserEnvironmentSnapshot = {
  dimensions: {
    screen: ZERO_DIMENSIONS,
    window: ZERO_DIMENSIONS,
  },
  safeAreaInsets: ZERO_SAFE_AREA_INSETS,
};

interface BrowserEnvironmentSnapshot {
  readonly dimensions: PaywallDimensionsByTarget;
  readonly safeAreaInsets: PaywallSafeAreaInsets;
}

export interface ResolvedPaywallEnvironment extends BrowserEnvironmentSnapshot {
  readonly platform: PaywallPlatform;
}

const finiteOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

const parseCssPixels = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const readSafeAreaInsets = (probe: HTMLElement | null): PaywallSafeAreaInsets => {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
    return ZERO_SAFE_AREA_INSETS;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const customProperties = {
    top: rootStyle.getPropertyValue("--voidhash-safe-area-top"),
    right: rootStyle.getPropertyValue("--voidhash-safe-area-right"),
    bottom: rootStyle.getPropertyValue("--voidhash-safe-area-bottom"),
    left: rootStyle.getPropertyValue("--voidhash-safe-area-left"),
  };
  if (Object.values(customProperties).some((value) => value.trim() !== "")) {
    return {
      top: parseCssPixels(customProperties.top),
      right: parseCssPixels(customProperties.right),
      bottom: parseCssPixels(customProperties.bottom),
      left: parseCssPixels(customProperties.left),
    };
  }

  if (!probe) {
    return ZERO_SAFE_AREA_INSETS;
  }
  const style = getComputedStyle(probe);
  return {
    top: parseCssPixels(style.paddingTop),
    right: parseCssPixels(style.paddingRight),
    bottom: parseCssPixels(style.paddingBottom),
    left: parseCssPixels(style.paddingLeft),
  };
};

const measureBrowserEnvironment = (probe: HTMLElement | null): BrowserEnvironmentSnapshot => {
  if (typeof window === "undefined") {
    return EMPTY_BROWSER_ENVIRONMENT;
  }

  const screenWidth = finiteOr(window.screen?.width, finiteOr(window.innerWidth, 0));
  const screenHeight = finiteOr(window.screen?.height, finiteOr(window.innerHeight, 0));
  const windowWidth = finiteOr(window.innerWidth, screenWidth);
  const windowHeight = finiteOr(window.innerHeight, screenHeight);

  return {
    dimensions: {
      screen: {
        width: screenWidth,
        height: screenHeight,
        x: 0,
        y: 0,
      },
      window: {
        width: windowWidth,
        height: windowHeight,
        x: finiteOr(window.screenX, 0),
        y: finiteOr(window.screenY, 0),
      },
    },
    safeAreaInsets: readSafeAreaInsets(probe),
  };
};

const dimensionsEqual = (left: PaywallDimensions, right: PaywallDimensions): boolean =>
  left.width === right.width &&
  left.height === right.height &&
  left.x === right.x &&
  left.y === right.y;

const snapshotsEqual = (
  left: BrowserEnvironmentSnapshot,
  right: BrowserEnvironmentSnapshot,
): boolean =>
  dimensionsEqual(left.dimensions.screen, right.dimensions.screen) &&
  dimensionsEqual(left.dimensions.window, right.dimensions.window) &&
  left.safeAreaInsets.top === right.safeAreaInsets.top &&
  left.safeAreaInsets.right === right.safeAreaInsets.right &&
  left.safeAreaInsets.bottom === right.safeAreaInsets.bottom &&
  left.safeAreaInsets.left === right.safeAreaInsets.left;

const createSafeAreaProbe = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
  });
  document.documentElement.append(probe);
  return probe;
};

/** Observes browser geometry and safe-area changes for one runtime provider. */
export const useBrowserEnvironment = (enabled: boolean): BrowserEnvironmentSnapshot => {
  const [snapshot, setSnapshot] = useState<BrowserEnvironmentSnapshot>(() =>
    measureBrowserEnvironment(null),
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const probe = createSafeAreaProbe();
    const update = () => {
      const next = measureBrowserEnvironment(probe);
      setSnapshot((current) => (snapshotsEqual(current, next) ? current : next));
    };
    const visualViewport = window.visualViewport;

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      probe?.remove();
    };
  }, [enabled]);

  return snapshot;
};

/** Resolves explicit host configuration over the latest browser measurement. */
export const resolvePaywallEnvironment = (
  config: PaywallRuntimeConfig,
  browser: BrowserEnvironmentSnapshot,
): ResolvedPaywallEnvironment => {
  const platform = config.platform ?? "web";
  const screen = config.dimensions?.screen ?? browser.dimensions.screen;
  const windowDimensions =
    config.dimensions?.window ?? (platform === "web" ? browser.dimensions.window : screen);

  return {
    platform,
    safeAreaInsets: config.safeAreaInsets ?? browser.safeAreaInsets,
    dimensions: {
      screen: platform === "web" || config.dimensions ? screen : { ...screen, x: 0, y: 0 },
      window:
        platform === "web" || config.dimensions
          ? windowDimensions
          : { ...windowDimensions, x: 0, y: 0 },
    },
  };
};
