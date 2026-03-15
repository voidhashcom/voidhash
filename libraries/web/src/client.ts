import { VoidhashDestroyedError, VoidhashNotInitializedError } from "./errors";
import { VoidhashClientEffect, resolveVoidhashConfig } from "./client-effect";
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

export class VoidhashWebClient {
  private readonly effect: VoidhashClientEffect;
  private state: ClientState = "idle";
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly options: VoidhashClientOptions) {
    this.effect = new VoidhashClientEffect(resolveVoidhashConfig(options));
  }

  async destroy() {
    if (this.state === "destroyed") {
      return;
    }

    if (this.state === "initializing" && this.initializePromise) {
      await this.initializePromise;
    }

    await this.effect.destroy();
    this.state = "destroyed";
  }

  getDistinctId() {
    if (this.state !== "ready") {
      return null;
    }

    return this.effect.getDistinctId();
  }

  async getFeatureFlags(keys?: string[]) {
    this.ensureReady();
    return this.effect.getFeatureFlags(keys);
  }

  getFeatureVariant(key: string) {
    this.ensureReady();
    return this.effect.getFeatureVariant(key);
  }

  async identify(externalUserId: string, traits?: VoidhashTraits) {
    this.ensureReady();
    await this.effect.identify(externalUserId, traits);
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
    this.initializePromise = this.effect
      .initialize()
      .then(() => {
        this.state = "ready";
      })
      .finally(() => {
        this.initializePromise = null;
      });

    return this.initializePromise;
  }

  isFeatureEnabled(key: string) {
    this.ensureReady();
    return this.effect.isFeatureEnabled(key);
  }

  off<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    this.effect.getEventBus().off(eventName, handler);
  }

  on<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void
  ) {
    return this.effect.getEventBus().on(eventName, handler);
  }

  async page(
    pageName?: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    this.ensureReady();
    await this.effect.page(pageName, properties, options);
  }

  async refreshFeatureFlags(keys?: string[]) {
    this.ensureReady();
    return this.effect.refreshFeatureFlags(keys);
  }

  async reset() {
    this.ensureReady();
    await this.effect.reset();
  }

  async track(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions
  ) {
    this.ensureReady();
    await this.effect.track(eventName, properties, options);
  }

  async flushAnalytics(): Promise<AnalyticsFlushResult | null> {
    this.ensureReady();
    return this.effect.flushAnalytics();
  }

  private ensureReady() {
    if (this.state === "destroyed") {
      throw new VoidhashDestroyedError();
    }

    if (this.state !== "ready") {
      throw new VoidhashNotInitializedError();
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
