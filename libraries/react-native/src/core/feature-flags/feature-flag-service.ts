import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { AtomRegistry } from "effect/unstable/reactivity";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { IdentityEpoch } from "../identity/identity-epoch";
import { IdentityManager } from "../identity/identity-manager";
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
import { featureFlagsByKeyAtom, normalizeFeatureFlagKeys } from "../reactivity/client-state";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<{
    readonly enabled: boolean;
    readonly key: string;
    readonly payload: unknown;
    readonly variantKey: Option.Option<string>;
  }>;
  /**
   * The evaluation was served from cache past its refresh window, or no
   * evaluation has ever succeeded. Flags are still safe to act on — they are
   * simply not guaranteed to reflect the latest dashboard state.
   */
  readonly isStale?: boolean;
}

/** Past this the cached evaluation is served while a refresh runs behind it. */
const FEATURE_FLAGS_CACHE_STALE_MS = 1000 * 60 * 5;
const FeatureFlagKeysFromJson = Schema.fromJsonString(Schema.Array(Schema.String));
const encodeFeatureFlagKeys = Schema.encodeSync(FeatureFlagKeysFromJson);

/**
 * Cache key for one evaluation.
 *
 * The distinct id is part of the key because flag evaluation is
 * identity-scoped: without it, the anonymous user's variants would be served
 * to the identified one for as long as the entry lives. The requested keys are
 * sorted on a *copy* — the caller's array is their data and must not be
 * mutated, which the previous in-place `.sort()` was doing.
 */
const generateCacheKey = (distinctId: string, flagKeys?: string[]) =>
  `feature-flags:${distinctId}:${flagKeys && Arr.isReadonlyArrayNonEmpty(flagKeys) ? encodeFeatureFlagKeys(Arr.sort(flagKeys, Str.Order)) : "all"}`;

/**
 * Evaluates feature flags through the SDK API, cache-first. A cached
 * evaluation is served at any age and refreshed behind the read, so flags keep
 * answering during an outage and never cost the caller a round trip. Every
 * result (cached or fresh) is published into the reactive
 * `featureFlagsByKeyAtom` keyed by the normalized request signature, so React
 * hooks can subscribe to exactly the slice of state they asked for.
 */
export class FeatureFlagService extends Context.Service<FeatureFlagService>()(
  "rn-voidhash/FeatureFlagService",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const apiClient = yield* ApiClient;
      const atomRegistry = yield* AtomRegistry.AtomRegistry;
      const identityManager = yield* IdentityManager;
      const sdkConfiguration = yield* SdkConfiguration;
      const diagnostics = yield* Diagnostics;
      const breaker = yield* CircuitBreaker;
      const authGate = yield* AuthGate;
      const singleFlight = yield* SingleFlight;
      const identityEpoch = yield* IdentityEpoch;
      const serviceScope = yield* Effect.scope;
      const flagsBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);

      /**
       * Publishes an evaluation to the reactive store, unless the identity
       * changed since `epoch`: the caller still gets its answer, but a read
       * that started under the previous identity must not write that
       * identity's flags into the store `identify()`/`reset()` just cleared.
       */
      const publishResult = (result: FeatureFlagsResult, epoch: number, flagKeys?: string[]) => {
        if (identityEpoch.current() !== epoch) return result;
        const normalizedKey = normalizeFeatureFlagKeys(flagKeys);
        const current = atomRegistry.get(featureFlagsByKeyAtom);
        atomRegistry.set(featureFlagsByKeyAtom, {
          ...current,
          [normalizedKey]: result,
        });
        return result;
      };

      /**
       * One evaluation per cache key, gated by the breaker and the
       * authentication pause. Never fails — a failed evaluation leaves the
       * caller on its cached flags.
       */
      const refresh = (cacheKey: string, distinctId: string, flagKeys?: string[]) =>
        singleFlight.run(
          cacheKey,
          Effect.fn("FeatureFlagService.refresh")(function* () {
            // Captured before the request so an evaluation belonging to the
            // previous identity cannot be written back after `identify()`.
            const epoch = identityEpoch.current();
            const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
            if (authGate.isPaused() && !authProbe) {
              return Option.none<FeatureFlagsResult>();
            }
            const allowed = yield* breaker.canAttempt(flagsBreakerKey, "evaluateFeatureFlags");
            if (!allowed) {
              if (authProbe) yield* authGate.completeProbe(false);
              return Option.none<FeatureFlagsResult>();
            }

            // Header assembly reads the platform and configuration services and
            // must not be able to fail the read, so it happens inside the same
            // recovered region as the request itself.
            const outcome = yield* Effect.result(
              Effect.flatMap(getCommonSdkHeaders(), (commonHeaders) =>
                withRequestTimeout(
                  "evaluateFeatureFlags",
                  apiClient.sdk.evaluateFeatureFlags({
                    headers: {
                      ...commonHeaders,
                      "x-distinct-id": distinctId,
                    },
                    payload: { flagKeys },
                  }),
                ),
              ),
            );

            if (Result.isFailure(outcome)) {
              const status = httpStatusOf(outcome.failure);
              const statusCode = Option.getOrUndefined(status);
              if (authProbe) {
                yield* authGate.completeProbe(
                  statusCode !== undefined && !isAuthStatus(statusCode),
                );
              }
              if (statusCode !== undefined && isAuthStatus(statusCode)) {
                yield* breaker.releaseProbe(flagsBreakerKey);
                yield* authGate.pause("evaluateFeatureFlags", statusCode);
              } else if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
                yield* breaker.recordFailure(flagsBreakerKey);
              } else {
                yield* breaker.releaseProbe(flagsBreakerKey);
              }
              yield* diagnostics.emit({
                code: DIAGNOSTIC_CODES.REQUEST_FAILED,
                httpStatus: Option.getOrUndefined(status),
                kind: "transport",
                message: "Feature flag evaluation failed; serving cached flags",
                operation: "evaluateFeatureFlags",
                retryable: Option.match(status, {
                  onNone: () => true,
                  onSome: isRetryableStatus,
                }),
              });
              return Option.none<FeatureFlagsResult>();
            }

            if (authProbe) yield* authGate.completeProbe(true);
            yield* breaker.recordSuccess(flagsBreakerKey);
            if (identityEpoch.current() !== epoch) {
              // The identity changed while this evaluation was in flight; the
              // answer describes someone else now.
              return Option.none<FeatureFlagsResult>();
            }

            const result: FeatureFlagsResult = {
              flags: outcome.success.flags.map((flag) => ({
                ...flag,
                variantKey: flag.variantKey,
              })),
              isStale: false,
            };
            yield* cacheManager
              .set(cacheKey, { flags: result.flags }, { staleTime: FEATURE_FLAGS_CACHE_STALE_MS })
              .pipe(
                // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: a failed write only costs the next launch a refetch, and must not fail the read.
                Effect.catchCause((cause) =>
                  diagnostics.emit({
                    code: DIAGNOSTIC_CODES.CACHE_WRITE_FAILED,
                    kind: "cache",
                    message: `Could not persist the flag evaluation: ${Cause.pretty(cause)}`,
                    operation: "evaluateFeatureFlags",
                    retryable: true,
                  }),
                ),
              );
            publishResult(result, epoch, flagKeys);
            return Option.some(result);
          })(),
        );

      const getFeatureFlags = Effect.fn("FeatureFlagService.getFeatureFlags")(function* (
        flagKeys?: string[],
      ) {
        const epoch = identityEpoch.current();
        const distinctId = yield* identityManager.getDistinctId();
        const cacheKey = generateCacheKey(distinctId, flagKeys);
        const exact = yield* cacheManager.get<FeatureFlagsResult>(cacheKey);
        const allFlags =
          Option.isNone(exact) && flagKeys && Arr.isReadonlyArrayNonEmpty(flagKeys)
            ? yield* cacheManager.get<FeatureFlagsResult>(generateCacheKey(distinctId))
            : Option.none();
        const cached = Option.orElse(exact, () =>
          Option.map(allFlags, (hit) => ({
            ...hit,
            value: {
              flags: hit.value.flags.filter((flag) => flagKeys?.includes(flag.key)),
            },
          })),
        );

        if (Option.isSome(cached)) {
          const hit = cached.value;
          if (!hit.isStale && !hit.isExpired) {
            return publishResult({ flags: hit.value.flags, isStale: false }, epoch, flagKeys);
          }

          const settled = yield* Deferred.make<Option.Option<FeatureFlagsResult>>();
          yield* Effect.forkIn(
            Effect.flatMap(refresh(cacheKey, distinctId, flagKeys), (result) =>
              Deferred.succeed(settled, result),
            ),
            serviceScope,
            { startImmediately: true },
          );
          const within = yield* Effect.timeoutOption(
            Deferred.await(settled),
            Duration.millis(FRESHNESS_BUDGET_MS),
          );
          return Option.match(Option.flatten(within), {
            onNone: () => publishResult({ flags: hit.value.flags, isStale: true }, epoch, flagKeys),
            onSome: (result) => result,
          });
        }

        // Cold: with nothing to serve, wait for the request budget. The
        // deadline sits strictly behind the per-attempt timeout so the
        // timeout fires first and the breaker records the failure.
        const refreshed = yield* Effect.timeoutOption(
          refresh(cacheKey, distinctId, flagKeys),
          Duration.millis(COLD_READ_BUDGET_MS),
        );
        return Option.match(Option.flatten(refreshed), {
          onNone: () =>
            publishResult(
              {
                flags: Option.match(cached, {
                  onNone: () => [],
                  onSome: (hit) => hit.value.flags,
                }),
                isStale: true,
              },
              epoch,
              flagKeys,
            ),
          onSome: (result) => result,
        });
      });

      return { getFeatureFlags } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
