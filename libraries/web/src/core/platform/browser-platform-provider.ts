import * as P from "effect/Predicate";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { VoidhashEventContext } from "../../types";
import { SDK_VERSION } from "../constants";
import type { WebSdkHeadersWithoutDistinctId } from "../networking/api-client";

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
  if (P.isUndefined(globalThis.navigator)) {
    return undefined;
  }

  return navigator;
};

const optionalScreen = () => {
  if (P.isUndefined(globalThis.screen)) {
    return undefined;
  }

  return screen;
};

const optionalViewport = () => {
  if (P.isUndefined(globalThis.window)) {
    return undefined;
  }

  return {
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
};

const optionalPageTitle = () => {
  if (P.isUndefined(globalThis.document)) {
    return undefined;
  }

  return document.title || undefined;
};

/**
 * Sixteen random bytes. The identifiers they feed (`x-nonce`, anonymous
 * distinct ids, event ids) must stay unpredictable, so WebCrypto is used
 * wherever the browser has it; `Math.random` is a last resort for runtimes
 * without it.
 */
const randomBytes = () => {
  const bytes = new Uint8Array(16);
  // oxlint-disable-next-line effect/noGlobals -- this module is the browser platform boundary, and WebCrypto is the browser's source of strong randomness.
  const webCrypto = globalThis.crypto;
  if (!P.isUndefined(webCrypto) && P.hasProperty(webCrypto, "getRandomValues")) {
    return webCrypto.getRandomValues(bytes);
  }
  // oxlint-disable-next-line effect/use-random-service -- the last resort of a runtime without WebCrypto; `Random` is no stronger.
  return bytes.map(() => Math.floor(Math.random() * 256));
};

/**
 * Generates an RFC 4122 version 4 UUID: with `crypto.randomUUID`, which only
 * secure contexts have, else from {@link randomBytes}.
 */
const randomUuid = () => {
  // oxlint-disable-next-line effect/noGlobals -- see `randomBytes`.
  const webCrypto = globalThis.crypto;
  if (!P.isUndefined(webCrypto) && P.hasProperty(webCrypto, "randomUUID")) {
    return webCrypto.randomUUID();
  }
  const bytes = randomBytes();
  // The version nibble is 4 and the variant bits are 10, per RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export class BrowserPlatformProvider {
  /** The page's URL, including its query, which attribution reads. */
  getCurrentUrl(): Option.Option<URL> {
    if (P.isUndefined(globalThis.window)) {
      return Option.none();
    }

    return safeUrl(window.location.href);
  }

  /** Whether the browser has a network connection; `true` where it cannot tell. */
  isOnline() {
    return optionalNavigator()?.onLine !== false;
  }

  /**
   * Whether `fetch` keeps a `keepalive` request going after the page is gone.
   * Browsers that ignore the option cancel the request with the page.
   */
  supportsKeepalive() {
    return !P.isUndefined(globalThis.Request) && "keepalive" in Request.prototype;
  }

  /** The document referrer as a URL; none when there is none. */
  getReferrerUrl(): Option.Option<URL> {
    if (P.isUndefined(globalThis.document)) {
      return Option.none();
    }

    return safeUrl(document.referrer);
  }

  private isDebugBuild() {
    if (P.isUndefined(globalThis.window)) {
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
   *
   * Takes the page and referrer addresses the SDK may record. Without a page
   * address, the page is private, and its title is left out with it.
   */
  buildAnalyticsContext(page: {
    readonly referrerUrl: Option.Option<URL>;
    readonly url: Option.Option<URL>;
  }): VoidhashEventContext {
    const screenRef = optionalScreen();
    const viewport = optionalViewport();
    const pageTitle = Option.isSome(page.url) ? optionalPageTitle() : undefined;

    return {
      ...(pageTitle !== undefined && { page_title: pageTitle }),
      ...Option.match(page.referrerUrl, {
        onNone: () => ({}),
        onSome: (url) => ({ referrer_origin: url.origin, referrer_path: url.pathname }),
      }),
      ...(screenRef !== undefined && {
        screen_height: screenRef.height,
        screen_width: screenRef.width,
      }),
      ...Option.match(page.url, {
        onNone: () => ({}),
        onSome: (url) => ({ url_origin: url.origin, url_path: url.pathname }),
      }),
      ...(viewport !== undefined && {
        viewport_height: viewport.viewportHeight,
        viewport_width: viewport.viewportWidth,
      }),
    };
  }

  /**
   * The standardized `$` properties merged over every event's properties, the
   * same key vocabulary the native SDKs use. Voidhash adds `$environment`, the
   * publishable key's environment, when the event arrives.
   */
  buildStandardProperties() {
    const navigatorRef = optionalNavigator();
    return {
      $locale: navigatorRef?.language ?? null,
      $platform: "web",
      $sdk: "web",
      $sdk_version: SDK_VERSION,
      $timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    };
  }

  /**
   * Headers every SDK request carries. The browser has no store purchases to
   * observe, so it never runs in observer mode.
   */
  getSdkHeaders(publishableKey: string): WebSdkHeadersWithoutDistinctId {
    const navigatorRef = optionalNavigator();

    return {
      "x-client-bundle-id": "",
      "x-client-locale": navigatorRef?.language,
      "x-client-version": undefined,
      "x-is-backgrounded": "false",
      "x-is-debug-build": booleanHeader(this.isDebugBuild()),
      "x-nonce": this.randomId(),
      "x-observer-mode": "false",
      "x-platform": "web",
      "x-platform-brand": undefined,
      "x-platform-device": navigatorRef?.platform,
      "x-platform-flavor": "browser",
      "x-platform-flavor-version": undefined,
      "x-platform-version": navigatorRef?.userAgent,
      "x-preferred-locales": navigatorRef?.languages?.join(","),
      "x-publishable-key": publishableKey,
      "x-sdk": "web",
      "x-sdk-version": SDK_VERSION,
      "x-storefront": undefined,
    };
  }

  randomId() {
    return randomUuid();
  }
}
