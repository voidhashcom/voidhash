/**
 * Generates the client-side runtime script for paywall hydration.
 *
 * This module returns the Preact hydration runtime that is embedded in the
 * HTML output. The bundle is compiled from src/runtime/hydrate.tsx at build
 * time by the paywall runtime Vite plugin (see ../vite-plugin.ts) and
 * includes all necessary components and style builders.
 */

import { getRuntimeBundle } from "./runtime-bundle";

/**
 * Returns the complete runtime script for client-side hydration.
 *
 * The script:
 * 1. Reads the serialized paywall data from __PAYWALL_DATA__ script tag
 * 2. Hydrates the pre-rendered HTML with interactive Preact components
 */
export function generateRuntimeScript(): string {
  return getRuntimeBundle();
}
