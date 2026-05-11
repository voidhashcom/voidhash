import { Effect, Layer, ServiceMap } from "effect";

import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown | null;
    readonly variantKey: string | null;
  }>;
}

const FEATURE_FLAGS_CACHE_TTL_MS = 1000 * 60 * 5;

const generateCacheKey = (flagKeys: string[] | undefined) =>
  `feature-flags:${flagKeys?.sort().join(",") ?? "all"}`;

/**
 * Evaluates feature flags via the SDK API with a 5-minute cache. Emits a
 * `feature-flags-fetched` event on the event bus whenever a fresh result is
 * received from the server (cache hits don't re-emit).
 */
export class FeatureFlagService extends ServiceMap.Service<FeatureFlagService>()(
  "rn-voidhash/FeatureFlagService",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const apiClient = yield* ApiClient;
      const eventBus = yield* EventBusProvider;
      const identityManager = yield* IdentityManager;

      const getFeatureFlags = (flagKeys?: string[]) =>
        Effect.gen(function* () {
          const cacheKey = generateCacheKey(flagKeys);
          const cached = yield* cacheManager.get<FeatureFlagsResult>(cacheKey);
          if (cached && !cached.isExpired && !cached.isStale) {
            return cached.value;
          }

          const commonHeaders = yield* getCommonSdkHeaders();
          const distinctId = yield* identityManager.getDistinctId();
          const result = yield* apiClient.sdk.evaluateFeatureFlags({
            headers: {
              ...commonHeaders,
              "x-distinct-id": distinctId,
            },
            payload: { flagKeys },
          });

          yield* cacheManager.set(cacheKey, result, {
            ttl: FEATURE_FLAGS_CACHE_TTL_MS,
          });

          eventBus.emit("feature-flags-fetched", result);
          return result;
        });

      return { getFeatureFlags } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
