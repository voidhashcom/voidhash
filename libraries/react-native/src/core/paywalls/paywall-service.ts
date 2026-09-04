import type { SdkResolvedPaywall } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { IdentityManager } from "../identity/identity-manager";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  countsTowardsBreaker,
  FRESHNESS_BUDGET_MS,
  httpStatusOf,
  isAuthStatus,
  isRetryableStatus,
  withRequestTimeout,
} from "../network/policy";
import { SingleFlight } from "../network/single-flight";
import { ApiClient } from "../networking/api-client";
import type { LocationSlug } from "../schema/registry";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { PaywallUnavailableError } from "../../errors";

/**
 * Release row of a resolved paywall showing, including the deploy-contract §6
 * `runtime` block for code releases (`null`/absent for visual-editor
 * releases). Passed through from the server response untouched.
 */
export type ResolvedPaywallRelease = NonNullable<SdkResolvedPaywall["showing"]["paywallRelease"]>;

/**
 * The §6 runtime block of a code-release paywall: content-addressed identity,
 * the product slugs the paywall uses and the author-configured variables.
 */
export type PaywallReleaseRuntime = NonNullable<ResolvedPaywallRelease["runtime"]>;

/** 7 days. A configuration this old is still shown rather than hidden. */
const PAYWALL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** 1 hour. Past this the cached configuration is refreshed behind the read. */
const PAYWALL_CACHE_STALE_MS = 1000 * 60 * 60;

/** Placements remembered for preload on the next launch. */
export const PAYWALL_PLACEMENTS_CACHE_KEY = "paywall:placements";

/** Ceiling on the remembered placement list. */
export const PAYWALL_PLACEMENTS_CAP = 20;

const paywallCacheKey = (distinctId: string, placement: string) =>
  `paywall:${distinctId}:${placement}`;

// oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the server's "no paywall assigned" answer, which the SDK passes through as `null`.
type ResolvedPaywall = SdkResolvedPaywall | null;

/**
 * Resolves the paywall assigned to a location, cache-first. A configuration
 * that has ever been resolved on this device is served immediately and
 * refreshed behind the read, so an assigned paywall still shows during an
 * outage. Only a placement that has never resolved fails, with
 * {@link PaywallUnavailableError}, which callers render as "unavailable"
 * rather than as an error.
 */
export class PaywallService extends Context.Service<PaywallService>()(
  "rn-voidhash/PaywallService",
  {
    make: Effect.gen(function* () {
      const apiClient = yield* ApiClient;
      const identityManager = yield* IdentityManager;
      const cacheManager = yield* CacheManager;
      const sdkConfiguration = yield* SdkConfiguration;
      const diagnostics = yield* Diagnostics;
      const breaker = yield* CircuitBreaker;
      const authGate = yield* AuthGate;
      const singleFlight = yield* SingleFlight;
      const serviceScope = yield* Effect.scope;
      const paywallBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);

      /** Placements this device has resolved before, most recent last. */
      const getKnownPlacements = Effect.fn("PaywallService.getKnownPlacements")(function* () {
        const cached = yield* cacheManager.get<ReadonlyArray<unknown>>(
          PAYWALL_PLACEMENTS_CACHE_KEY,
        );
        return Option.match(cached, {
          onNone: () => Arr.empty<string>(),
          onSome: (hit) => {
            if (!Array.isArray(hit.value)) return Arr.empty<string>();
            const placements = hit.value.filter(P.isString).filter((placement) => placement !== "");
            return placements
              .filter((placement, index) => placements.lastIndexOf(placement) === index)
              .slice(-PAYWALL_PLACEMENTS_CAP);
          },
        });
      });

      const rememberPlacement = Effect.fn("PaywallService.rememberPlacement")(function* (
        placement: string,
      ) {
        const known = yield* getKnownPlacements();
        if (known.at(-1) === placement) return;
        yield* cacheManager.set(
          PAYWALL_PLACEMENTS_CACHE_KEY,
          [...known.filter((knownPlacement) => knownPlacement !== placement), placement].slice(
            -PAYWALL_PLACEMENTS_CAP,
          ),
        );
      });

      const fetchFromServer = Effect.fn("PaywallService.fetchFromServer")(function* (
        placement: string,
        distinctId: string,
      ) {
        const commonHeaders = yield* getCommonSdkHeaders();
        return yield* withRequestTimeout(
          "resolvePaywall",
          apiClient.sdk.resolvePaywall({
            headers: {
              ...commonHeaders,
              "x-distinct-id": distinctId,
            },
            payload: { locationSlug: placement },
          }),
        );
      });

      /**
       * One resolution per identity and placement, gated by the breaker and the
       * authentication pause. Never fails — a failed resolution leaves the
       * caller on its cached configuration.
       */
      const refreshForIdentity = (placement: string, distinctId: string) =>
        singleFlight.run(
          paywallCacheKey(distinctId, placement),
          Effect.fn("PaywallService.refresh")(function* () {
            const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
            if (authGate.isPaused() && !authProbe) {
              return Option.none<ResolvedPaywall>();
            }
            const allowed = yield* breaker.canAttempt(paywallBreakerKey, "resolvePaywall");
            if (!allowed) {
              if (authProbe) yield* authGate.completeProbe(false);
              return Option.none<ResolvedPaywall>();
            }

            const outcome = yield* Effect.result(fetchFromServer(placement, distinctId));
            if (Result.isFailure(outcome)) {
              const status = httpStatusOf(outcome.failure);
              const statusCode = Option.getOrUndefined(status);
              if (authProbe) {
                yield* authGate.completeProbe(
                  statusCode !== undefined && !isAuthStatus(statusCode),
                );
              }
              if (statusCode !== undefined && isAuthStatus(statusCode)) {
                yield* breaker.releaseProbe(paywallBreakerKey);
                yield* authGate.pause("resolvePaywall", statusCode);
              } else if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
                yield* breaker.recordFailure(paywallBreakerKey);
              } else {
                yield* breaker.releaseProbe(paywallBreakerKey);
              }
              yield* diagnostics.emit({
                code: DIAGNOSTIC_CODES.REQUEST_FAILED,
                httpStatus: Option.getOrUndefined(status),
                kind: "transport",
                message: `Paywall resolution failed for "${placement}"`,
                operation: "resolvePaywall",
                retryable: Option.match(status, {
                  onNone: () => true,
                  onSome: isRetryableStatus,
                }),
              });
              return Option.none<ResolvedPaywall>();
            }

            if (authProbe) yield* authGate.completeProbe(true);
            yield* breaker.recordSuccess(paywallBreakerKey);
            yield* cacheManager.set(paywallCacheKey(distinctId, placement), outcome.success, {
              staleTime: PAYWALL_CACHE_STALE_MS,
              ttl: PAYWALL_CACHE_TTL_MS,
            });
            yield* rememberPlacement(placement);
            return Option.some<ResolvedPaywall>(outcome.success);
          })(),
        );

      const getPaywallForLocation = Effect.fn("PaywallService.getPaywallForLocation")(function* (
        locationSlug: LocationSlug,
      ) {
        const placement = String(locationSlug);
        const distinctId = yield* identityManager.getDistinctId();
        const cached = yield* cacheManager.get<ResolvedPaywall>(
          paywallCacheKey(distinctId, placement),
        );

        if (Option.isSome(cached)) {
          const hit = cached.value;
          if (hit.value !== null) yield* rememberPlacement(placement);
          if (!hit.isStale && !hit.isExpired) return hit.value;

          const settled = yield* Deferred.make<Option.Option<ResolvedPaywall>>();
          yield* Effect.forkIn(
            Effect.flatMap(refreshForIdentity(placement, distinctId), (result) =>
              Deferred.succeed(settled, result),
            ),
            serviceScope,
            { startImmediately: true },
          );
          const within = yield* Effect.timeoutOption(
            Deferred.await(settled),
            Duration.millis(FRESHNESS_BUDGET_MS),
          );
          return Option.getOrElse(Option.flatten(within), () => hit.value);
        }

        const refreshed = yield* refreshForIdentity(placement, distinctId);
        if (Option.isSome(refreshed)) return refreshed.value;

        return yield* Effect.fail(
          new PaywallUnavailableError(
            `No cached paywall configuration for "${placement}" and the server is unreachable.`,
          ),
        );
      });

      /**
       * Warms the cache for the given placements plus everything this device
       * has resolved before. Runs in the background at boot so the first
       * `show()` renders without a round trip.
       */
      const preloadPlacements = Effect.fn("PaywallService.preloadPlacements")(function* (
        placements: ReadonlyArray<string>,
      ) {
        const known = yield* getKnownPlacements();
        const targets = Arr.dedupe([...placements, ...known]);
        const distinctId = yield* identityManager.getDistinctId();
        const resolved = yield* Effect.forEach(
          targets,
          Effect.fn("PaywallService.preloadPlacement")(function* (placement: string) {
            yield* refreshForIdentity(placement, distinctId);
            const cached = yield* cacheManager.get<ResolvedPaywall>(
              paywallCacheKey(distinctId, placement),
            );
            if (Option.isNone(cached) || cached.value.value === null) return Option.none();
            const htmlUrl = cached.value.value.showing.paywallRelease?.htmlUrl;
            return htmlUrl === undefined
              ? Option.none()
              : Option.some({ htmlUrl, locationSlug: placement });
          }),
          { concurrency: 1 },
        );
        return Arr.getSomes(resolved);
      });

      const refresh = Effect.fn("PaywallService.refreshCurrentIdentity")(function* (
        placement: string,
      ) {
        const distinctId = yield* identityManager.getDistinctId();
        return yield* refreshForIdentity(placement, distinctId);
      });

      return {
        getKnownPlacements,
        getPaywallForLocation,
        preloadPlacements,
        refresh,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
