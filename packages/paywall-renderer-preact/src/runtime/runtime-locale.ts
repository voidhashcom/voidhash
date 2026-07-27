import { readInjectedConfig } from "@voidhash/paywalls";

/**
 * The locale a hydrating published artifact renders with, in precedence order:
 * the SDK host's injected runtime config (`window.__VOIDHASH_PAYWALL__.locale`,
 * read via `readInjectedConfig`) → the locale embedded in the
 * hydration payload → `undefined` (base/default-locale content). Reading the
 * injected config at mount keeps a published artifact locale-switchable by the
 * SDK with zero server work; the SSR body stays default-locale and hydration
 * re-renders with the resolved locale.
 */
export function resolveRuntimeLocale(payloadLocale: string | undefined): string | undefined {
  return readInjectedConfig().locale ?? payloadLocale;
}
