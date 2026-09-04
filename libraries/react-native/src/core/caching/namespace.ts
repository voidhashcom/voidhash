import * as Arr from "effect/Array";

/**
 * Version of the on-device cache layout. Bumping it moves every entry to a new
 * namespace, so a future SDK release can change the envelope or key scheme
 * without having to recognise and migrate old entries one by one.
 */
export const CACHE_SCHEMA_VERSION = 1;

/**
 * FNV-1a, 32-bit, over the UTF-8 bytes of `value`. Small, dependency-free and
 * stable across JS engines; the same digest the native SDKs derive, so the
 * embedded native client and this SDK land in one namespace on a device.
 */
export const hashCacheNamespace = (value: string) =>
  (
    Arr.reduce(Array.from(new TextEncoder().encode(value)), 0x811c9dc5, (hash, byte) =>
      Math.imul(hash ^ byte, 0x01000193),
    ) >>> 0
  )
    .toString(16)
    .padStart(8, "0");

/**
 * Builds the storage-key prefix for one project on one host:
 * `vh:<cacheSchemaVersion>:<hash(publishableKey + baseUrl)>:`.
 *
 * Namespacing matters on React Native because the SDK shares `AsyncStorage`
 * with the host app: unprefixed keys can collide with the app's own. Keying by
 * publishable key and base URL additionally keeps a staging build's cache from
 * being read by a production one.
 */
export const buildCacheNamespace = (publishableKey: string, baseUrl: string) =>
  `vh:${CACHE_SCHEMA_VERSION}:${hashCacheNamespace(`${publishableKey}|${baseUrl}`)}:`;
