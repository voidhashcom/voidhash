import AsyncStorage from "@react-native-async-storage/async-storage";
import { Effect, Layer } from "effect";

import { CacheAdapter } from "./cache-adapter";

export const AsyncStorageCacheAdapter = Layer.succeed(CacheAdapter, {
  delete: (key: string) => Effect.promise(() => AsyncStorage.removeItem(key)),
  get: (key: string) => Effect.promise(() => AsyncStorage.getItem(key)),
  set: (key: string, value: string) => Effect.promise(() => AsyncStorage.setItem(key, value)),
} as const);
