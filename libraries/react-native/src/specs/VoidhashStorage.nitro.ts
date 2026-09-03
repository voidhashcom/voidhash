import type { HybridObject } from "react-native-nitro-modules";

/**
 * The bare-native SDK's persistent key/value cache store, exposed to the React
 * Native SDK.
 *
 * Backed by `UserDefaults` on iOS and a private `SharedPreferences` file on
 * Android — the exact adapters the Swift and Kotlin clients persist through, so
 * every SDK flavour on a device shares one cache and the JSON envelopes the
 * TypeScript `CacheManager` writes are readable natively.
 */
export interface VoidhashStorage extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  /** Resolves the string stored under [key], or `undefined` when absent. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- Nitro marshals `undefined`, not Option
  get(key: string): Promise<string | undefined>;
  /** Stores [value] under [key], replacing anything already there. */
  set(key: string, value: string): Promise<void>;
  /** Removes the entry stored under [key]. */
  delete(key: string): Promise<void>;
}
