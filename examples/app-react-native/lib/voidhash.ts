import { createVoidhashClient } from "@voidhash/react-native";

// `process.env.EXPO_PUBLIC_*` must stay a literal member expression: Expo's
// Babel plugin replaces these exact expressions with string literals at build
// time, so reading them through a variable or a helper yields `undefined`.
const publishableKey = process.env.EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY ?? "";
const baseUrl = process.env.EXPO_PUBLIC_VOIDHASH_BASE_URL;
const debug = process.env.EXPO_PUBLIC_VOIDHASH_DEBUG === "true";

/**
 * Whether `EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY` was set at build time. The app
 * shows a setup screen instead of the tabs when it wasn't.
 */
export const hasPublishableKey = publishableKey.length > 0;

/**
 * The Voidhash client for Nimbus. One per app, created at module scope so the
 * provider, the hooks and any imperative call site share the same instance.
 *
 * The purchase callback scheme is read from `expo.scheme` in `app.json`.
 */
export const voidhash = createVoidhashClient(publishableKey, {
  ...(baseUrl ? { baseUrl } : {}),
  debug,
  // Development mode swaps the real store for a fake one, so a purchase
  // completes on a simulator with no App Store Connect or Play Console setup.
  // The SDK ignores it unless `__DEV__` is true, so release builds are unaffected.
  dev: true,
  // Without a key there is nothing to talk to. A disabled client mounts every
  // hook and no-ops every call, which keeps hook order identical to a
  // configured build instead of crashing on the first request.
  enabled: hasPublishableKey,
});
