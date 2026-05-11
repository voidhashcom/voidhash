import type { SdkPerson as SdkCustomer } from "@voidhash/generated-clients";
import { Effect, Layer, ServiceMap } from "effect";

import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

const make = Effect.gen(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;

  const generateCustomerCacheKey = (distinctId: string) =>
    `customer:${distinctId}`;

  const getCustomerFromCache = (distinctId: string) =>
    cacheManager.get<SdkCustomer>(generateCustomerCacheKey(distinctId));

  const cache = (distinctId: string, customer: SdkCustomer) =>
    cacheManager.set(generateCustomerCacheKey(distinctId), customer, {
      ttl: 1000 * 60 * 60 * 24 * 2, // 2 days
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  const resetCache = (distinctId: string) =>
    cacheManager.delete(generateCustomerCacheKey(distinctId));

  const getCustomerFromServerAndCache = (distinctId: string) =>
    Effect.gen(function* getCustomerFromServerAndCache() {
      const commonHeaders = yield* getCommonSdkHeaders();
      const result = yield* apiClient.sdk.getCustomer({
        headers: {
          ...commonHeaders,
          "x-distinct-id": distinctId,
        },
      });
      yield* cache(distinctId, result);
      return result;
    });

  const getCustomer = (
    distinctId: string,
    cachePolicy: "cache" | "fetch" | "fetch-while-stale"
  ) =>
    Effect.gen(function* getCustomer() {
      if (cachePolicy === "cache") {
        const customerFromCache = yield* getCustomerFromCache(distinctId);
        return customerFromCache?.value ?? null;
      }

      if (cachePolicy === "fetch") {
        return yield* getCustomerFromServerAndCache(distinctId);
      }

      // fetch-while-stale policy
      const customerFromCache = yield* getCustomerFromCache(distinctId);
      if (
        customerFromCache &&
        !customerFromCache.isStale &&
        !customerFromCache.isExpired &&
        customerFromCache.value
      ) {
        return customerFromCache.value;
      }

      return yield* getCustomerFromServerAndCache(distinctId);
    });

  return {
    cache,
    getCustomer,
    getCustomerFromCache,
    resetCache,
  } as const;
});

export class CustomerInfoManager extends ServiceMap.Service<CustomerInfoManager, Effect.Success<typeof make>>()("rn-voidhash/CustomerInfoManager") {
  static Default = Layer.effect(CustomerInfoManager, make).pipe(
    Layer.provide(CacheManager.Default)
  )
}
