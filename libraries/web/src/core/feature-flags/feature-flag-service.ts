import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient, type WebSdkHeaders } from "../networking/api-client";
import { AuthGate } from "../networking/auth-gate";
import { CircuitBreaker } from "../networking/circuit-breaker";
import {
  FRESHNESS_BUDGET_MS,
  REQUEST_TIMEOUT_MS,
  breakerKey,
  countsTowardsBreaker,
  isAuthStatus,
  isRetryableStatus,
} from "../networking/network-policy";
import { SingleFlight } from "../networking/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const ALL_KEYS = "all";
const FlagKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const encodeFlagKeys = Schema.encodeSync(FlagKeysFromJson);
const decodeFlagKeys = Schema.decodeUnknownSync(FlagKeysFromJson);

const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && Arr.isReadonlyArrayNonEmpty(keys)) {
    return encodeFlagKeys(Arr.sort(keys, Str.Order));
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  return decodeFlagKeys(serializedKeys);
};

const emptyFlags = (): FeatureFlagsResult => ({ flags: [], isExpired: true, isStale: true });

const freshResult = (flags: ReadonlyArray<FeatureFlagEntry>): FeatureFlagsResult => ({
  flags,
  isExpired: false,
  isStale: false,
});

const ResponseStatus = Schema.Struct({
  response: Schema.Struct({ status: Schema.Number }),
});
const decodeResponseStatus = Schema.decodeUnknownEffect(ResponseStatus);

/**
 * Reads the HTTP status out of whatever the generated client failed with. A
 * transport error (DNS, timeout, connection) carries no response, which is
 * `None` here.
 */
const statusOf = (cause: unknown) =>
  Effect.map(
    Effect.option(decodeResponseStatus(cause)),
    Option.map((it) => it.response.status),
  );

const buildEvaluatePayload = (keys?: ReadonlyArray<string>) => {
  if (!keys) {
    return {};
  }

  return { flagKeys: [...keys] };
};

const make = Effect.fn("makeFeatureFlagService")(function* effect() {
  const cacheManager = yield* CacheManager;
  const serviceScope = yield* Effect.scope;
  const apiClient = yield* ApiClient;
  const authGate = yield* AuthGate;
  const breaker = yield* CircuitBreaker;
  const diagnostics = yield* Diagnostics;
  const eventBus = yield* EventBusProvider;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;
  const singleFlight = yield* SingleFlight;
  const config = yield* SdkConfiguration;

  const apiBreakerKey = breakerKey("api", config.baseUrl);

  let latestFlags = HashMap.empty<string, FeatureFlagEntry>();
  let trackedKeySets = HashSet.empty<string>();

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
    latestFlags = Arr.reduce(flags, latestFlags, (entries, flag) =>
      HashMap.set(entries, flag.key, flag),
    );
  };

  // Sync accessors (plain functions, not Effects)
  const isEnabled = (key: string) =>
    HashMap.get(latestFlags, key).pipe(
      Option.map((flag) => flag.enabled),
      Option.getOrElse(() => false),
    );

  const getVariant = (key: string) => HashMap.get(latestFlags, key);

  const readCache = (cacheKey: string) => cacheManager.get<FeatureFlagsResult>(cacheKey);

  /**
   * One network refresh, gated by the circuit breaker and bounded by the
   * per-attempt timeout. Never fails: `Option.none()` means "serve what you
   * have".
   */
  const fetchFlags = (
    distinctId: string,
    cacheKey: string,
    keys?: ReadonlyArray<string>,
  ): Effect.Effect<Option.Option<FeatureFlagsResult>> =>
    Effect.gen(function* fetchFlags() {
      const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
      if (authGate.isPaused() && !authProbe) {
        return Option.none<FeatureFlagsResult>();
      }

      const mayAttempt = yield* breaker.canAttempt(apiBreakerKey, "featureFlags.refresh");
      if (!mayAttempt) {
        if (authProbe) yield* authGate.completeProbe(false);
        return Option.none<FeatureFlagsResult>();
      }

      const outcome = yield* Effect.result(
        apiClient.sdk
          .evaluateFeatureFlags({
            headers: buildHeaders(distinctId),
            payload: buildEvaluatePayload(keys),
          })
          .pipe(Effect.timeout(REQUEST_TIMEOUT_MS)),
      );

      if (Result.isFailure(outcome)) {
        const status = yield* statusOf(outcome.failure);
        if (authProbe) {
          yield* authGate.completeProbe(
            Option.exists(status, (httpStatus) => !isAuthStatus(httpStatus)),
          );
        }
        const authStatus = Option.filter(status, isAuthStatus);
        if (Option.isSome(authStatus)) {
          yield* authGate.pause({
            httpStatus: authStatus.value,
            operation: "featureFlags.refresh",
          });
          return Option.none<FeatureFlagsResult>();
        }

        if (Option.isNone(status) || countsTowardsBreaker(status.value)) {
          yield* breaker.recordFailure(apiBreakerKey, "featureFlags.refresh");
        }
        yield* diagnostics.report({
          code: "TRANSPORT_FAILED",
          ...Option.match(status, {
            onNone: () => ({}),
            onSome: (httpStatus) => ({ httpStatus }),
          }),
          kind: "transport",
          message: "Feature flag refresh failed; cached flags are served instead.",
          operation: "featureFlags.refresh",
          retryable: Option.match(status, {
            onNone: () => true,
            onSome: isRetryableStatus,
          }),
        });
        return Option.none<FeatureFlagsResult>();
      }

      if (authProbe) yield* authGate.completeProbe(true);
      yield* breaker.recordSuccess(apiBreakerKey);
      const result = freshResult(outcome.success.flags);
      rememberFlags(result.flags);
      // Flags go stale after the configured TTL but never expire: an offline
      // read must still be answered from the last known evaluation.
      yield* cacheManager.set(cacheKey, result, { staleTime: config.featureFlags.ttlMs });
      eventBus.emit("feature-flags-updated", { keys, result });
      return Option.some(result);
    }).pipe(Effect.ensuring(breaker.releaseProbe(apiBreakerKey)));

  const asStale = (result: FeatureFlagsResult, isExpired: boolean): FeatureFlagsResult => ({
    flags: result.flags,
    isExpired,
    isStale: true,
  });

  /**
   * Cache-first read. A fresh entry is returned immediately; a stale or expired
   * entry is returned after waiting at most the freshness budget for the
   * in-flight refresh, which then continues in the background. With no cached
   * value at all the read waits for the full request timeout.
   */
  const getOrRefreshFeatureFlags = (
    forceRefresh: boolean,
    keys?: ReadonlyArray<string>,
  ): Effect.Effect<FeatureFlagsResult> =>
    Effect.gen(function* getOrRefreshFeatureFlags() {
      const distinctId = identityManager.getDistinctId();
      if (Option.isNone(distinctId)) {
        return emptyFlags();
      }

      const cacheKey = buildCacheKey(distinctId.value, keys);
      trackedKeySets = HashSet.add(trackedKeySets, serializeKeys(keys));

      const cached = yield* readCache(cacheKey);
      if (Option.isSome(cached)) {
        rememberFlags(cached.value.value.flags);
      }

      if (
        !forceRefresh &&
        Option.isSome(cached) &&
        !cached.value.isExpired &&
        !cached.value.isStale
      ) {
        return freshResult(cached.value.value.flags);
      }

      const refresh = singleFlight.run(
        fetchFlags(distinctId.value, cacheKey, keys),
        `flags:${cacheKey}`,
      );

      if (Option.isNone(cached)) {
        const fetched = yield* refresh;
        return Option.getOrElse(fetched, emptyFlags);
      }

      // Any cached value answers within the freshness budget. The refresh is
      // forked into the service scope, so its result still lands for the next read.
      const settled = yield* Deferred.make<Option.Option<FeatureFlagsResult>>();
      yield* Effect.forkIn(
        Effect.flatMap(refresh, (result) => Deferred.succeed(settled, result)),
        serviceScope,
        { startImmediately: true },
      );
      const fetched = yield* Effect.timeoutOption(Deferred.await(settled), FRESHNESS_BUDGET_MS);
      const resolved = Option.flatten(fetched);
      if (Option.isSome(resolved)) {
        return resolved.value;
      }

      return asStale(cached.value.value, cached.value.isExpired);
    });

  /** Cache-first read with stale-while-revalidate semantics. */
  const getFeatureFlags = (keys?: ReadonlyArray<string>) => getOrRefreshFeatureFlags(false, keys);

  /**
   * Forces a refresh, still falling back to the cached value when the network
   * or the server is unavailable.
   */
  const refreshFeatureFlags = (keys?: ReadonlyArray<string>) =>
    getOrRefreshFeatureFlags(true, keys);

  const refreshTrackedKeySets = () =>
    Effect.gen(function* refreshTrackedKeySets() {
      if (HashSet.isEmpty(trackedKeySets)) return;

      yield* Effect.all(
        Arr.fromIterable(trackedKeySets).map((serializedKeys) =>
          refreshFeatureFlags(deserializeKeys(serializedKeys)),
        ),
        { concurrency: "unbounded" },
      );
    });

  /**
   * Drops cached flags. Passing a distinct id clears only that identity's
   * entries, which is what `identify`/`reset` need so anonymous evaluations do
   * not leak into an identified session.
   */
  const clearCachedFlags = (distinctId?: string) =>
    Effect.gen(function* clearCachedFlags() {
      latestFlags = HashMap.empty();
      yield* cacheManager.clearPrefix(
        distinctId ? `feature-flags:${distinctId}:` : "feature-flags:",
      );
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
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/FeatureFlagService") {
  static Default = Layer.effect(FeatureFlagService, make());
}
