import type { SdkPerson } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as MutableRef from "effect/MutableRef";
import * as Random from "effect/Random";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { AtomRegistry } from "effect/unstable/reactivity";

import { ANONYMOUS_DISTINCT_ID_PREFIX } from "../../constants";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  countsTowardsBreaker,
  httpStatusOf,
  isAuthStatus,
  isRetryableStatus,
  withRequestTimeout,
} from "../network/policy";
import { ApiClient } from "../networking/api-client";
import { currentPersonAtom, featureFlagsByKeyAtom } from "../reactivity/client-state";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { IdentityEpoch } from "./identity-epoch";
import { PERSON_CACHE_KEY_PREFIX, PersonInfoManager } from "./person-info-manager";

const CACHE_KEY = "distinctId";

class IdentityNotInitializedError extends Schema.TaggedErrorClass<IdentityNotInitializedError>()(
  "IdentityNotInitializedError",
  { message: Schema.String },
) {}

/** Prefix shared by every cached feature-flag evaluation. */
export const FEATURE_FLAGS_CACHE_KEY_PREFIX = "feature-flags:";
const PAYWALL_CACHE_KEY_PREFIX = "paywall:";

/** Outcome of an identity switch. The local switch has happened in both cases. */
export type IdentifyOutcome =
  | {
      /** The server confirmed the identity and returned the person. */
      readonly status: "confirmed";
      readonly person: SdkPerson;
      /** The distinct id the events before the switch belong to. */
      readonly previousDistinctId: string;
    }
  | {
      /**
       * The server could not be reached. The switch is local for now and the
       * caller queues a `$identify` event so the server learns of it later.
       */
      readonly status: "deferred";
      // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the public `SetPersonAttributesResult`, which answers `null` when no snapshot exists.
      readonly person: SdkPerson | null;
      readonly previousDistinctId: string;
    };

const make = Effect.fn("makeIdentityManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const personInfoManager = yield* PersonInfoManager;
  const atomRegistry = yield* AtomRegistry.AtomRegistry;
  const apiClient = yield* ApiClient;
  const identityEpoch = yield* IdentityEpoch;
  const sdkConfiguration = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;
  const breaker = yield* CircuitBreaker;
  const authGate = yield* AuthGate;
  const identifyBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);
  const currentDistinctId = MutableRef.make(Option.none<string>());
  const makeAnonymousDistinctId = Effect.map(
    Random.next,
    (entropy) => `${ANONYMOUS_DISTINCT_ID_PREFIX}${entropy.toString(36).slice(2, 15)}`,
  );

  /**
   * Returns the current distinct id. If none is cached, a new anonymous
   * distinct id is generated and cached. A read that overlaps an
   * `identify()`/`reset()` answers with the identity in memory: the value it
   * read from storage describes the identity that was just replaced, and
   * adopting it would undo the switch.
   */
  const getDistinctId = () =>
    Effect.gen(function* getDistinctId() {
      const epoch = identityEpoch.current();
      const distinctId = yield* getDistinctIdFromCache();
      const current = MutableRef.get(currentDistinctId);
      if (identityEpoch.current() !== epoch && Option.isSome(current)) {
        return current.value;
      }
      if (distinctId) {
        MutableRef.set(currentDistinctId, Option.some(distinctId));
        yield* Effect.logDebug(`Using cached distinct id: ${distinctId}`);
        return distinctId;
      }

      if (Option.isSome(current)) {
        yield* cacheManager.set(CACHE_KEY, current.value);
        return current.value;
      }

      const anonymousDistinctId = yield* makeAnonymousDistinctId;
      yield* setDistinctIdInCache(anonymousDistinctId);
      return anonymousDistinctId;
    });

  /**
   * Starts a local identity switch before the request. The old caches are
   * retained until the server either confirms the switch or proves it should
   * be deferred, so a definitive validation rejection can restore them.
   */
  const switchLocalIdentity = Effect.fn("IdentityManager.switchLocalIdentity")(function* (
    distinctId: string,
  ) {
    yield* setDistinctIdInCache(distinctId);
    identityEpoch.bump();
    atomRegistry.set(featureFlagsByKeyAtom, {});
  });

  const invalidatePreviousIdentity = Effect.fn("IdentityManager.invalidatePreviousIdentity")(
    function* (previousDistinctId: string, distinctId: string) {
      if (previousDistinctId === distinctId) return;
      yield* personInfoManager.resetCache(previousDistinctId);
      yield* cacheManager.deleteByPrefix(`${FEATURE_FLAGS_CACHE_KEY_PREFIX}${previousDistinctId}:`);
      yield* cacheManager.deleteByPrefix(`${PAYWALL_CACHE_KEY_PREFIX}${previousDistinctId}:`);
    },
  );

  /**
   * One identify request, gated by the breaker and the authentication pause.
   * `None` means the server could not be reached, answered with a verdict
   * that will be retried, or rejected the key; any other non-retryable 4xx
   * fails.
   */
  const requestIdentify = Effect.fn("IdentityManager.requestIdentify")(function* (
    previousDistinctId: string,
    distinctId: string,
    options: { email?: string; name?: string },
  ) {
    if (authGate.isPaused()) return Option.none<SdkPerson>();
    const allowed = yield* breaker.canAttempt(identifyBreakerKey, "identify");
    if (!allowed) return Option.none<SdkPerson>();

    const commonHeaders = yield* getCommonSdkHeaders();
    const outcome = yield* Effect.result(
      withRequestTimeout(
        "identify",
        apiClient.sdk.identify({
          headers: {
            ...commonHeaders,
            "x-distinct-id": previousDistinctId,
          },
          payload: {
            distinctId,
            email: options.email,
            name: options.name,
          },
        }),
      ),
    );

    if (Result.isSuccess(outcome)) {
      yield* breaker.recordSuccess(identifyBreakerKey);
      return Option.some(outcome.success);
    }

    const status = httpStatusOf(outcome.failure);
    const statusCode = Option.getOrUndefined(status);
    if (statusCode !== undefined && isAuthStatus(statusCode)) {
      // A rejected key is not a verdict on the switch: the pause holds the
      // queued `$identify` until the key is accepted again.
      yield* breaker.releaseProbe(identifyBreakerKey);
      yield* authGate.pause("identify", statusCode);
      return Option.none<SdkPerson>();
    }
    if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
      yield* breaker.recordFailure(identifyBreakerKey);
    } else {
      yield* breaker.releaseProbe(identifyBreakerKey);
    }
    if (statusCode !== undefined && !isRetryableStatus(statusCode)) {
      return yield* Effect.fail(outcome.failure);
    }
    yield* diagnostics.emit({
      code: DIAGNOSTIC_CODES.REQUEST_FAILED,
      httpStatus: statusCode,
      kind: "transport",
      message: "Identify request failed; the identity switch is queued for delivery",
      operation: "identify",
      retryable: true,
    });
    return Option.none<SdkPerson>();
  });

  /**
   * Identifies the person by switching the current distinct id. The local
   * switch always happens first; the network then either confirms it or, on
   * a transport failure, leaves it `deferred` for the caller to queue. A
   * verdict the server will not change (a non-retryable 4xx) fails.
   * @param options - The options.
   * @param deferRequest - Adopt locally and return a deferred alias without a request during boot.
   */
  const identify = (
    distinctId: string,
    options: {
      email?: string;
      name?: string;
    },
    deferRequest = false,
  ) =>
    Effect.gen(function* identify() {
      const previousDistinctId = yield* getDistinctId();
      const previousFlags = atomRegistry.get(featureFlagsByKeyAtom);
      yield* switchLocalIdentity(distinctId);

      const request = yield* Effect.result(
        deferRequest
          ? Effect.succeed(Option.none<SdkPerson>())
          : requestIdentify(previousDistinctId, distinctId, options),
      );
      if (Result.isFailure(request)) {
        yield* setDistinctIdInCache(previousDistinctId);
        identityEpoch.bump();
        atomRegistry.set(featureFlagsByKeyAtom, previousFlags);
        return yield* Effect.fail(request.failure);
      }
      yield* invalidatePreviousIdentity(previousDistinctId, distinctId);
      const confirmed = request.success;

      if (Option.isSome(confirmed)) {
        yield* personInfoManager.cache(distinctId, confirmed.value);
        atomRegistry.set(currentPersonAtom, Option.some({ ...confirmed.value, distinctId }));
        return { person: confirmed.value, previousDistinctId, status: "confirmed" as const };
      }

      const cached = yield* personInfoManager.getPerson(distinctId, "cache");
      atomRegistry.set(currentPersonAtom, Option.fromNullOr(cached));
      return { person: cached, previousDistinctId, status: "deferred" as const };
    });

  /**
   * Adopts `distinctId` locally without asking the server. Used when the host
   * pins the identity at init and the server has refused the alias: the app
   * still knows who the user is, and the per-identity state of the previous
   * id must not answer for the new one.
   */
  const pinLocalIdentity = Effect.fn("IdentityManager.pinLocalIdentity")(function* (
    distinctId: string,
  ) {
    const previousDistinctId = yield* getDistinctId();
    yield* switchLocalIdentity(distinctId);
    yield* invalidatePreviousIdentity(previousDistinctId, distinctId);
    const cached = yield* personInfoManager.getPerson(distinctId, "cache");
    atomRegistry.set(currentPersonAtom, Option.fromNullOr(cached));
  });

  /**
   * Drops the current identity and everything scoped to it. Queued analytics
   * events and the transaction outbox deliberately survive: they belong to the
   * identity that captured them and are already stamped with it.
   *
   * The next anonymous identity is in memory before the first storage call,
   * so `AnalyticsService.capture` — synchronous, and possibly running while
   * the deletes below are still in flight — always finds an identity to stamp.
   * The durable cache is left without one on purpose: `getDistinctId()`
   * writes the anonymous id back the first time it is asked for it.
   */
  const reset = () =>
    Effect.gen(function* reset() {
      const previousDistinctId = MutableRef.get(currentDistinctId);
      const anonymousDistinctId = yield* makeAnonymousDistinctId;
      identityEpoch.bump();
      MutableRef.set(currentDistinctId, Option.some(anonymousDistinctId));
      yield* cacheManager.delete(CACHE_KEY);
      yield* cacheManager.deleteByPrefix(PERSON_CACHE_KEY_PREFIX);
      yield* cacheManager.deleteByPrefix(FEATURE_FLAGS_CACHE_KEY_PREFIX);
      if (Option.isSome(previousDistinctId)) {
        yield* cacheManager.deleteByPrefix(
          `${PAYWALL_CACHE_KEY_PREFIX}${previousDistinctId.value}:`,
        );
      }
      atomRegistry.set(currentPersonAtom, Option.none());
      atomRegistry.set(featureFlagsByKeyAtom, {});
    });

  // Helpers
  const getDistinctIdFromCache = () =>
    cacheManager.get<string>(CACHE_KEY).pipe(
      Effect.map(
        Option.match({
          onNone: () => null,
          onSome: (distinctId) => distinctId.value,
        }),
      ),
    );
  const setDistinctIdInCache = (distinctId: string) =>
    Effect.gen(function* () {
      MutableRef.set(currentDistinctId, Option.some(distinctId));
      yield* cacheManager.set(CACHE_KEY, distinctId);
    });

  /** Synchronous identity read for the analytics capture path. */
  const getDistinctIdUnsafe = () =>
    Option.getOrElse(MutableRef.get(currentDistinctId), () => {
      throw new IdentityNotInitializedError({
        message: "IdentityManager was read before its identity was initialized",
      });
    });

  return {
    getDistinctId,
    getDistinctIdFromCache,
    getDistinctIdUnsafe,
    identify,
    pinLocalIdentity,
    reset,
    signOut: reset,
  } as const;
});

export class IdentityManager extends Context.Service<
  IdentityManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/IdentityManager") {
  static Default = Layer.effect(IdentityManager, make());
}
