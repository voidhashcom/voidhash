import { VoidhashConfigurationError } from "./errors";
import type {
  AnalyticsFlushResult,
  ResolvedVoidhashConfig,
  VoidhashClientOptions,
  VoidhashTrackOptions,
  VoidhashTraits,
} from "./types";
import { createAnalyticsEvent } from "./core/analytics/analytics-context";
import { AnalyticsDispatcher } from "./core/analytics/analytics-dispatcher";
import { AnalyticsQueue } from "./core/analytics/analytics-queue";
import { CacheManager } from "./core/caching/cache-manager";
import { LocalStorageCacheAdapter } from "./core/caching/adapters/local-storage-cache";
import { MemoryCacheAdapter } from "./core/caching/adapters/memory-cache";
import { EventBus } from "./core/event-bus";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import { AnalyticsHttpClient } from "./core/http/analytics-client";
import { SdkApiClient } from "./core/http/sdk-api-client";
import { IdentityManager } from "./core/identity/identity-manager";
import { BrowserPlatformProvider } from "./core/platform/browser-platform-provider";

const DEFAULT_BASE_URL = "https://api.voidhash.com";

const assertPositiveInteger = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new VoidhashConfigurationError(`${name} must be a positive integer.`);
  }
};

const deriveAnalyticsBaseUrl = (baseUrl: string, override?: string) => {
  if (override) {
    return new URL(override).toString();
  }

  const url = new URL(baseUrl);
  if (url.hostname.startsWith("api.")) {
    url.hostname = `i.${url.hostname.slice(4)}`;
  }

  return url.toString();
};

export const resolveVoidhashConfig = (
  options: VoidhashClientOptions
): ResolvedVoidhashConfig => {
  const baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL).toString();
  const analyticsBaseUrl = deriveAnalyticsBaseUrl(
    baseUrl,
    options.analytics?.baseUrl
  );
  const maxBatchSize = options.analytics?.maxBatchSize ?? 20;
  const maxBatchBytes = options.analytics?.maxBatchBytes ?? 262_144;
  const maxQueueSize = options.analytics?.maxQueueSize ?? 1_000;
  const flushIntervalMs = options.analytics?.flushIntervalMs ?? 5_000;
  const ttlMs = options.featureFlags?.ttlMs ?? 300_000;

  if (!options.publishableKey.trim()) {
    throw new VoidhashConfigurationError("publishableKey is required.");
  }

  assertPositiveInteger("analytics.maxBatchSize", maxBatchSize);
  assertPositiveInteger("analytics.maxBatchBytes", maxBatchBytes);
  assertPositiveInteger("analytics.maxQueueSize", maxQueueSize);
  assertPositiveInteger("analytics.flushIntervalMs", flushIntervalMs);
  assertPositiveInteger("featureFlags.ttlMs", ttlMs);

  return {
    analytics: {
      baseUrl: analyticsBaseUrl,
      enabled: options.analytics?.enabled ?? true,
      flushIntervalMs,
      maxBatchBytes,
      maxBatchSize,
      maxQueueSize,
    },
    baseUrl,
    featureFlags: {
      persist: options.featureFlags?.persist ?? true,
      prefetchOnInit: options.featureFlags?.prefetchOnInit ?? false,
      refreshOnOnline: options.featureFlags?.refreshOnOnline ?? true,
      refreshOnVisibility: options.featureFlags?.refreshOnVisibility ?? true,
      ttlMs,
    },
    distinctId: options.distinctId,
    observerMode: options.observerMode ?? false,
    publishableKey: options.publishableKey,
  };
};

export class VoidhashClientEffect {
  private readonly analyticsDispatcher: AnalyticsDispatcher;
  private readonly analyticsHttpClient: AnalyticsHttpClient;
  private readonly analyticsQueue: AnalyticsQueue;
  private readonly cache: CacheManager;
  private readonly eventBus: EventBus;
  private readonly featureFlags: FeatureFlagService;
  private readonly identityManager: IdentityManager;
  private listeners: Array<() => void> = [];
  private readonly platform: BrowserPlatformProvider;
  private readonly sdkApiClient: SdkApiClient;

  constructor(private readonly config: ResolvedVoidhashConfig) {
    this.platform = new BrowserPlatformProvider();
    this.eventBus = new EventBus();
    this.cache = new CacheManager(
      `@voidhash/web:${this.config.publishableKey}:${this.config.baseUrl}`,
      new MemoryCacheAdapter(),
      LocalStorageCacheAdapter.create()
    );
    this.sdkApiClient = new SdkApiClient(
      this.config.baseUrl,
      this.config.publishableKey,
      this.config.observerMode,
      this.platform
    );
    this.analyticsHttpClient = new AnalyticsHttpClient(
      this.config.analytics.baseUrl,
      this.config.publishableKey
    );
    this.identityManager = new IdentityManager(
      this.cache,
      this.sdkApiClient,
      this.eventBus,
      this.platform
    );
    this.featureFlags = new FeatureFlagService(
      this.cache,
      this.sdkApiClient,
      this.eventBus,
      this.config.featureFlags.ttlMs,
      async () => this.identityManager.getDistinctId()
    );
    this.analyticsQueue = new AnalyticsQueue(
      this.cache,
      this.config.analytics.maxQueueSize
    );
    this.analyticsDispatcher = new AnalyticsDispatcher(
      this.analyticsQueue,
      this.analyticsHttpClient,
      {
        flushIntervalMs: this.config.analytics.flushIntervalMs,
        maxBatchBytes: this.config.analytics.maxBatchBytes,
        maxBatchSize: this.config.analytics.maxBatchSize,
      },
      this.eventBus
    );
  }

  async destroy() {
    this.detachBrowserListeners();
    const flushResult = this.config.analytics.enabled
      ? await this.analyticsDispatcher.flush({ force: true }).catch(() => null)
      : null;
    this.analyticsDispatcher.stop();
    await this.sdkApiClient.destroy();
    return flushResult;
  }

  getDistinctId() {
    return this.identityManager.getDistinctId();
  }

  getEventBus() {
    return this.eventBus;
  }

  getFeatureVariant(key: string) {
    return this.featureFlags.getVariant(key);
  }

  isFeatureEnabled(key: string) {
    return this.featureFlags.isEnabled(key);
  }

  async flushAnalytics(): Promise<AnalyticsFlushResult | null> {
    if (!this.config.analytics.enabled) {
      return null;
    }

    return this.analyticsDispatcher.flush({ force: true });
  }

  async getFeatureFlags(keys?: string[]) {
    return this.featureFlags.getFeatureFlags(keys);
  }

  async identify(externalUserId: string, traits?: VoidhashTraits) {
    await this.identityManager.identify(externalUserId, traits);
    await this.featureFlags.clearCachedFlags();
    await this.featureFlags.refreshTrackedKeySets();
  }

  async initialize() {
    const distinctId = await this.identityManager.initialize(
      this.config.distinctId
    );

    if (this.config.analytics.enabled) {
      this.analyticsDispatcher.start();
    }

    this.attachBrowserListeners();

    if (this.config.featureFlags.prefetchOnInit) {
      await this.featureFlags.getFeatureFlags();
    }

    this.eventBus.emit("initialized", { distinctId });
  }

  async page(
    pageName?: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    const pageProperties = pageName
      ? {
          ...properties,
          page_name: pageName,
        }
      : properties;

    await this.track("page", pageProperties, options);
  }

  async refreshFeatureFlags(keys?: string[]) {
    return this.featureFlags.refreshFeatureFlags(keys);
  }

  async reset() {
    await this.identityManager.reset();
    await this.featureFlags.clearCachedFlags();
    await this.featureFlags.refreshTrackedKeySets();
  }

  async track(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    if (!this.config.analytics.enabled) {
      return;
    }

    const distinctId = await this.identityManager.getDistinctId();
    if (!distinctId) {
      return;
    }

    const event = createAnalyticsEvent(
      this.platform,
      eventName,
      properties,
      options
    );
    const droppedCount = await this.analyticsQueue.enqueue({
      distinctId,
      id: event.event_id,
      payload: event,
    });

    if (droppedCount > 0) {
      this.eventBus.emit("error", {
        message: `Dropped ${droppedCount} analytics event(s) because the queue is full.`,
        source: "analytics",
      });
    }

    const queueSize = await this.analyticsQueue.size();
    if (queueSize >= this.config.analytics.maxBatchSize) {
      await this.analyticsDispatcher.flush();
    }
  }

  private attachBrowserListeners() {
    if (typeof window === "undefined") {
      return;
    }

    const onlineHandler = () => {
      if (this.config.featureFlags.refreshOnOnline) {
        void this.featureFlags.refreshTrackedKeySets();
      }
    };
    const pageHideHandler = () => {
      if (this.config.analytics.enabled) {
        void this.analyticsDispatcher.flush({ force: true, keepalive: true });
      }
    };
    const visibilityHandler = () => {
      if (
        this.config.featureFlags.refreshOnVisibility &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void this.featureFlags.refreshTrackedKeySets();
      }
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("pagehide", pageHideHandler);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler);
    }

    this.listeners.push(() => window.removeEventListener("online", onlineHandler));
    this.listeners.push(() => window.removeEventListener("pagehide", pageHideHandler));
    if (typeof document !== "undefined") {
      this.listeners.push(() =>
        document.removeEventListener("visibilitychange", visibilityHandler)
      );
    }
  }

  private detachBrowserListeners() {
    for (const cleanup of this.listeners.splice(0)) {
      cleanup();
    }
  }
}
