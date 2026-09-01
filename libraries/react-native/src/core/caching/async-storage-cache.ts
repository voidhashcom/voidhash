import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { CacheAdapter } from "./cache-adapter";

export const AsyncStorageCacheAdapter = Layer.succeed(CacheAdapter, {
  delete: (key: string) => Effect.tryPromise(() => AsyncStorage.removeItem(key)),
  get: (key: string) =>
    Effect.tryPromise(() => AsyncStorage.getItem(key)).pipe(
      Effect.map(Option.fromNullishOr),
      Effect.orDie,
    ),
  set: (key: string, value: string) => Effect.tryPromise(() => AsyncStorage.setItem(key, value)),
} as const);
