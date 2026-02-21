import { Effect } from "effect";

import { VoidhashEffectClient } from "../../client-effect";
import { ANONYMOUS_USER_ID_PREFIX } from "../../constants";
import { CacheManager } from "../../core/caching/cache-manager";
import { Product, SubscriptionProduct } from "../../core/entities/product";
import { CustomerAttributeManager } from "../../core/identity/customer-attribute-manager";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
} from "../helpers/effect-test-harness";
import { createTestSchema } from "../helpers/test-schema";

describe("VoidhashEffectClient", () => {
  it("init with initial user id identifies user and syncs previous attributes", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const schema = createTestSchema();

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.set("appUserId", "cached-before-init"))
      );
      await harness.runtime.runPromise(
        Effect.flatMap(CustomerAttributeManager, (manager) =>
          manager.setCustomerAttributes("cached-before-init", {
            email: "before@voidhash.test",
            name: "Before",
          })
        )
      );

      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeUnitializedClient().init({
          initialAppUserId: "user-after-init",
          schema,
        })
      );

      expect(initializedClient).toHaveProperty("getProducts");
      expect(apiDouble.state.syncCustomerAttributesCalls).toHaveLength(2);
      expect(apiDouble.state.syncCustomerAttributesCalls[0]?.headers["x-app-user-id"]).toBe(
        "cached-before-init"
      );
      expect(apiDouble.state.identifyCalls).toHaveLength(1);
      expect(apiDouble.state.identifyCalls[0]?.headers["x-app-user-id"]).toBe(
        "cached-before-init"
      );
      expect(apiDouble.state.identifyCalls[0]?.payload).toMatchObject({
        appUserId: "user-after-init",
      });
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init without initial user id prefetches customer", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const schema = createTestSchema();

    try {
      await harness.runtime.runPromise(
        VoidhashEffectClient.makeUnitializedClient().init({
          schema,
        })
      );

      expect(apiDouble.state.identifyCalls).toHaveLength(0);
      expect(apiDouble.state.syncCustomerAttributesCalls).toHaveLength(1);
      expect(apiDouble.state.getCustomerCalls).toHaveLength(1);
      const appUserId = String(
        apiDouble.state.getCustomerCalls[0]?.headers["x-app-user-id"]
      );
      expect(appUserId.startsWith(ANONYMOUS_USER_ID_PREFIX)).toBe(true);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("getProducts caches native result and maps missing schema keys to null", async () => {
    const schema = createTestSchema();
    const monthlyProduct = new Product(
      "monthly-id",
      "monthly_sub",
      "Monthly",
      "Monthly plan",
      "Monthly",
      "$9.99",
      999,
      "USD",
      "subscription",
      "ios"
    );
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble({
      products: [monthlyProduct],
    });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

    try {
      const first = await harness.runtime.runPromise(initializedClient.getProducts());
      const second = await harness.runtime.runPromise(initializedClient.getProducts());

      expect(paymentDouble.state.getProductsCalls).toBe(1);
      expect(first.monthlySub?.slug).toBe("monthly_sub");
      expect(first.yearlySub).toBeNull();
      expect(second).toEqual(first);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("getFeatureFlags caches by sorted keys and emits event only for fetch", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble({
      evaluateFeatureFlagsResult: {
        flags: [
          {
            enabled: true,
            key: "flag-a",
            payload: { rollout: "all" },
            variantKey: "on",
          },
        ],
      },
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
    const events: string[] = [];
    const remove = harness.eventBus.on("feature-flags-fetched", () => {
      events.push("feature-flags-fetched");
    });

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.set("appUserId", "feature-user"))
      );

      const first = await harness.runtime.runPromise(
        initializedClient.getFeatureFlags(["b", "a"])
      );
      const second = await harness.runtime.runPromise(
        initializedClient.getFeatureFlags(["a", "b"])
      );

      expect(first.flags).toHaveLength(1);
      expect(second).toEqual(first);
      expect(apiDouble.state.evaluateFeatureFlagsCalls).toHaveLength(1);
      expect(events).toEqual(["feature-flags-fetched"]);
    } finally {
      remove();
      await harness.runtime.dispose();
    }
  });

  it("ios-only methods fail with UnsupportedPlatformError when adapter methods are absent", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

    try {
      await expect(
        harness.runtime.runPromise(initializedClient.iosPresentCodeRedemptionSheet())
      ).rejects.toThrow("Present code redemption sheet is not supported on this platform");

      await expect(
        harness.runtime.runPromise(initializedClient.iosShowManageSubscriptions())
      ).rejects.toThrow("Show manage subscriptions is not supported on this platform");
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("purchase delegates to payment adapter buyProduct", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
    const monthlyProduct = new SubscriptionProduct(
      "monthly-id",
      "monthly_sub",
      "Monthly",
      "Monthly plan",
      "Monthly",
      "$9.99",
      999,
      "USD",
      "subscription",
      "ios",
      "month"
    );

    try {
      await harness.runtime.runPromise(
        initializedClient.purchase<typeof schema>(monthlyProduct, {
          method: "native",
        })
      );

      expect(paymentDouble.state.buyProductCalls).toHaveLength(1);
      expect(paymentDouble.state.buyProductCalls[0]?.slug).toBe("monthly_sub");
    } finally {
      await harness.runtime.dispose();
    }
  });
});
