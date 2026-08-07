import { Effect, Layer, Context } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";

import { CacheManager } from "../caching/cache-manager";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import { featureFlagsByKeyAtom, normalizeFeatureFlagKeys } from "../reactivity/client-state";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: string | null;
  }>;
}

const FEATURE_FLAGS_CACHE_TTL_MS = 1000 * 60 * 5;

// Sort a *copy* of the caller's array — the input is part of their data and
// must not be mutated, which the previous in-place `.sort()` was doing.
const generateCacheKey = (flagKeys: string[] | undefined) =>
  `feature-flags:${flagKeys && flagKeys.length > 0 ? [...flagKeys].sort().join(",") : "all"}`;

/**
 * Evaluates feature flags via the SDK API with a 5-minute cache. Publishes
 * each result (cached or fresh) into the reactive `featureFlagsByKeyAtom`
 * keyed by the normalized request signature, so React hooks can subscribe to
 * exactly the slice of state they asked for.
 */
export class FeatureFlagService extends Context.Service<FeatureFlagService>()(
  "rn-voidhash/FeatureFlagService",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const apiClient = yield* ApiClient;
      const atomRegistry = yield* AtomRegistry.AtomRegistry;
      const identityManager = yield* IdentityManager;

      const publishResult = (flagKeys: string[] | undefined, result: FeatureFlagsResult) => {
        const normalizedKey = normalizeFeatureFlagKeys(flagKeys);
        const current = atomRegistry.get(featureFlagsByKeyAtom);
        atomRegistry.set(featureFlagsByKeyAtom, {
          ...current,
          [normalizedKey]: result,
        });
      };

      const getFeatureFlags = (flagKeys?: string[]) =>
        Effect.gen(function* () {
          const cacheKey = generateCacheKey(flagKeys);
          const cached = yield* cacheManager.get<FeatureFlagsResult>(cacheKey);
          if (cached && !cached.isExpired && !cached.isStale) {
            publishResult(flagKeys, cached.value);
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

          publishResult(flagKeys, result);
          return result;
        });

      return { getFeatureFlags } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
