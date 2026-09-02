import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Str from "effect/String";

import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient, type WebSdkHeaders } from "../networking/api-client";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const ALL_KEYS = "all";

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && Arr.isReadonlyArrayNonEmpty(keys)) {
    return Arr.sort(keys, Str.Order).join(",");
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  return serializedKeys.split(",");
};

const emptyFlags = (): FeatureFlagsResult => ({ flags: [] });

const buildEvaluatePayload = (keys?: ReadonlyArray<string>) => {
  if (!keys) {
    return {};
  }

  return { flagKeys: [...keys] };
};

const make = Effect.fn("makeFeatureFlagService")(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const eventBus = yield* EventBusProvider;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;
  const config = yield* SdkConfiguration;

  let latestFlags = HashMap.empty<string, FeatureFlagEntry>();
  let trackedKeySets = HashSet.empty<string>();

  const buildHeaders = (distinctId: string): WebSdkHeaders => ({
    ...platform.getSdkHeaders({
      observerMode: config.observerMode,
      publishableKey: config.publishableKey,
    }),
    "x-distinct-id": distinctId,
  });

  const buildCacheKey = (distinctId: string, keys?: ReadonlyArray<string>) =>
    `feature-flags:${distinctId}:${serializeKeys(keys)}`;

  const rememberFlags = (flags: ReadonlyArray<FeatureFlagEntry>) => {
    latestFlags = Arr.reduce(flags, latestFlags, (entries, flag) =>
      HashMap.set(entries, flag.key, flag),
    );
  };

  // Sync accessors (plain functions, not Effects)
  const isEnabled = (key: string) =>
    HashMap.get(latestFlags, key).pipe(
      Option.map((flag) => flag.enabled),
      Option.getOrElse(() => false),
    );

  const getVariant = (key: string) => HashMap.get(latestFlags, key);

  const getOrRefreshFeatureFlags = (forceRefresh: boolean, keys?: ReadonlyArray<string>) =>
    Effect.gen(function* getOrRefreshFeatureFlags() {
      const distinctId = identityManager.getDistinctId();
      if (Option.isNone(distinctId)) {
        return emptyFlags();
      }

      const cacheKey = buildCacheKey(distinctId.value, keys);
      const serializedKeys = serializeKeys(keys);
      trackedKeySets = HashSet.add(trackedKeySets, serializedKeys);

      if (!forceRefresh) {
        const cached = yield* cacheManager.get<FeatureFlagsResult>(cacheKey);
        if (Option.isSome(cached) && !cached.value.isExpired && !cached.value.isStale) {
          rememberFlags(cached.value.value.flags);
          return cached.value.value;
        }
      }

      const result = yield* apiClient.sdk.evaluateFeatureFlags({
        headers: buildHeaders(distinctId.value),
        payload: buildEvaluatePayload(keys),
      });

      rememberFlags(result.flags);
      yield* cacheManager.set(cacheKey, result, {
        ttl: config.featureFlags.ttlMs,
      });
      eventBus.emit("feature-flags-updated", { keys, result });
      return result;
    });

  const getFeatureFlags = (keys?: ReadonlyArray<string>) => getOrRefreshFeatureFlags(false, keys);

  const refreshFeatureFlags = (keys?: ReadonlyArray<string>) =>
    getOrRefreshFeatureFlags(true, keys);

  const refreshTrackedKeySets = () =>
    Effect.gen(function* refreshTrackedKeySets() {
      if (HashSet.isEmpty(trackedKeySets)) return;

      yield* Effect.all(
        Arr.fromIterable(trackedKeySets).map((serializedKeys) =>
          refreshFeatureFlags(deserializeKeys(serializedKeys)),
        ),
        { concurrency: "unbounded" },
      );
    });

  const clearCachedFlags = () =>
    Effect.gen(function* clearCachedFlags() {
      latestFlags = HashMap.empty();
      yield* cacheManager.clearPrefix("feature-flags:");
    });

  return {
    clearCachedFlags,
    getFeatureFlags,
    getVariant,
    isEnabled,
    refreshFeatureFlags,
    refreshTrackedKeySets,
  };
});

export class FeatureFlagService extends Context.Service<
  FeatureFlagService,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/FeatureFlagService") {
  static Default = Layer.effect(FeatureFlagService, make());
}
