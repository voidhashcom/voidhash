import { SDK_VERSION } from "../constants";

const trimUndefined = (entries: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(entries).filter(([, value]) => typeof value !== "undefined")
  );

const safeUrl = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export class BrowserPlatformProvider {
  private getCurrentUrl() {
    if (typeof window === "undefined") {
      return null;
    }

    return safeUrl(window.location.href);
  }

  private getReferrerUrl() {
    if (typeof document === "undefined") {
      return null;
    }

    return safeUrl(document.referrer);
  }

  private isDebugBuild() {
    if (typeof window === "undefined") {
      return false;
    }

    const hostname = window.location.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    );
  }

  buildAnalyticsContext() {
    const currentUrl = this.getCurrentUrl();
    const referrerUrl = this.getReferrerUrl();
    const navigatorRef =
      typeof navigator !== "undefined" ? navigator : undefined;
    const screenRef = typeof screen !== "undefined" ? screen : undefined;
    const viewport =
      typeof window !== "undefined"
        ? {
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          }
        : undefined;

    return trimUndefined({
      locale: navigatorRef?.language,
      page_title:
        typeof document !== "undefined" ? document.title || undefined : undefined,
      referrer_origin: referrerUrl?.origin,
      referrer_path: referrerUrl?.pathname,
      screen_height: screenRef?.height,
      screen_width: screenRef?.width,
      sdk: "web",
      sdk_version: SDK_VERSION,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      url_origin: currentUrl?.origin,
      url_path: currentUrl?.pathname,
      user_agent: navigatorRef?.userAgent,
      viewport_height: viewport?.viewportHeight,
      viewport_width: viewport?.viewportWidth,
    });
  }

  getSdkHeaders(input: {
    observerMode: boolean;
    publishableKey: string;
  }): Record<string, string | undefined> {
    const navigatorRef =
      typeof navigator !== "undefined" ? navigator : undefined;

    return {
      "x-client-bundle-id": "",
      "x-client-locale": navigatorRef?.language,
      "x-client-version": undefined,
      "x-is-backgrounded": "false",
      "x-is-debug-build": this.isDebugBuild() ? "true" : "false",
      "x-nonce": this.randomId(),
      "x-observer-mode": input.observerMode ? "true" : "false",
      "x-platform": "web",
      "x-platform-brand": undefined,
      "x-platform-device": navigatorRef?.platform,
      "x-platform-flavor": "browser",
      "x-platform-flavor-version": undefined,
      "x-platform-version": navigatorRef?.userAgent,
      "x-preferred-locales": navigatorRef?.languages?.join(","),
      "x-publishable-key": input.publishableKey,
      "x-sdk": "web",
      "x-sdk-version": SDK_VERSION,
      "x-storefront": undefined,
    };
  }

  randomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `vh_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}
