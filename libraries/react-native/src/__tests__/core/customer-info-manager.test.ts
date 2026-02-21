import { Effect } from "effect";

import { CacheManager } from "../../core/caching/cache-manager";
import { CustomerInfoManager } from "../../core/identity/customer-info-manager";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
  createSdkCustomer,
} from "../helpers/effect-test-harness";

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
        Effect.flatMap(CustomerInfoManager, (manager) =>
          manager.cache("cached-user", customer)
        )
      );

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
          manager.getCustomer("cached-user", "cache")
        )
      );

      expect(result).toEqual(customer);
      expect(apiDouble.state.getCustomerCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("fetch policy always requests API, updates cache and emits event", async () => {
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

    const fetchedEvents: string[] = [];
    const remove = harness.eventBus.on("customer-fetched", (customer) => {
      fetchedEvents.push(customer.appUserId);
    });

    try {
      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
          manager.getCustomer("fetched-user", "fetch")
        )
      );
      const cached = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
          manager.getCustomerFromCache("fetched-user")
        )
      );

      expect(result.appUserId).toBe("fetched-user");
      expect(apiDouble.state.getCustomerCalls).toHaveLength(1);
      expect(cached?.value.appUserId).toBe("fetched-user");
      expect(fetchedEvents).toEqual(["fetched-user"]);
    } finally {
      remove();
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
        Effect.flatMap(CustomerInfoManager, (manager) => manager.cache("fresh-user", customer))
      );

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
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
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("customer:stale-user", staleCustomer, {
            staleTime: 1,
            ttl: 1000,
          })
        )
      );
      await wait(5);

      const result = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
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
