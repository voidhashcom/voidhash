import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Random from "effect/Random";
import * as Option from "effect/Option";
import { AtomRegistry } from "effect/unstable/reactivity";

import { ANONYMOUS_DISTINCT_ID_PREFIX } from "../../constants";
import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { currentPersonAtom, featureFlagsByKeyAtom } from "../reactivity/client-state";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { PersonInfoManager } from "./person-info-manager";

const CACHE_KEY = "distinctId";

const make = Effect.fn("makeIdentityManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const personInfoManager = yield* PersonInfoManager;
  const atomRegistry = yield* AtomRegistry.AtomRegistry;
  const apiClient = yield* ApiClient;

  /**
   * Returns the current distinct id. If none is cached, a new anonymous distinct id is generated and cached.
   */
  const getDistinctId = () =>
    Effect.gen(function* getDistinctId() {
      const distinctId = yield* getDistinctIdFromCache();
      if (distinctId) {
        yield* Effect.logDebug(`Using cached distinct id: ${distinctId}`);
        return distinctId;
      }

      const entropy = yield* Random.next;
      const anonymousDistinctId = `${ANONYMOUS_DISTINCT_ID_PREFIX}${entropy.toString(36).slice(2, 15)}`;
      yield* setDistinctIdInCache(anonymousDistinctId);
      return anonymousDistinctId;
    });

  /**
   * Identifies the person by switching the current distinct id.
   * @param options - The options.
   */
  const identify = (
    distinctId: string,
    options: {
      email?: string;
      name?: string;
    },
  ) =>
    Effect.gen(function* identify() {
      const currentDistinctId = yield* getDistinctId();
      const commonHeaders = yield* getCommonSdkHeaders();
      const identifyRequest = yield* apiClient.sdk.identify({
        headers: {
          ...commonHeaders,
          "x-distinct-id": currentDistinctId,
        },
        payload: {
          distinctId,
          email: options.email,
          name: options.name,
        },
      });

      yield* Effect.all(
        [setDistinctIdInCache(distinctId), personInfoManager.cache(distinctId, identifyRequest)],
        { concurrency: 1 },
      );

      // Identity has changed: surface the new person and clear stale
      // feature flag state, since flag evaluations are identity-scoped.
      atomRegistry.set(currentPersonAtom, Option.some({
        ...identifyRequest,
        distinctId,
      }));
      atomRegistry.set(featureFlagsByKeyAtom, {});
    });

  const reset = () =>
    Effect.gen(function* reset() {
      yield* cacheManager.clear();
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
  const setDistinctIdInCache = (distinctId: string) => cacheManager.set(CACHE_KEY, distinctId);

  return {
    getDistinctId,
    getDistinctIdFromCache,
    identify,
    reset,
    signOut: reset,
  } as const;
});

export class IdentityManager extends Context.Service<
  IdentityManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/IdentityManager") {
  static Default = Layer.effect(IdentityManager, make()).pipe(
    Layer.provide(Layer.mergeAll(CacheManager.Default, PersonInfoManager.Default)),
  );
}
