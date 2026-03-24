import { Cause, Effect, Exit } from "effect";

import { VoidhashDestroyedError, VoidhashError, VoidhashNotInitializedError } from "./errors";
import {
  CreateEffectRuntime,
  flushAnalyticsEffect,
  flushAnalyticsKeepaliveEffect,
  getFeatureFlagsEffect,
  identifyEffect,
  initializeEffect,
  refreshFeatureFlagsEffect,
  refreshTrackedKeySetsEffect,
  resetEffect,
  resolveVoidhashConfig,
  startAnalyticsEffect,
  stopAnalyticsEffect,
  trackEffect,
} from "./client-effect";
import { EventBus } from "./core/event-bus";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import { IdentityManager } from "./core/identity/identity-manager";
import type {
  AnalyticsFlushResult,
  FeatureFlagsResult,
  VoidhashClientOptions,
  VoidhashEventMap,
  VoidhashEventName,
  VoidhashTrackOptions,
  VoidhashTraits,
} from "./types";

type ClientState = "destroyed" | "idle" | "initializing" | "ready";

const toError = (errorCode: string, cause: unknown) => {
  const error =
    cause instanceof Error ? cause : new Error(String(cause));
  return new VoidhashError(`${errorCode}: ${error.message}`, {
    cause: error,
  });
};

export class VoidhashWebClient {
  private readonly eventBus: EventBus;
  private readonly runtime: ReturnType<typeof CreateEffectRuntime>;
  private state: ClientState = "idle";
  private initializePromise: Promise<void> | null = null;
  private listeners: Array<() => void> = [];
  private inFlightFlush: Promise<AnalyticsFlushResult | null> | null = null;

  // Service references for sync access (set during init)
  private featureFlagService: InstanceType<typeof FeatureFlagService> | null = null;
  private identityManagerService: InstanceType<typeof IdentityManager> | null = null;

  constructor(private readonly options: VoidhashClientOptions) {
    const config = resolveVoidhashConfig(options);
    this.eventBus = new EventBus();
    this.runtime = CreateEffectRuntime(config, this.eventBus);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Effect requires service type parameter
  private async runEffect<T>(effect: Effect.Effect<T, unknown, any>, errorCode: string): Promise<T> {
    const result = await this.runtime.runPromiseExit(effect);
    if (Exit.isSuccess(result)) return result.value;
    throw toError(errorCode, Cause.squash(result.cause));
  }

  async initialize() {
    if (this.state === "destroyed") {
      throw new VoidhashDestroyedError();
    }

    if (this.state === "ready") {
      return;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.state = "initializing";
    const config = resolveVoidhashConfig(this.options);

    this.initializePromise = (async () => {
      const distinctId = await this.runEffect(
        initializeEffect(config.distinctId),
        "FAILED_TO_INITIALIZE"
      );

      // Grab service references for sync access
      this.featureFlagService = await this.runEffect(
        Effect.gen(function* () { return yield* FeatureFlagService; }),
        "FAILED_TO_INITIALIZE"
      );
      this.identityManagerService = await this.runEffect(
        Effect.gen(function* () { return yield* IdentityManager; }),
        "FAILED_TO_INITIALIZE"
      );

      if (config.analytics.enabled) {
        await this.runEffect(startAnalyticsEffect(), "FAILED_TO_START_ANALYTICS");

        // Handle scheduled flush events from the analytics service timer
        this.eventBus.on("analytics-flush-needed", () => {
          void this.flushAnalyticsInternal().catch((error) => {
            this.eventBus.emit("error", {
              error,
              message: "Scheduled analytics flush failed.",
              source: "analytics",
            });
          });
        });
      }

      this.attachBrowserListeners(config);

      if (config.featureFlags.prefetchOnInit) {
        await this.runEffect(
          getFeatureFlagsEffect(),
          "FAILED_TO_PREFETCH_FLAGS"
        );
      }

      this.eventBus.emit("initialized", { distinctId });
      this.state = "ready";
    })();

    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  async destroy() {
    if (this.state === "destroyed") {
      return;
    }

    if (this.state === "initializing" && this.initializePromise) {
      await this.initializePromise;
    }

    this.detachBrowserListeners();

    const config = resolveVoidhashConfig(this.options);
    if (config.analytics.enabled) {
      try {
        await this.flushAnalyticsInternal();
      } catch {
        // Best effort
      }
      await this.runEffect(stopAnalyticsEffect(), "FAILED_TO_STOP_ANALYTICS");
    }

    await this.runtime.dispose();
    this.state = "destroyed";
  }

  getDistinctId() {
    if (this.state !== "ready") {
      return null;
    }
    return this.identityManagerService?.getDistinctId() ?? null;
  }

  isFeatureEnabled(key: string) {
    this.ensureReady();
    return this.featureFlagService!.isEnabled(key);
  }

  getFeatureVariant(key: string) {
    this.ensureReady();
    return this.featureFlagService!.getVariant(key);
  }

  async getFeatureFlags(keys?: string[]) {
    this.ensureReady();
    return this.runEffect(
      getFeatureFlagsEffect(keys),
      "FAILED_TO_GET_FEATURE_FLAGS"
    );
  }

  async refreshFeatureFlags(keys?: string[]) {
    this.ensureReady();
    return this.runEffect(
      refreshFeatureFlagsEffect(keys),
      "FAILED_TO_REFRESH_FEATURE_FLAGS"
    );
  }

  async identify(externalUserId: string, traits?: VoidhashTraits) {
    this.ensureReady();
    await this.runEffect(
      identifyEffect(externalUserId, traits),
      "FAILED_TO_IDENTIFY"
    );
  }

  async reset() {
    this.ensureReady();
    await this.runEffect(resetEffect(), "FAILED_TO_RESET");
  }

  async track(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    this.ensureReady();
    await this.runEffect(
      trackEffect(eventName, properties, options),
      "FAILED_TO_TRACK"
    );
  }

  async page(
    pageName?: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    this.ensureReady();
    const pageProperties = pageName
      ? { ...properties, page_name: pageName }
      : properties;
    await this.track("page", pageProperties, options);
  }

  async flushAnalytics(): Promise<AnalyticsFlushResult | null> {
    this.ensureReady();
    return this.flushAnalyticsInternal();
  }

  on<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    return this.eventBus.on(eventName, handler);
  }

  off<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    this.eventBus.off(eventName, handler);
  }

  private async flushAnalyticsInternal(): Promise<AnalyticsFlushResult | null> {
    if (this.inFlightFlush) return this.inFlightFlush;

    this.inFlightFlush = this.runEffect(
      flushAnalyticsEffect(),
      "FAILED_TO_FLUSH_ANALYTICS"
    ).finally(() => {
      this.inFlightFlush = null;
    });

    return this.inFlightFlush;
  }

  private ensureReady() {
    if (this.state === "destroyed") {
      throw new VoidhashDestroyedError();
    }

    if (this.state !== "ready") {
      throw new VoidhashNotInitializedError();
    }
  }

  private attachBrowserListeners(config: ReturnType<typeof resolveVoidhashConfig>) {
    if (typeof window === "undefined") {
      return;
    }

    const onlineHandler = () => {
      if (config.featureFlags.refreshOnOnline) {
        void this.runEffect(
          refreshTrackedKeySetsEffect(),
          "FAILED_TO_REFRESH_FLAGS"
        ).catch(() => {});
      }
    };

    const pageHideHandler = () => {
      if (config.analytics.enabled) {
        void this.runEffect(
          flushAnalyticsKeepaliveEffect(),
          "FAILED_TO_FLUSH"
        ).catch(() => {});
      }
    };

    const visibilityHandler = () => {
      if (
        config.featureFlags.refreshOnVisibility &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void this.runEffect(
          refreshTrackedKeySetsEffect(),
          "FAILED_TO_REFRESH_FLAGS"
        ).catch(() => {});
      }
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("pagehide", pageHideHandler);
    this.listeners.push(() =>
      window.removeEventListener("online", onlineHandler)
    );
    this.listeners.push(() =>
      window.removeEventListener("pagehide", pageHideHandler)
    );

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler);
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

export const createVoidhashClient = (options: VoidhashClientOptions) =>
  new VoidhashWebClient(options);

export type {
  AnalyticsFlushResult,
  FeatureFlagsResult,
  VoidhashClientOptions,
  VoidhashTrackOptions,
};
