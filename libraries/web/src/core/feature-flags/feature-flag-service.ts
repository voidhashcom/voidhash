import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import type { CacheManager } from "../caching/cache-manager";
import type { EventBus } from "../event-bus";
import { SdkApiClient } from "../http/sdk-api-client";

const serializeKeys = (keys?: ReadonlyArray<string>) =>
  keys && keys.length > 0 ? [...keys].sort().join(",") : "all";

export class FeatureFlagService {
  private latestFlags = new Map<string, FeatureFlagEntry>();
  private trackedKeySets = new Set<string>();

  constructor(
    private readonly cache: CacheManager,
    private readonly sdkApi: SdkApiClient,
    private readonly eventBus: EventBus,
    private readonly ttlMs: number,
    private readonly getDistinctId: () => Promise<string | null>
  ) {}

  async clearCachedFlags() {
    this.latestFlags.clear();
    await this.cache.clearPrefix("feature-flags:");
  }

  getTrackedKeys() {
    return [...this.trackedKeySets];
  }

  getVariant(key: string) {
    return this.latestFlags.get(key) ?? null;
  }

  isEnabled(key: string) {
    return this.latestFlags.get(key)?.enabled ?? false;
  }

  async refreshTrackedKeySets() {
    if (this.trackedKeySets.size === 0) {
      return;
    }

    await Promise.all(
      [...this.trackedKeySets].map((serializedKeys) =>
        this.refreshFeatureFlags(
          serializedKeys === "all" ? undefined : serializedKeys.split(",")
        )
      )
    );
  }

  async getFeatureFlags(keys?: ReadonlyArray<string>) {
    return this.getOrRefreshFeatureFlags(keys, false);
  }

  async refreshFeatureFlags(keys?: ReadonlyArray<string>) {
    return this.getOrRefreshFeatureFlags(keys, true);
  }

  private cacheKey(distinctId: string, keys?: ReadonlyArray<string>) {
    return `feature-flags:${distinctId}:${serializeKeys(keys)}`;
  }

  private async getOrRefreshFeatureFlags(
    keys: ReadonlyArray<string> | undefined,
    forceRefresh: boolean
  ): Promise<FeatureFlagsResult> {
    const distinctId = await this.getDistinctId();
    if (!distinctId) {
      return { flags: [] };
    }

    const cacheKey = this.cacheKey(distinctId, keys);
    const serializedKeys = serializeKeys(keys);
    this.trackedKeySets.add(serializedKeys);

    if (!forceRefresh) {
      const cached = await this.cache.get<FeatureFlagsResult>(cacheKey);
      if (cached && !cached.isExpired && !cached.isStale) {
        this.rememberFlags(cached.value.flags);
        return cached.value;
      }
    }

    const result = await this.sdkApi.evaluateFeatureFlags(distinctId, keys);
    this.rememberFlags(result.flags);
    await this.cache.set(cacheKey, result, { ttl: this.ttlMs });
    this.eventBus.emit("feature-flags-updated", {
      keys,
      result,
    });
    return result;
  }

  private rememberFlags(flags: ReadonlyArray<FeatureFlagEntry>) {
    for (const flag of flags) {
      this.latestFlags.set(flag.key, flag);
    }
  }
}
