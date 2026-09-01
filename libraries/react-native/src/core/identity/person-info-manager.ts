import type { SdkPerson } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";

import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

const make = Effect.fn("makePersonInfoManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;

  const generatePersonCacheKey = (distinctId: string) => `person:${distinctId}`;

  const getPersonFromCache = (distinctId: string) =>
    cacheManager.get<SdkPerson>(generatePersonCacheKey(distinctId));

  const cache = (distinctId: string, person: SdkPerson) =>
    cacheManager.set(generatePersonCacheKey(distinctId), person, {
      ttl: 1000 * 60 * 60 * 24 * 2, // 2 days
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  const resetCache = (distinctId: string) =>
    cacheManager.delete(generatePersonCacheKey(distinctId));

  const getPersonFromServerAndCache = (distinctId: string) =>
    Effect.gen(function* getPersonFromServerAndCache() {
      const commonHeaders = yield* getCommonSdkHeaders();
      // A brand-new (or freshly-reset) distinct id has no persisted person on
      // the server until `syncPersonAttributes` creates it. On init those
      // requests race, so `getPerson` legitimately 404s for a not-yet-created
      // person. Treat that as "no snapshot yet" (null) — the same shape the
      // cache-miss path already returns — instead of failing client init. Any
      // other error still propagates so genuine faults aren't masked.
      const result = yield* apiClient.sdk
        .getPerson({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
          },
        })
        .pipe(Effect.catchTag("ApiSdkPersonNotFoundErrorJsonEncoding", () => Effect.succeed(null)));
      if (result === null) {
        return null;
      }
      yield* cache(distinctId, result);
      return result;
    });

  const getPerson = (distinctId: string, cachePolicy: "cache" | "fetch" | "fetch-while-stale") =>
    Effect.gen(function* getPerson() {
      if (cachePolicy === "cache") {
        const personFromCache = yield* getPersonFromCache(distinctId);
        return Option.match(personFromCache, {
          onNone: () => null,
          onSome: (hit) => hit.value,
        });
      }

      if (cachePolicy === "fetch") {
        return yield* getPersonFromServerAndCache(distinctId);
      }

      // fetch-while-stale policy
      const personFromCache = yield* getPersonFromCache(distinctId);
      if (
        Option.isSome(personFromCache) &&
        !personFromCache.value.isStale &&
        !personFromCache.value.isExpired
      ) {
        return personFromCache.value.value;
      }

      return yield* getPersonFromServerAndCache(distinctId);
    });

  return {
    cache,
    getPerson,
    getPersonFromCache,
    resetCache,
  } as const;
});

export class PersonInfoManager extends Context.Service<
  PersonInfoManager,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/PersonInfoManager") {
  static Default = Layer.effect(PersonInfoManager, make()).pipe(
    Layer.provide(CacheManager.Default),
  );
}
