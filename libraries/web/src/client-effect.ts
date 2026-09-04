import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import { pipe } from "effect/Function";
import { FetchHttpClient } from "effect/unstable/http";

import type { SdkPerson } from "@voidhash/generated-clients";

import { VoidhashConfigurationError } from "./errors";
import type {
  ResolvedVoidhashConfig,
  VoidhashClientOptions,
  VoidhashPersonAttributes,
  VoidhashTrackOptions,
  VoidhashTraits,
} from "./types";
import { AnalyticsService } from "./core/analytics/analytics-service";
import { CacheManager } from "./core/caching/cache-manager";
import { createBrowserCacheAdapterLayer } from "./core/caching/adapters/browser-cache-adapter";
import { Diagnostics } from "./core/diagnostics";
import { type EventBus, EventBusProvider } from "./core/event-bus";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import { IdentityManager } from "./core/identity/identity-manager";
import { ApiClient } from "./core/networking/api-client";
import { AuthGate } from "./core/networking/auth-gate";
import { CircuitBreaker } from "./core/networking/circuit-breaker";
import { EventCaptureApiClient } from "./core/networking/event-capture-api-client";
import { SingleFlight } from "./core/networking/single-flight";
import { BrowserPlatformProviderLayer } from "./core/platform/platform-provider";
import { SdkConfiguration } from "./core/sdk-configuration";

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

export const resolveVoidhashConfig = (options: VoidhashClientOptions): ResolvedVoidhashConfig => {
  const baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL).toString();
  const analyticsBaseUrl = deriveAnalyticsBaseUrl(baseUrl, options.analytics?.baseUrl);
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
    ...(options.onDiagnostic ? { onDiagnostic: options.onDiagnostic } : {}),
    publishableKey: options.publishableKey,
  };
};

export const CreateEffectRuntime = (config: ResolvedVoidhashConfig, eventBus: EventBus) =>
  ManagedRuntime.make(
    Layer.fresh(
      pipe(
        AnalyticsService.Default,
        Layer.provideMerge(FeatureFlagService.Default),
        Layer.provideMerge(IdentityManager.Default),
        Layer.provideMerge(CacheManager.Default),
        Layer.provideMerge(ApiClient.Default),
        Layer.provideMerge(EventCaptureApiClient.Default),
        Layer.provideMerge(
          Layer.effect(
            FetchHttpClient.Fetch,
            Effect.sync(() => globalThis.fetch),
          ).pipe(Layer.provideMerge(FetchHttpClient.layer)),
        ),
        Layer.provideMerge(AuthGate.Default),
        Layer.provideMerge(CircuitBreaker.Default),
        Layer.provideMerge(SingleFlight.Default),
        Layer.provideMerge(Diagnostics.Default),
        Layer.provideMerge(createBrowserCacheAdapterLayer()),
        Layer.provideMerge(BrowserPlatformProviderLayer),
        Layer.provideMerge(Layer.succeed(EventBusProvider, eventBus)),
        Layer.provideMerge(Layer.succeed(SdkConfiguration, config)),
      ),
    ),
  );

// Effects that run against the runtime
export const initializeEffect = (initialDistinctId?: string) =>
  Effect.gen(function* initialize() {
    const identityManager = yield* IdentityManager;
    const authGate = yield* AuthGate;
    // A re-initialization may carry a corrected key, so the pause is lifted.
    yield* authGate.resume();
    return yield* identityManager.initialize(initialDistinctId);
  });

// Drain the analytics queue so any pending events are attributed to the
// current distinct id before it is switched out by identify/reset.
const flushAnalyticsForIdentitySwitch = Effect.fn("flushAnalyticsForIdentitySwitch")(
  function* flushForIdentitySwitch() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.flush();
  },
);

export const identifyEffect = (distinctId: string, traits?: VoidhashTraits) =>
  Effect.gen(function* identify() {
    const identityManager = yield* IdentityManager;
    const featureFlags = yield* FeatureFlagService;
    yield* flushAnalyticsForIdentitySwitch();
    const previousDistinctId = identityManager.getDistinctId();
    const authGate = yield* AuthGate;
    yield* authGate.resume();
    yield* identityManager.identify(distinctId, traits);
    yield* featureFlags.clearCachedFlags(Option.getOrUndefined(previousDistinctId));
    yield* featureFlags.refreshTrackedKeySets();
  });

export const resetEffect = () =>
  Effect.gen(function* reset() {
    const identityManager = yield* IdentityManager;
    const featureFlags = yield* FeatureFlagService;
    yield* flushAnalyticsForIdentitySwitch();
    const previousDistinctId = identityManager.getDistinctId();
    const authGate = yield* AuthGate;
    yield* authGate.resume();
    yield* identityManager.reset();
    yield* featureFlags.clearCachedFlags(Option.getOrUndefined(previousDistinctId));
    yield* featureFlags.refreshTrackedKeySets();
  });

/**
 * Splits person attributes into the reserved `email`/`name` fields and the
 * remaining free-form traits.
 */
const splitPersonAttributes = (attributes: VoidhashPersonAttributes) => {
  const { email, name, ...rest } = attributes;
  const traits = R.filter(
    rest,
    (value): value is Exclude<typeof value, undefined> => value !== undefined,
  );
  return { email, name, traits };
};

/** Returns the traits record, or `undefined` when it carries no entries. */
const nonEmptyTraits = (traits: VoidhashTraits) => {
  if (Arr.isReadonlyArrayNonEmpty(R.keys(traits))) {
    return traits;
  }

  return undefined;
};

/**
 * Enqueues a `$set` analytics event that updates the current person profile.
 * Fire-and-forget: the event is queued and flushed by the normal pipeline.
 */
export const setPersonAttributesEffect = (attributes: VoidhashPersonAttributes) =>
  Effect.gen(function* setPersonAttributes() {
    const analyticsService = yield* AnalyticsService;
    const { email, name, traits } = splitPersonAttributes(attributes);
    const $set: Record<string, unknown> = { ...traits };
    if (email !== undefined) {
      $set.email = email;
    }
    if (name !== undefined) {
      $set.name = name;
    }
    yield* analyticsService.enqueue("$set", {
      $set,
      $process_person_profile: true,
    });
  });

/**
 * Synchronously persists person attributes to the server and returns the
 * resulting person snapshot.
 */
export const setPersonAttributesSyncEffect = (
  attributes: VoidhashPersonAttributes,
): Effect.Effect<SdkPerson, unknown, IdentityManager> =>
  Effect.gen(function* setPersonAttributesSync() {
    const identityManager = yield* IdentityManager;
    const { email, name, traits } = splitPersonAttributes(attributes);
    return yield* identityManager.setPersonAttributesSync({
      email,
      name,
      traits: nonEmptyTraits(traits),
    });
  });

export const trackEffect = (
  eventName: string,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions,
) =>
  Effect.gen(function* track() {
    const analyticsService = yield* AnalyticsService;
    const queueLength = yield* analyticsService.enqueue(eventName, properties, options);
    if (queueLength !== undefined && queueLength >= 20) {
      yield* analyticsService.flush();
    }
  });

export const getFeatureFlagsEffect = (keys?: string[]) =>
  Effect.gen(function* getFeatureFlags() {
    const featureFlags = yield* FeatureFlagService;
    return yield* featureFlags.getFeatureFlags(keys);
  });

export const refreshFeatureFlagsEffect = (keys?: string[]) =>
  Effect.gen(function* refreshFeatureFlags() {
    const featureFlags = yield* FeatureFlagService;
    return yield* featureFlags.refreshFeatureFlags(keys);
  });

/**
 * Prepares the transport for a fresh attempt after a foreground or
 * connectivity trigger: open circuits move to half-open, and an authentication
 * pause that has held for at least a minute is lifted for one probe.
 */
export const halfOpenCircuitsEffect = () =>
  Effect.gen(function* halfOpenCircuits() {
    const breaker = yield* CircuitBreaker;
    yield* breaker.halfOpenAll();
  });

/** Lifts an authentication pause unconditionally, e.g. on re-initialization. */
export const resumeOutboundEffect = () =>
  Effect.gen(function* resumeOutbound() {
    const authGate = yield* AuthGate;
    yield* authGate.resume();
  });

export const refreshTrackedKeySetsEffect = () =>
  Effect.gen(function* refreshTrackedKeySets() {
    const featureFlags = yield* FeatureFlagService;
    yield* featureFlags.refreshTrackedKeySets();
  });

/**
 * Clears the retry backoff so a queue held back during an outage is sent as
 * soon as connectivity returns.
 */
export const resetAnalyticsBackoffEffect = () =>
  Effect.gen(function* resetAnalyticsBackoff() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.resetBackoff();
  });

export const flushAnalyticsEffect = () =>
  Effect.gen(function* flushAnalytics() {
    const analyticsService = yield* AnalyticsService;
    return yield* analyticsService.flush();
  });

export const startAnalyticsEffect = () =>
  Effect.gen(function* startAnalytics() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.start();
  });

export const stopAnalyticsEffect = () =>
  Effect.gen(function* stopAnalytics() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.stop();
  });

export const flushAnalyticsKeepaliveEffect = () =>
  Effect.gen(function* flushKeepalive() {
    const analyticsService = yield* AnalyticsService;
    return yield* analyticsService.flush({ keepalive: true });
  });
