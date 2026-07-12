/**
 * Client-side hydration runtime bundle.
 *
 * The paywall runtime Vite plugin (exported from
 * `@voidhash/paywall-renderer-preact/vite-plugin`) replaces this module
 * at build time with the esbuild-bundled IIFE of `src/runtime/hydrate.tsx`,
 * while non-Vite server runtimes use the generated fallback checked by the
 * package test command.
 */

import { PAYWALL_RUNTIME_BUNDLE } from "./runtime-bundle.generated.ts";

/**
 * Returns the bundled hydration runtime.
 *
 * Returns the current generated fallback when a consuming pipeline does not
 * run the Vite transform.
 */
export function getRuntimeBundle(): string {
  return PAYWALL_RUNTIME_BUNDLE;
}
