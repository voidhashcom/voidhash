import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Random from "effect/Random";
import * as Result from "effect/Result";

import { SDK_VERSION } from "../constants";
import type { WebSdkHeadersWithoutDistinctId } from "../networking/api-client";

const runtime = ManagedRuntime.make(Layer.empty);

const trimUndefined = (entries: Record<string, unknown>) =>
  R.fromEntries(R.toEntries(entries).filter(([, value]) => !P.isUndefined(value)));

const safeUrl = (value?: string) => {
  if (!value) {
    return Option.none();
  }

  return Result.try({
    try: () => new URL(value),
    catch: (error) => error,
  }).pipe(Result.getSuccess);
};

/** Renders a boolean as the `"true"` / `"false"` literal the SDK headers expect. */
const booleanHeader = (value: boolean) => {
  if (value) {
    return "true";
  }

  return "false";
};

const optionalNavigator = () => {
  if (P.isUndefined(navigator)) {
    return undefined;
  }

  return navigator;
};

const optionalScreen = () => {
  if (P.isUndefined(screen)) {
    return undefined;
  }

  return screen;
};

const optionalViewport = () => {
  if (P.isUndefined(window)) {
    return undefined;
  }

  return {
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
};

const optionalPageTitle = () => {
  if (P.isUndefined(document)) {
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
    Effect.tryPromise({
      try: () => crypto.subtle.digest(algorithm, new Uint8Array(data)),
      catch: (cause) =>
        PlatformError.systemError({
          _tag: "Unknown",
          cause,
          method: "digest",
          module: "WebCrypto",
        }),
    }).pipe(Effect.map((buffer) => new Uint8Array(buffer))),
  // oxlint-disable-next-line effect/noGlobals -- this module IS the browser platform boundary: Effect ships no browser Crypto layer, and the identifiers this feeds must stay unpredictable, so the ambient Random service is deliberately not used (see the webCrypto doc comment above).
  randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
});

const hasWebCrypto = () =>
  // oxlint-disable-next-line effect/noGlobals -- feature detection for the WebCrypto tier: it must probe the ambient global directly, before any Crypto layer can be chosen.
  !P.isUndefined(crypto) && P.hasProperty(crypto, "getRandomValues");

/**
 * Generates an RFC 4122 version 4 UUID.
 *
 * Uses WebCrypto where available and falls back to the ambient `Random` service
 * otherwise — the same two-tier shape the provider had before, where the
 * fallback existed only for environments without `crypto`.
 */
const randomUuid = Effect.suspend(() => {
  if (hasWebCrypto()) {
    return webCrypto.randomUUIDv4.pipe(Effect.catchCause(() => fallbackUuid()));
  }

  return fallbackUuid();
});

const fallbackUuid = Effect.fn("generateFallbackUuid")(function* generateFallbackUuid() {
  const digits = yield* Effect.forEach(
    Arr.range(0, 31),
    () =>
      Random.nextIntBetween(0, HEX_DIGITS.length, { halfOpen: true }).pipe(
        Effect.map((digit) => HEX_DIGITS[digit] ?? "0"),
      ),
    { concurrency: 1 },
  );

  // Version nibble is fixed to 4 and the variant nibble to 8..b, per RFC 4122.
  const variant = yield* Random.nextIntBetween(8, 12, { halfOpen: true });
  const variantDigit = HEX_DIGITS[variant] ?? "8";
  const hex = digits
    .map((digit, index) => (index === 12 ? "4" : index === 16 ? variantDigit : digit))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
});

export class BrowserPlatformProvider {
  private getCurrentUrl() {
    if (P.isUndefined(window)) {
      return Option.none();
    }

    return safeUrl(window.location.href);
  }

  private getReferrerUrl() {
    if (P.isUndefined(document)) {
      return Option.none();
    }

    return safeUrl(document.referrer);
  }

  private isDebugBuild() {
    if (P.isUndefined(window)) {
      return false;
    }

    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  }

  /**
   * Page context captured with every event: where the user is and what they
   * can see. SDK and device facts are not here; they are the standardized
   * `$` properties from {@link buildStandardProperties}, and the server
   * stamps the user agent itself.
   */
  buildAnalyticsContext() {
    const currentUrl = this.getCurrentUrl();
    const referrerUrl = this.getReferrerUrl();
    const screenRef = optionalScreen();
    const viewport = optionalViewport();

    return trimUndefined({
      page_title: optionalPageTitle(),
      referrer_origin: Option.getOrUndefined(Option.map(referrerUrl, (url) => url.origin)),
      referrer_path: Option.getOrUndefined(Option.map(referrerUrl, (url) => url.pathname)),
      screen_height: screenRef?.height,
      screen_width: screenRef?.width,
      url_origin: Option.getOrUndefined(Option.map(currentUrl, (url) => url.origin)),
      url_path: Option.getOrUndefined(Option.map(currentUrl, (url) => url.pathname)),
      viewport_height: viewport?.viewportHeight,
      viewport_width: viewport?.viewportWidth,
    });
  }

  /**
   * The standardized `$` properties merged over every event's properties, the
   * same key vocabulary the native SDKs use. The web SDK has no development
   * mode, so `$environment` is always `production`.
   */
  buildStandardProperties() {
    const navigatorRef = optionalNavigator();
    return {
      $environment: "production",
      $locale: navigatorRef?.language ?? null,
      $platform: "web",
      $sdk: "web",
      $sdk_version: SDK_VERSION,
      $timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    };
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
      "x-environment": "production",
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
    return runtime.runSync(randomUuid);
  }
}
