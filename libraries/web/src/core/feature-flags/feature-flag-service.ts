import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import type { FeatureFlagEntry, FeatureFlagsResult } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { EventBusProvider } from "../event-bus";
import { isStringArray, parseJson } from "../json";
import { IdentityManager } from "../identity/identity-manager";
import { ApiClient, type WebSdkHeaders, errorBodyOf, statusOf } from "../networking/api-client";
import { AuthGate } from "../networking/auth-gate";
import { CircuitBreaker } from "../networking/circuit-breaker";
import {
  FRESHNESS_BUDGET_MS,
  REQUEST_TIMEOUT_MS,
  breakerKey,
  countsTowardsBreaker,
  isAuthStatus,
  isRefusal,
} from "../networking/network-policy";
import { SingleFlight } from "../networking/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const ALL_KEYS = "all";
const serializeKeys = (keys?: ReadonlyArray<string>) => {
  if (keys && Arr.isReadonlyArrayNonEmpty(keys)) {
    return JSON.stringify(Arr.sort(keys, Str.Order));
  }

  return ALL_KEYS;
};

const deserializeKeys = (serializedKeys: string) => {
  if (serializedKeys === ALL_KEYS) {
    return undefined;
  }

  return Option.getOrUndefined(Option.filter(parseJson(serializedKeys), isStringArray));
};

const emptyFlags = (): FeatureFlagsResult => ({ flags: [], isExpired: true, isStale: true });

/**
 * What a flag reads as while it has no evaluated value: its own entry in
 * `featureFlags.defaults`, never one inherited from `Object.prototype` such as
 * `toString`, or `false`.
 */
export const isEnabledByDefault = (defaults: Readonly<Record<string, boolean>>, key: string) =>
  Option.getOrElse(R.get(defaults, key), () => false);

const freshResult = (flags: ReadonlyArray<FeatureFlagEntry>): FeatureFlagsResult => ({
  flags,
  isExpired: false,
  isStale: false,
});

const buildEvaluatePayload = (keys?: ReadonlyArray<string>) => {
  if (!keys) {
    return {};
  }

  return { flagKeys: [...keys] };
};

export const makeFeatureFlagService = Effect.fnUntraced(function* makeFeatureFlagService() {
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

  const latestFlags = new Map<string, FeatureFlagEntry>();
  const trackedKeySets = new Set<string>();
  let isRefreshWaitingForCircuit = false;

  const buildHeaders = (distinctId: string): WebSdkHeaders => ({
    ...platform.getSdkHeaders(config.publishableKey),
    "x-distinct-id": distinctId,
  });

  const buildCacheKey = (distinctId: string, keys?: ReadonlyArray<string>) =>
    `feature-flags:${distinctId}:${serializeKeys(keys)}`;

  const rememberFlags = (flags: ReadonlyArray<FeatureFlagEntry>) => {
    Arr.forEach(flags, (flag) => latestFlags.set(flag.key, flag));
  };

  // Sync accessors (plain functions, not Effects). A flag without an evaluated
  // value reads as its configured default.
  const isEnabled = (key: string) =>
    latestFlags.get(key)?.enabled ?? isEnabledByDefault(config.featureFlags.defaults, key);

  const getVariant = (key: string) => Option.fromUndefinedOr(latestFlags.get(key));

  // With `featureFlags.persist` off, evaluations live in memory for the page.
  const memoryCache = new Map<
    string,
    { readonly result: FeatureFlagsResult; readonly at: number }
  >();

  /** Reads an evaluation, from storage or, with persistence off, from memory. */
  const readCache = (cacheKey: string) =>
    config.featureFlags.persist
      ? cacheManager.get<FeatureFlagsResult>(cacheKey)
      : Effect.map(Clock.currentTimeMillis, (now) =>
          Option.map(Option.fromUndefinedOr(memoryCache.get(cacheKey)), ({ at, result }) => ({
            isExpired: false,
            isStale: now - at > config.featureFlags.ttlMs,
            value: result,
          })),
        );

  const writeCache = (cacheKey: string, result: FeatureFlagsResult) =>
    config.featureFlags.persist
      ? cacheManager.set(cacheKey, result, { staleTime: config.featureFlags.ttlMs })
      : Effect.map(Clock.currentTimeMillis, (at) => {
          memoryCache.set(cacheKey, { at, result });
        });

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
        yield* refreshWhenCircuitReopens();
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
        const status = statusOf(outcome.failure);
        const body = errorBodyOf(outcome.failure);
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

        if (Option.isNone(status) || countsTowardsBreaker(status.value, body, "api")) {
          yield* breaker.recordFailure(
            apiBreakerKey,
            "featureFlags.refresh",
            Option.isSome(status),
          );
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
          retryable: !Option.exists(status, (code) => isRefusal(code, body, "api")),
        });
        return Option.none<FeatureFlagsResult>();
      }

      if (authProbe) yield* authGate.completeProbe(true);
      yield* breaker.recordSuccess(apiBreakerKey);
      const result = freshResult(outcome.success.flags);
      // The identity switched while the request was out: the answer is for
      // the previous person, so it must not become the current person's flags.
      if (!Option.contains(identityManager.getDistinctId(), distinctId)) {
        return Option.some(result);
      }
      rememberFlags(result.flags);
      // Flags go stale after the configured TTL but never expire: an offline
      // read must still be answered from the last known evaluation.
      yield* writeCache(cacheKey, result);
      eventBus.emit("feature-flags-updated", { distinctId, keys, result });
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
   * in-flight refresh. With no cached value at all the read waits at most
   * `featureFlags.maxWaitMs`, then answers with no flags, so a page that waits
   * for its flags is not held up for the whole request timeout when Voidhash
   * hangs. Either way the refresh continues in the background, and its answer
   * is stored and announced with `feature-flags-updated`.
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
      trackedKeySets.add(serializeKeys(keys));

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

      // The refresh is forked into the service scope, so its result still
      // lands for the next read when this one stops waiting for it.
      const settled = yield* Deferred.make<Option.Option<FeatureFlagsResult>>();
      yield* Effect.forkIn(
        Effect.flatMap(refresh, (result) => Deferred.succeed(settled, result)),
        serviceScope,
        { startImmediately: true },
      );
      const budget = Option.isSome(cached) ? FRESHNESS_BUDGET_MS : config.featureFlags.maxWaitMs;
      const fetched = yield* Effect.timeoutOption(Deferred.await(settled), budget);
      const resolved = Option.flatten(fetched);
      if (Option.isSome(resolved)) {
        return resolved.value;
      }

      return Option.match(cached, {
        onNone: emptyFlags,
        onSome: (hit) => asStale(hit.value, hit.isExpired),
      });
    });

  /** Cache-first read with stale-while-revalidate semantics. */
  const getFeatureFlags = (keys?: ReadonlyArray<string>) => getOrRefreshFeatureFlags(false, keys);

  /**
   * Forces a refresh, still falling back to the cached value when the network
   * or the server is unavailable.
   */
  const refreshFeatureFlags = (keys?: ReadonlyArray<string>) =>
    getOrRefreshFeatureFlags(true, keys);

  /**
   * Evaluates the flags this page reads once the circuit admits a request
   * again. A page that started while another page's circuit was open would
   * otherwise keep its defaults until something else asked, and nothing may:
   * `useFeatureFlags` waits for `feature-flags-updated`. One such refresh
   * waits at a time, in the service scope; after a probe already in flight,
   * it waits at least a second.
   */
  const refreshWhenCircuitReopens = (): Effect.Effect<void> =>
    Effect.gen(function* refreshWhenCircuitReopens() {
      const reopensAt = breaker.reopensAt(apiBreakerKey);
      if (isRefreshWaitingForCircuit || Option.isNone(reopensAt)) return;
      isRefreshWaitingForCircuit = true;
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.forkIn(
        Effect.sleep(Math.max(reopensAt.value - now, 1_000)).pipe(
          Effect.andThen(
            Effect.sync(() => {
              isRefreshWaitingForCircuit = false;
            }),
          ),
          Effect.andThen(refreshTrackedKeySets()),
        ),
        serviceScope,
      );
    });

  const refreshTrackedKeySets = (): Effect.Effect<void> =>
    Effect.gen(function* refreshTrackedKeySets() {
      if (trackedKeySets.size === 0) return;

      yield* Effect.all(
        Arr.fromIterable(trackedKeySets).map((serializedKeys) =>
          refreshFeatureFlags(deserializeKeys(serializedKeys)),
        ),
        { concurrency: "unbounded" },
      );
    });

  /**
   * Drops cached flags. Passing a distinct id clears only that identity's
   * entries: a sign-out, a reset, or a switch to another user must not hand
   * one person's flags to the next. A visitor who signs in keeps theirs, see
   * {@link carryOverFlags}.
   */
  const clearCachedFlags = (distinctId?: string) =>
    Effect.gen(function* clearCachedFlags() {
      latestFlags.clear();
      Arr.forEach(Array.from(memoryCache.keys()), (key) => {
        if (distinctId === undefined || key.startsWith(`feature-flags:${distinctId}:`)) {
          memoryCache.delete(key);
        }
      });
      yield* cacheManager.clearPrefix(
        distinctId ? `feature-flags:${distinctId}:` : "feature-flags:",
      );
    });

  /**
   * Hands the flags evaluated for an anonymous visitor to the user the visitor
   * signed in as, who is the same person. They answer, as stale values the
   * next read refreshes, until the user's evaluation arrives, rather than
   * every flag falling back to its default for as long as Voidhash takes to
   * answer, which during an outage is until it is back. The visitor's entries
   * are removed. Flags of one user are never handed to another person:
   * `clearCachedFlags` handles those switches.
   */
  const carryOverFlags = (visitorDistinctId: string, userDistinctId: string) =>
    Effect.gen(function* carryOverFlags() {
      const visitorPrefix = `feature-flags:${visitorDistinctId}:`;
      const userKeyOf = (key: string) =>
        `feature-flags:${userDistinctId}:${key.slice(visitorPrefix.length)}`;

      Arr.forEach(Array.from(memoryCache.entries()), ([key, entry]) => {
        if (!key.startsWith(visitorPrefix)) return;
        // Evaluated "long ago", so the next read refreshes it.
        if (!memoryCache.has(userKeyOf(key))) memoryCache.set(userKeyOf(key), { ...entry, at: 0 });
        memoryCache.delete(key);
      });
      if (!config.featureFlags.persist) return;

      const visitorKeys = Arr.filter(yield* cacheManager.getCacheKeys(), (key) =>
        key.startsWith(visitorPrefix),
      );
      yield* Effect.forEach(
        visitorKeys,
        (key) =>
          Effect.gen(function* carryOverEntry() {
            const visitorEntry = yield* cacheManager.get<FeatureFlagsResult>(key);
            const userEntry = yield* cacheManager.get<FeatureFlagsResult>(userKeyOf(key));
            if (Option.isSome(visitorEntry) && Option.isNone(userEntry)) {
              yield* cacheManager.set(userKeyOf(key), visitorEntry.value.value, { isStale: true });
            }
          }),
        { concurrency: 1, discard: true },
      );
      yield* cacheManager.clearPrefix(visitorPrefix);
    });

  return {
    carryOverFlags,
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
  Effect.Success<ReturnType<typeof makeFeatureFlagService>>
>()("web-voidhash/FeatureFlagService") {}
