import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { NitroModules } from "react-native-nitro-modules";

import type { VoidhashStorage } from "../../specs/VoidhashStorage.nitro";
import { CacheAdapter } from "./cache-adapter";

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
 * A missing native module and a failing native write are defects, not
 * recoverable errors: the adapter contract is infallible and the underlying
 * stores never reject.
 */
export const NativeStorageCacheAdapter = Layer.effect(
  CacheAdapter,
  Effect.map(Effect.orDie(acquireStorage), (storage) => ({
    delete: (key: string) => Effect.tryPromise(() => storage.delete(key)).pipe(Effect.orDie),
    get: (key: string) =>
      Effect.tryPromise(() => storage.get(key)).pipe(
        Effect.map(Option.fromNullishOr),
        Effect.orDie,
      ),
    set: (key: string, value: string) =>
      Effect.tryPromise(() => storage.set(key, value)).pipe(Effect.orDie),
  })),
);
