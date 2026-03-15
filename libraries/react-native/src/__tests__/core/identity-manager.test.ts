import { Effect } from "effect";

import { ANONYMOUS_DISTINCT_ID_PREFIX } from "../../constants";
import { CacheManager } from "../../core/caching/cache-manager";
import { CustomerAttributeManager } from "../../core/identity/customer-attribute-manager";
import { CustomerInfoManager } from "../../core/identity/customer-info-manager";
import { IdentityManager } from "../../core/identity/identity-manager";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
} from "../helpers/effect-test-harness";

describe("IdentityManager", () => {
  it("uses the cached distinct id when present", async () => {
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
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "cached-user"))
      );

      const distinctId = await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.getDistinctId())
      );

      expect(distinctId).toBe("cached-user");
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("generates and persists an anonymous distinct id when the cache is empty", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      const distinctId = await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.getDistinctId())
      );
      const cached = await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.getDistinctIdFromCache())
      );

      expect(distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)).toBe(true);
      expect(cached).toBe(distinctId);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("identify syncs previous traits, updates cache and emits events", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    const identifiedEvents: string[] = [];
    const fetchedEvents: string[] = [];

    const removeIdentified = harness.eventBus.on("customer-identified", () => {
      identifiedEvents.push("customer-identified");
    });
    const removeFetched = harness.eventBus.on("customer-fetched", (customer) => {
      fetchedEvents.push(customer.distinctId);
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          Effect.all([
            manager.set("distinctId", "old-user"),
            manager.set("customer-attributes:old-user", {
              email: "old@voidhash.test",
              name: "Old User",
            }),
          ])
        )
      );

      await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) =>
          manager.identify("new-user", {
            email: "new@voidhash.test",
            name: "New User",
          })
        )
      );

      const cachedDistinctId = await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.getDistinctIdFromCache())
      );
      const cachedCustomer = await harness.runtime.runPromise(
        Effect.flatMap(CustomerInfoManager, (manager) =>
          manager.getCustomerFromCache("new-user")
        )
      );

      expect(apiDouble.state.syncCustomerAttributesCalls).toHaveLength(1);
      expect(apiDouble.state.syncCustomerAttributesCalls[0]?.headers["x-distinct-id"]).toBe(
        "old-user"
      );

      expect(apiDouble.state.identifyCalls).toHaveLength(1);
      expect(apiDouble.state.identifyCalls[0]?.payload).toMatchObject({
        distinctId: "new-user",
        email: "new@voidhash.test",
        name: "New User",
      });
      expect(apiDouble.state.identifyCalls[0]?.headers["x-distinct-id"]).toBe("old-user");

      expect(cachedDistinctId).toBe("new-user");
      expect(cachedCustomer?.value.distinctId).toBe("new-user");
      expect(identifiedEvents).toEqual(["customer-identified"]);
      expect(fetchedEvents).toEqual(["new-user"]);
    } finally {
      removeIdentified();
      removeFetched();
      await harness.runtime.dispose();
    }
  });

  it("reset syncs attributes, clears cache and emits signed out event", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    const signOutEvents: string[] = [];
    const remove = harness.eventBus.on("customer-signed-out", () => {
      signOutEvents.push("customer-signed-out");
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          Effect.all([
            manager.set("distinctId", "signed-in-user"),
            manager.set("customer:some-user", { id: "some-user" }),
          ])
        )
      );
      await harness.runtime.runPromise(
        Effect.flatMap(CustomerAttributeManager, (manager) =>
          manager.setCustomerAttributes("signed-in-user", {
            email: "signed@voidhash.test",
            name: "Signed User",
          })
        )
      );

      await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.reset())
      );

      const distinctIdFromCache = await harness.runtime.runPromise(
        Effect.flatMap(IdentityManager, (manager) => manager.getDistinctIdFromCache())
      );
      const cacheKeys = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.getCacheKeys())
      );

      expect(apiDouble.state.syncCustomerAttributesCalls).toHaveLength(1);
      expect(apiDouble.state.syncCustomerAttributesCalls[0]?.headers["x-distinct-id"]).toBe(
        "signed-in-user"
      );
      expect(distinctIdFromCache).toBeNull();
      expect(cacheKeys).toEqual([]);
      expect(signOutEvents).toEqual(["customer-signed-out"]);
    } finally {
      remove();
      await harness.runtime.dispose();
    }
  });
});
