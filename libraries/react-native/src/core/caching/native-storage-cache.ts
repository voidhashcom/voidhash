import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { NitroModules } from "react-native-nitro-modules";

import type { VoidhashStorage } from "../../specs/VoidhashStorage.nitro";
import { CacheAdapter, CacheReadFailed, CacheWriteFailed } from "./cache-adapter";

/** The `VoidhashStorage` hybrid could not be created: the installed binary predates this package version. */
export class NativeStorageUnavailableError extends Schema.TaggedErrorClass<NativeStorageUnavailableError>()(
  "NativeStorageUnavailableError",
  { cause: Schema.Unknown, message: Schema.String },
) {}

const acquireStorage = Effect.try({
  catch: (cause) =>
    new NativeStorageUnavailableError({
      cause,
      message:
        "STORAGE_UNAVAILABLE: the VoidhashStorage native module is missing. Rebuild the app after installing @voidhash/react-native.",
    }),
  try: () => NitroModules.createHybridObject<VoidhashStorage>("VoidhashStorage"),
});

/**
 * `CacheAdapter` backed by the `VoidhashStorage` Nitro hybrid: the same
 * `UserDefaults` / `SharedPreferences` store the bare Swift and Kotlin SDKs
 * persist their caches to, so every SDK flavour on a device reads and writes
 * one cache.
 *
 * A missing native module is a defect — the binary does not match the
 * package. A native call that rejects is a typed `CacheReadFailed` /
 * `CacheWriteFailed`, which the callers absorb: the SDK keeps running from
 * memory and reports the fault through diagnostics.
 */
export const NativeStorageCacheAdapter = Layer.effect(
  CacheAdapter,
  Effect.map(Effect.orDie(acquireStorage), (storage) => ({
    delete: (key: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new CacheWriteFailed({
            cause,
            key,
            message: `Native storage delete failed for "${key}"`,
          }),
        try: () => storage.delete(key),
      }),
    get: (key: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new CacheReadFailed({ cause, key, message: `Native storage read failed for "${key}"` }),
        try: () => storage.get(key),
      }).pipe(Effect.map(Option.fromNullishOr)),
    set: (key: string, value: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new CacheWriteFailed({ cause, key, message: `Native storage write failed for "${key}"` }),
        try: () => storage.set(key, value),
      }),
  })),
);
