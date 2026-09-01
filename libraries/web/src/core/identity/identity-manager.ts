import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";

import type { VoidhashTraits } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { ApiClient, type WebSdkHeaders } from "../networking/api-client";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";

const DISTINCT_ID_KEY = "identity:distinct-id";
const ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

const buildTraitsKey = (distinctId: string) => `identity:traits:${distinctId}`;

const normalizeTraits = (traits?: VoidhashTraits) => {
  if (!traits || Arr.isReadonlyArrayEmpty(R.keys(traits))) {
    return undefined;
  }
  return traits;
};

const buildIdentifyPayload = (distinctId: string, traits?: VoidhashTraits) => {
  if (traits) {
    return { distinctId, traits };
  }

  return { distinctId };
};

const buildPersonAttributesPayload = (input: {
  email?: string;
  name?: string;
  traits?: VoidhashTraits;
}) => {
  const payload: { email?: string; name?: string; traits?: VoidhashTraits } = {};
  if (input.email !== undefined) {
    payload.email = input.email;
  }
  if (input.name !== undefined) {
    payload.name = input.name;
  }
  const normalizedTraits = normalizeTraits(input.traits);
  if (normalizedTraits) {
    payload.traits = normalizedTraits;
  }

  return payload;
};

const make = Effect.fn("makeIdentityManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const eventBus = yield* EventBusProvider;
  const platform = yield* PlatformProvider;
  const config = yield* SdkConfiguration;

  let currentDistinctId = Option.none<string>();

  const getDistinctId = () => currentDistinctId;

  const getSdkHeaders = () =>
    platform.getSdkHeaders({
      observerMode: config.observerMode,
      publishableKey: config.publishableKey,
    });

  const buildHeaders = (distinctId: string): WebSdkHeaders => ({
    ...getSdkHeaders(),
    "x-distinct-id": distinctId,
  });

  const initialize = (initialDistinctId?: string) =>
    Effect.gen(function* initialize() {
      const cached = yield* cacheManager.get<string>(DISTINCT_ID_KEY);
      const cachedDistinctId = Option.map(cached, (hit) => hit.value);
      const selectedDistinctId = Option.fromNullishOr(initialDistinctId).pipe(
        Option.orElse(() => cachedDistinctId),
        Option.getOrElse(() => `${ANONYMOUS_DISTINCT_ID_PREFIX}${platform.randomId()}`),
      );
      currentDistinctId = Option.some(selectedDistinctId);

      yield* cacheManager.set(DISTINCT_ID_KEY, selectedDistinctId);

      if (
        initialDistinctId &&
        Option.isSome(cachedDistinctId) &&
        cachedDistinctId.value !== initialDistinctId
      ) {
        yield* identify(initialDistinctId);
        return currentDistinctId;
      }

      return currentDistinctId;
    });

  const identify = (distinctId: string, traits?: VoidhashTraits) =>
    Effect.gen(function* identify() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      const previousDistinctId = currentDistinctId.value;

      const normalizedTraits = normalizeTraits(traits);
      yield* apiClient.sdk.identify({
        headers: buildHeaders(previousDistinctId),
        payload: buildIdentifyPayload(distinctId, normalizedTraits),
      });

      yield* cacheManager.set(DISTINCT_ID_KEY, distinctId);
      yield* cacheManager.set(buildTraitsKey(distinctId), traits ?? {});
      currentDistinctId = Option.some(distinctId);
      eventBus.emit("identity-changed", {
        distinctId,
        previousDistinctId: Option.some(previousDistinctId),
      });
    });

  const reset = () =>
    Effect.gen(function* reset() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      const previousDistinctId = currentDistinctId.value;
      const nextAnonymousId = `${ANONYMOUS_DISTINCT_ID_PREFIX}${platform.randomId()}`;
      yield* cacheManager.set(DISTINCT_ID_KEY, nextAnonymousId);
      yield* cacheManager.set(buildTraitsKey(nextAnonymousId), {});
      currentDistinctId = Option.some(nextAnonymousId);
      eventBus.emit("identity-changed", {
        distinctId: nextAnonymousId,
        previousDistinctId: Option.some(previousDistinctId),
      });
    });

  /**
   * Synchronously persists person attributes to the server and returns the
   * resulting person snapshot. Reserved `email`/`name` are sent as dedicated
   * fields; everything else is forwarded as `traits`.
   */
  const setPersonAttributesSync = (input: {
    email?: string;
    name?: string;
    traits?: VoidhashTraits;
  }) =>
    Effect.gen(function* setPersonAttributesSync() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      return yield* apiClient.sdk.syncPersonAttributes({
        headers: buildHeaders(currentDistinctId.value),
        payload: buildPersonAttributesPayload(input),
      });
    });

  return {
    getDistinctId,
    identify,
    initialize,
    reset,
    setPersonAttributesSync,
  };
});

export class IdentityManager extends Context.Service<
  IdentityManager,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/IdentityManager") {
  static Default = Layer.effect(IdentityManager, make());
}
