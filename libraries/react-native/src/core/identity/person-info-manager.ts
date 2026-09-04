import type { SdkPerson } from "@voidhash/generated-clients";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  COLD_READ_BUDGET_MS,
  countsTowardsBreaker,
  FRESHNESS_BUDGET_MS,
  httpStatusOf,
  isAuthStatus,
  isRetryableStatus,
  withRequestTimeout,
} from "../network/policy";
import { SingleFlight } from "../network/single-flight";
import { ApiClient } from "../networking/api-client";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { IdentityEpoch } from "./identity-epoch";

/** 2 days. Past this the snapshot is still served, flagged `isExpired`. */
const PERSON_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 2;

/** 5 minutes. Past this a read triggers a background refresh. */
const PERSON_CACHE_STALE_MS = 1000 * 60 * 5;

/** Prefix every per-person cache entry shares, used to invalidate an identity. */
export const PERSON_CACHE_KEY_PREFIX = "person:";

/** A person snapshot together with how much the caller should trust it. */
export interface PersonSnapshot {
  /** The snapshot, or `null` when the SDK has never seen one. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the public `getCurrentPerson()` answer, which is `null` before any snapshot exists.
  readonly person: SdkPerson | null;
  /** Served from cache past its stale window; a refresh is running or queued. */
  readonly isStale: boolean;
  /** Served from cache past its TTL. Apps gating high-value content decide on this. */
  readonly isExpired: boolean;
  /**
   * Why the snapshot has the freshness it has. `refresh-in-flight` means a
   * refresh is still running and its result will land for the next read;
   * `refresh-failed` means it finished without producing anything.
   */
  readonly reason: "fresh" | "refresh-in-flight" | "refresh-failed" | "no-cache";
}

const make = Effect.fn("makePersonInfoManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const sdkConfiguration = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;
  const breaker = yield* CircuitBreaker;
  const authGate = yield* AuthGate;
  const singleFlight = yield* SingleFlight;
  const identityEpoch = yield* IdentityEpoch;
  const serviceScope = yield* Effect.scope;
  const personBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);

  const generatePersonCacheKey = (distinctId: string) => `${PERSON_CACHE_KEY_PREFIX}${distinctId}`;

  const getPersonFromCache = (distinctId: string) =>
    cacheManager.get<SdkPerson>(generatePersonCacheKey(distinctId));

  const cache = (distinctId: string, person: SdkPerson) =>
    cacheManager.set(generatePersonCacheKey(distinctId), person, {
      staleTime: PERSON_CACHE_STALE_MS,
      ttl: PERSON_CACHE_TTL_MS,
    });

  const resetCache = (distinctId: string) =>
    cacheManager.delete(generatePersonCacheKey(distinctId));

  /** Drops every cached person, whatever identity they belong to. */
  const resetAllCaches = () => cacheManager.deleteByPrefix(PERSON_CACHE_KEY_PREFIX);

  const fetchPerson = Effect.fn("PersonInfoManager.fetchPerson")(function* (distinctId: string) {
    const commonHeaders = yield* getCommonSdkHeaders();
    // A brand-new (or freshly-reset) distinct id has no persisted person on
    // the server until `syncPersonAttributes` creates it, so a 404 means "no
    // snapshot yet" rather than a fault.
    return yield* withRequestTimeout(
      "getPerson",
      apiClient.sdk
        .getPerson({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
          },
        })
        .pipe(Effect.catchTag("ApiSdkPersonNotFoundErrorJsonEncoding", () => Effect.succeed(null))),
    );
  });

  /**
   * One refresh per distinct id, gated by the breaker and the authentication
   * pause. Never fails: every transport outcome degrades to `None`, leaving
   * the caller on its cached snapshot.
   */
  const refresh = (distinctId: string) =>
    singleFlight.run(
      generatePersonCacheKey(distinctId),
      Effect.fn("PersonInfoManager.refresh")(function* () {
        // Captured before the request so a snapshot belonging to the previous
        // identity cannot be written back after `identify()`/`reset()`.
        const epoch = identityEpoch.current();
        const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
        if (authGate.isPaused() && !authProbe) {
          return Option.none<Option.Option<SdkPerson>>();
        }
        const allowed = yield* breaker.canAttempt(personBreakerKey, "getPerson");
        if (!allowed) {
          if (authProbe) yield* authGate.completeProbe(false);
          return Option.none<Option.Option<SdkPerson>>();
        }

        const result = yield* Effect.result(fetchPerson(distinctId));
        if (Result.isFailure(result)) {
          const status = httpStatusOf(result.failure);
          const statusCode = Option.getOrUndefined(status);
          if (authProbe) {
            yield* authGate.completeProbe(statusCode !== undefined && !isAuthStatus(statusCode));
          }
          if (statusCode !== undefined && isAuthStatus(statusCode)) {
            yield* breaker.releaseProbe(personBreakerKey);
            yield* authGate.pause("getPerson", statusCode);
          } else if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
            yield* breaker.recordFailure(personBreakerKey);
          } else {
            yield* breaker.releaseProbe(personBreakerKey);
          }
          yield* diagnostics.emit({
            code: DIAGNOSTIC_CODES.REQUEST_FAILED,
            httpStatus: Option.getOrUndefined(status),
            kind: "transport",
            message: "Person refresh failed; serving the cached snapshot",
            operation: "getPerson",
            retryable: Option.match(status, {
              onNone: () => true,
              onSome: isRetryableStatus,
            }),
          });
          return Option.none<Option.Option<SdkPerson>>();
        }

        if (authProbe) yield* authGate.completeProbe(true);
        yield* breaker.recordSuccess(personBreakerKey);
        if (identityEpoch.current() !== epoch) {
          // The identity changed while this request was in flight; the answer
          // describes someone else now.
          return Option.none<Option.Option<SdkPerson>>();
        }
        if (result.success === null) {
          yield* resetCache(distinctId);
          return Option.some(Option.none<SdkPerson>());
        }
        yield* cache(distinctId, result.success);
        return Option.some(Option.some(result.success));
      })(),
    );

  const toSnapshot = (person: Option.Option<SdkPerson>): PersonSnapshot => ({
    isExpired: false,
    isStale: false,
    person: Option.getOrNull(person),
    reason: "fresh",
  });

  /**
   * Cache-first read. A fresh entry answers immediately; a stale or expired
   * one starts a refresh and waits at most
   * {@link FRESHNESS_BUDGET_MS} for it before answering from cache, leaving
   * the refresh to land for the next read. A cold cache waits for the full
   * request budget, because there is nothing else to serve.
   */
  const resolvePerson = Effect.fn("PersonInfoManager.resolvePerson")(function* (
    distinctId: string,
    options: { readonly forceFetch?: boolean; readonly freshnessBudgetMs?: number } = {},
  ) {
    const cached = yield* getPersonFromCache(distinctId);

    if (!options.forceFetch && Option.isSome(cached)) {
      const hit = cached.value;
      if (!hit.isStale && !hit.isExpired) {
        return toSnapshot(Option.some(hit.value));
      }

      // Stale but usable: wait only long enough for a fast server to beat the
      // cache, then answer from it and let the refresh land for the next read.
      const settled = yield* Deferred.make<Option.Option<Option.Option<SdkPerson>>>();
      yield* Effect.forkIn(
        Effect.flatMap(refresh(distinctId), (person) => Deferred.succeed(settled, person)),
        serviceScope,
        { startImmediately: true },
      );
      const within = yield* Effect.timeoutOption(
        Deferred.await(settled),
        Duration.millis(options.freshnessBudgetMs ?? FRESHNESS_BUDGET_MS),
      );
      return Option.match(within, {
        // The refresh is still running; its result lands for the next read.
        onNone: (): PersonSnapshot => ({
          isExpired: hit.isExpired,
          isStale: true,
          person: hit.value,
          reason: "refresh-in-flight",
        }),
        onSome: (refreshed) =>
          Option.match(refreshed, {
            onNone: (): PersonSnapshot => ({
              isExpired: hit.isExpired,
              isStale: true,
              person: hit.value,
              reason: "refresh-failed",
            }),
            onSome: toSnapshot,
          }),
      });
    }

    // Cold: there is nothing to serve, so the read waits for the request
    // budget. The request carries its own 10 s timeout, and this deadline
    // sits strictly behind it so the timeout is the one that fires and the
    // breaker gets to record the failure.
    const refreshed = yield* Effect.timeoutOption(
      refresh(distinctId),
      Duration.millis(options.freshnessBudgetMs ?? COLD_READ_BUDGET_MS),
    );
    const person = Option.flatten(refreshed);
    if (Option.isSome(person)) return toSnapshot(person.value);

    return Option.match(cached, {
      onNone: (): PersonSnapshot => ({
        isExpired: false,
        isStale: true,
        person: null,
        reason: "no-cache",
      }),
      onSome: (hit): PersonSnapshot => ({
        isExpired: hit.isExpired,
        isStale: true,
        person: hit.value,
        reason: Option.isNone(refreshed) ? "refresh-in-flight" : "refresh-failed",
      }),
    });
  });

  /**
   * Legacy read shape kept for internal callers that only need the snapshot.
   * `"cache"` never touches the network, `"fetch"` bypasses the cache, and
   * `"fetch-while-stale"` is the cache-first path.
   */
  const getPerson = (distinctId: string, cachePolicy: "cache" | "fetch" | "fetch-while-stale") =>
    Effect.gen(function* getPerson() {
      if (cachePolicy === "cache") {
        const personFromCache = yield* getPersonFromCache(distinctId);
        return Option.match(personFromCache, {
          onNone: () => null,
          onSome: (hit) => hit.value,
        });
      }

      const snapshot = yield* resolvePerson(distinctId, {
        forceFetch: cachePolicy === "fetch",
      });
      return snapshot.person;
    });

  return {
    cache,
    getPerson,
    getPersonFromCache,
    refresh,
    resetAllCaches,
    resetCache,
    resolvePerson,
  } as const;
});

export class PersonInfoManager extends Context.Service<
  PersonInfoManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/PersonInfoManager") {
  static Default = Layer.effect(PersonInfoManager, make());
}
