import { Crypto, Effect, Random } from "effect";

import { SDK_VERSION } from "../constants";
import type { WebSdkHeadersWithoutDistinctId } from "../networking/api-client";

const trimUndefined = (entries: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => typeof value !== "undefined"));

const safeUrl = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  return Effect.runSync(
    Effect.try({
      try: () => new URL(value),
      catch: () => null,
    }).pipe(Effect.orElseSucceed(() => null)),
  );
};

/** Renders a boolean as the `"true"` / `"false"` literal the SDK headers expect. */
const booleanHeader = (value: boolean) => {
  if (value) {
    return "true";
  }

  return "false";
};

const optionalNavigator = () => {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return navigator;
};

const optionalScreen = () => {
  if (typeof screen === "undefined") {
    return undefined;
  }

  return screen;
};

const optionalViewport = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
};

const optionalPageTitle = () => {
  if (typeof document === "undefined") {
    return undefined;
  }

  return document.title || undefined;
};

const HEX_DIGITS = "0123456789abcdef";

/**
 * WebCrypto-backed `Crypto` service.
 *
 * `crypto.getRandomValues` is read directly because this file IS the browser
 * platform boundary: effect ships no browser `Crypto` layer, and every
 * cryptographically-strong source in a browser ultimately is WebCrypto. The
 * identifiers this produces (`x-nonce`, anonymous distinct ids, event ids) must
 * stay unpredictable, so the ambient `Random` service — which defaults to
 * `Math.random` — is deliberately NOT used here.
 */
const webCrypto = Crypto.make({
  digest: (algorithm, data) =>
    // oxlint-disable-next-line effect/noGlobals -- this module IS the browser platform boundary: Effect ships no browser Crypto layer, so the WebCrypto global is what backs Crypto.make here (see the webCrypto doc comment above).
    Effect.promise(() => crypto.subtle.digest(algorithm, new Uint8Array(data))).pipe(
      Effect.map((buffer) => new Uint8Array(buffer)),
    ),
  // oxlint-disable-next-line effect/noGlobals -- this module IS the browser platform boundary: Effect ships no browser Crypto layer, and the identifiers this feeds must stay unpredictable, so the ambient Random service is deliberately not used (see the webCrypto doc comment above).
  randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
});

const hasWebCrypto = () =>
  // oxlint-disable-next-line effect/noGlobals -- feature detection for the WebCrypto tier: it must probe the ambient global directly, before any Crypto layer can be chosen.
  typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function";

/**
 * Generates an RFC 4122 version 4 UUID.
 *
 * Uses WebCrypto where available and falls back to the ambient `Random` service
 * otherwise — the same two-tier shape the provider had before, where the
 * fallback existed only for environments without `crypto`.
 */
const randomUuid = Effect.suspend(() => {
  if (hasWebCrypto()) {
    return webCrypto.randomUUIDv4.pipe(Effect.catchCause(() => fallbackUuid));
  }

  return fallbackUuid;
});

const fallbackUuid = Effect.gen(function* generateFallbackUuid() {
  const digits: string[] = [];
  for (let index = 0; index < 32; index += 1) {
    const digit = yield* Random.nextIntBetween(0, HEX_DIGITS.length, { halfOpen: true });
    digits.push(HEX_DIGITS[digit] ?? "0");
  }

  // Version nibble is fixed to 4 and the variant nibble to 8..b, per RFC 4122.
  digits[12] = "4";
  const variant = yield* Random.nextIntBetween(8, 12, { halfOpen: true });
  digits[16] = HEX_DIGITS[variant] ?? "8";

  const hex = digits.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
});

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
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  }

  buildAnalyticsContext() {
    const currentUrl = this.getCurrentUrl();
    const referrerUrl = this.getReferrerUrl();
    const navigatorRef = optionalNavigator();
    const screenRef = optionalScreen();
    const viewport = optionalViewport();

    return trimUndefined({
      locale: navigatorRef?.language,
      page_title: optionalPageTitle(),
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
  }): WebSdkHeadersWithoutDistinctId {
    const navigatorRef = optionalNavigator();

    return {
      "x-client-bundle-id": "",
      "x-client-locale": navigatorRef?.language,
      "x-client-version": undefined,
      "x-is-backgrounded": "false",
      "x-is-debug-build": booleanHeader(this.isDebugBuild()),
      "x-nonce": this.randomId(),
      "x-observer-mode": booleanHeader(input.observerMode),
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
    return Effect.runSync(randomUuid);
  }
}
