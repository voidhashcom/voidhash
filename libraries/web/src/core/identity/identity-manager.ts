import { VoidhashIdentityError } from "../../errors";
import type { EventBus } from "../event-bus";
import { SdkApiClient } from "../http/sdk-api-client";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";
import type { CacheManager } from "../caching/cache-manager";
import type { VoidhashTraits } from "../../types";

const APP_USER_ID_KEY = "identity:app-user-id";
const ANONYMOUS_USER_ID_PREFIX = "vh:anon:";

const buildTraitsKey = (appUserId: string) => `identity:traits:${appUserId}`;

export class IdentityManager {
  private currentAppUserId: string | null = null;

  constructor(
    private readonly cache: CacheManager,
    private readonly sdkApi: SdkApiClient,
    private readonly eventBus: EventBus,
    private readonly platform = new BrowserPlatformProvider()
  ) {}

  getAppUserId() {
    return this.currentAppUserId;
  }

  async identify(appUserId: string, traits?: VoidhashTraits) {
    const currentAppUserId = await this.requireAppUserId();
    await this.syncTraits(currentAppUserId);
    await this.sdkApi.identify(currentAppUserId, appUserId, traits);
    await this.cache.set(APP_USER_ID_KEY, appUserId);
    await this.cache.set(buildTraitsKey(appUserId), traits ?? {});
    this.currentAppUserId = appUserId;
    this.eventBus.emit("identity-changed", {
      appUserId,
      previousAppUserId: currentAppUserId,
    });
  }

  async initialize(initialAppUserId?: string) {
    const cachedAppUserId = await this.cache.get<string>(APP_USER_ID_KEY);
    this.currentAppUserId =
      initialAppUserId ??
      cachedAppUserId?.value ??
      `${ANONYMOUS_USER_ID_PREFIX}${this.platform.randomId()}`;

    await this.cache.set(APP_USER_ID_KEY, this.currentAppUserId);

    if (initialAppUserId && cachedAppUserId?.value && cachedAppUserId.value !== initialAppUserId) {
      await this.identify(initialAppUserId);
      return this.currentAppUserId;
    }

    return this.currentAppUserId;
  }

  async resetIdentity() {
    const currentAppUserId = await this.requireAppUserId();
    await this.syncTraits(currentAppUserId);
    const nextAnonymousId = `${ANONYMOUS_USER_ID_PREFIX}${this.platform.randomId()}`;
    await this.cache.set(APP_USER_ID_KEY, nextAnonymousId);
    await this.cache.set(buildTraitsKey(nextAnonymousId), {});
    this.currentAppUserId = nextAnonymousId;
    this.eventBus.emit("identity-changed", {
      appUserId: nextAnonymousId,
      previousAppUserId: currentAppUserId,
    });
  }

  async syncTraits(appUserId?: string) {
    const resolvedAppUserId = appUserId ?? (await this.requireAppUserId());
    const cachedTraits = await this.cache.get<VoidhashTraits>(
      buildTraitsKey(resolvedAppUserId)
    );
    await this.sdkApi.syncTraits(resolvedAppUserId, cachedTraits?.value);
  }

  private async requireAppUserId() {
    if (!this.currentAppUserId) {
      throw new VoidhashIdentityError("App user id has not been initialized.");
    }

    return this.currentAppUserId;
  }
}
