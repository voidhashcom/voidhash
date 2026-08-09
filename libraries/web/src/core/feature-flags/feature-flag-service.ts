import { Effect, Layer, Context } from "effect";

import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient, type WebSdkHeaders } from "../networking/api-client";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const ALL_KEYS = "all";

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && keys.length > 0) {
    return [...keys].sort().join(",");
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

const make = Effect.gen(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const eventBus = yield* EventBusProvider;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;
  const config = yield* SdkConfiguration;

  const latestFlags = new Map<string, FeatureFlagEntry>();
  const trackedKeySets = new Set<string>();

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
    for (const flag of flags) {
      latestFlags.set(flag.key, flag);
    }
  };

  // Sync accessors (plain functions, not Effects)
  const isEnabled = (key: string) => latestFlags.get(key)?.enabled ?? false;

  const getVariant = (key: string) => latestFlags.get(key) ?? null;

  const getOrRefreshFeatureFlags = (
    keys: ReadonlyArray<string> | undefined,
    forceRefresh: boolean,
  ) =>
    Effect.gen(function* getOrRefreshFeatureFlags() {
      const distinctId = identityManager.getDistinctId();
      if (!distinctId) {
        return emptyFlags();
      }

      const cacheKey = buildCacheKey(distinctId, keys);
      const serializedKeys = serializeKeys(keys);
      trackedKeySets.add(serializedKeys);

      if (!forceRefresh) {
        const cached = yield* cacheManager.get<FeatureFlagsResult>(cacheKey);
        if (cached && !cached.isExpired && !cached.isStale) {
          rememberFlags(cached.value.flags);
          return cached.value;
        }
      }

      const result = yield* apiClient.sdk.evaluateFeatureFlags({
        headers: buildHeaders(distinctId),
        payload: buildEvaluatePayload(keys),
      });

      rememberFlags(result.flags);
      yield* cacheManager.set(cacheKey, result, {
        ttl: config.featureFlags.ttlMs,
      });
      eventBus.emit("feature-flags-updated", { keys, result });
      return result;
    });

  const getFeatureFlags = (keys?: ReadonlyArray<string>) => getOrRefreshFeatureFlags(keys, false);

  const refreshFeatureFlags = (keys?: ReadonlyArray<string>) =>
    getOrRefreshFeatureFlags(keys, true);

  const refreshTrackedKeySets = () =>
    Effect.gen(function* refreshTrackedKeySets() {
      if (trackedKeySets.size === 0) return;

      yield* Effect.all(
        [...trackedKeySets].map((serializedKeys) =>
          refreshFeatureFlags(deserializeKeys(serializedKeys)),
        ),
        { concurrency: "unbounded" },
      );
    });

  const clearCachedFlags = () =>
    Effect.gen(function* clearCachedFlags() {
      latestFlags.clear();
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
  Effect.Success<typeof make>
>()("web-voidhash/FeatureFlagService") {
  static Default = Layer.effect(FeatureFlagService, make);
}
