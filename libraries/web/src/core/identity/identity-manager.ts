import { VoidhashIdentityError } from "../../errors";
import type { EventBus } from "../event-bus";
import { SdkApiClient } from "../http/sdk-api-client";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { CacheManager } from "../caching/cache-manager";
import type { VoidhashTraits } from "../../types";

const DISTINCT_ID_KEY = "identity:distinct-id";
const ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

const buildTraitsKey = (distinctId: string) => `identity:traits:${distinctId}`;

export class IdentityManager {
  private currentDistinctId: string | null = null;

  constructor(
    private readonly cache: CacheManager,
    private readonly sdkApi: SdkApiClient,
    private readonly eventBus: EventBus,
    private readonly platform = new BrowserPlatformProvider()
  ) {}

  getDistinctId() {
    return this.currentDistinctId;
  }

  async identify(distinctId: string, traits?: VoidhashTraits) {
    const currentDistinctId = await this.requireDistinctId();
    await this.syncTraits(currentDistinctId);
    await this.sdkApi.identify(currentDistinctId, distinctId, traits);
    await this.cache.set(DISTINCT_ID_KEY, distinctId);
    await this.cache.set(buildTraitsKey(distinctId), traits ?? {});
    this.currentDistinctId = distinctId;
    this.eventBus.emit("identity-changed", {
      distinctId,
      previousDistinctId: currentDistinctId,
    });
  }

  async initialize(initialDistinctId?: string) {
    const cachedDistinctId = await this.cache.get<string>(DISTINCT_ID_KEY);
    this.currentDistinctId =
      initialDistinctId ??
      cachedDistinctId?.value ??
      `${ANONYMOUS_DISTINCT_ID_PREFIX}${this.platform.randomId()}`;

    await this.cache.set(DISTINCT_ID_KEY, this.currentDistinctId);

    if (initialDistinctId && cachedDistinctId?.value && cachedDistinctId.value !== initialDistinctId) {
      await this.identify(initialDistinctId);
      return this.currentDistinctId;
    }

    return this.currentDistinctId;
  }

  async reset() {
    const currentDistinctId = await this.requireDistinctId();
    await this.syncTraits(currentDistinctId);
    const nextAnonymousId = `${ANONYMOUS_DISTINCT_ID_PREFIX}${this.platform.randomId()}`;
    await this.cache.set(DISTINCT_ID_KEY, nextAnonymousId);
    await this.cache.set(buildTraitsKey(nextAnonymousId), {});
    this.currentDistinctId = nextAnonymousId;
    this.eventBus.emit("identity-changed", {
      distinctId: nextAnonymousId,
      previousDistinctId: currentDistinctId,
    });
  }

  async syncTraits(distinctId?: string) {
    const resolvedDistinctId = distinctId ?? (await this.requireDistinctId());
    const cachedTraits = await this.cache.get<VoidhashTraits>(
      buildTraitsKey(resolvedDistinctId)
    );
    await this.sdkApi.syncTraits(resolvedDistinctId, cachedTraits?.value);
  }

  private async requireDistinctId() {
    if (!this.currentDistinctId) {
      throw new VoidhashIdentityError("Distinct id has not been initialized.");
    }

    return this.currentDistinctId;
  }
}
