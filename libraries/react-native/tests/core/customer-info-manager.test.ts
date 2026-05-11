import { Effect } from "effect";

import { CacheManager } from "../../src/core/caching/cache-manager";
import { CustomerInfoManager } from "../../src/core/identity/customer-info-manager";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
  createSdkCustomer,
} from "../helpers/effect-test-harness";
import { describe, expect, it } from "../helpers/effect-vitest";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("CustomerInfoManager", () => {
  it("returns cached customer for cache policy without API call", async () => {
    const customer = createSdkCustomer("cached-user");
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.cache("cached-user", customer)
        )
      );

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.getCustomer("cached-user", "cache")
        )
      );

      expect(result).toEqual(customer);
      expect(apiDouble.state.getCustomerCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("fetch policy always requests API and updates cache", async () => {
    const apiDouble = createApiClientDouble({
      getCustomerResult: createSdkCustomer("fetched-user"),
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.getCustomer("fetched-user", "fetch")
        )
      );
      const cached = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.getCustomerFromCache("fetched-user")
        )
      );

      if (result === null) {
        throw new Error("Expected fetched customer");
      }

      expect(result.distinctId).toBe("fetched-user");
      expect(apiDouble.state.getCustomerCalls).toHaveLength(1);
      expect(cached?.value.distinctId).toBe("fetched-user");
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("fetch-while-stale returns fresh cache without API call", async () => {
    const customer = createSdkCustomer("fresh-user");
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) => manager.cache("fresh-user", customer))
      );

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.getCustomer("fresh-user", "fetch-while-stale")
        )
      );

      expect(result).toEqual(customer);
      expect(apiDouble.state.getCustomerCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("fetch-while-stale fetches from API when cache is stale", async () => {
    const staleCustomer = createSdkCustomer("stale-user");
    const fetchedCustomer = createSdkCustomer("fetched-stale-user");
    const apiDouble = createApiClientDouble({
      getCustomerResult: fetchedCustomer,
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager.asEffect(), (manager) =>
          manager.set("customer:stale-user", staleCustomer, {
            staleTime: 1,
            ttl: 1000,
          })
        )
      );
      await wait(5);

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager.asEffect(), (manager) =>
          manager.getCustomer("stale-user", "fetch-while-stale")
        )
      );

      expect(apiDouble.state.getCustomerCalls).toHaveLength(1);
      expect(result).toEqual(fetchedCustomer);
    } finally {
      await harness.runtime.dispose();
    }
  });
});
