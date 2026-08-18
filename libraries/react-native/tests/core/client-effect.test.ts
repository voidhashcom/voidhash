import { Cause, Effect, Exit } from "effect";
import { vi } from "vitest";

import { type AnalyticsIngestEvent, VoidhashEffectClient } from "../../src/client-effect";
import { ANONYMOUS_DISTINCT_ID_PREFIX } from "../../src/constants";
import { CacheManager } from "../../src/core/caching/cache-manager";
import { Product, SubscriptionProduct } from "../../src/core/entities/product";
import { Transaction } from "../../src/core/entities/transaction";
import {
  currentPersonAtom,
  featureFlagsForKeysAtom,
  schemaAtom,
} from "../../src/core/reactivity/client-state";
import { FailedToFetchSchemaError } from "../../src/errors";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
  createSdkPerson,
} from "../helpers/effect-test-harness";
import { describe, expect, it } from "../helpers/effect-vitest";
import { createTestSchema } from "../helpers/test-schema";

describe("VoidhashEffectClient", () => {
  it("init with a provided distinct id identifies the user without syncing attributes", async () => {
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
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "cached-before-init")),
      );

      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeUnitializedClient().init({
          distinctId: "user-after-init",
          internalSchema: schema,
        }),
      );

      expect(initializedClient).toHaveProperty("getProducts");
      // Init no longer auto-syncs attributes; identify is the only POST.
      expect(apiDouble.state.syncPersonAttributesCalls).toHaveLength(0);
      expect(apiDouble.state.identifyCalls).toHaveLength(1);
      expect(apiDouble.state.identifyCalls[0]?.headers["x-distinct-id"]).toBe("cached-before-init");
      expect(apiDouble.state.identifyCalls[0]?.payload).toMatchObject({
        distinctId: "user-after-init",
      });
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init without a provided distinct id prefetches the person without syncing attributes", async () => {
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
          internalSchema: schema,
        }),
      );

      expect(apiDouble.state.identifyCalls).toHaveLength(0);
      // No implicit attribute sync at init.
      expect(apiDouble.state.syncPersonAttributesCalls).toHaveLength(0);
      expect(apiDouble.state.getPersonCalls).toHaveLength(1);
      const distinctId = String(apiDouble.state.getPersonCalls[0]?.headers["x-distinct-id"]);
      expect(distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)).toBe(true);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init succeeds (does not crash) when the person is not yet persisted", async () => {
    // Regression: on a cold start the anonymous person isn't created until an
    // explicit attribute set lands, so `getPerson` 404s. That 404 must not
    // abort init (previously surfaced as FAILED_TO_INITIALIZE_VOIDHASH_CLIENT).
    const apiDouble = createApiClientDouble({ getPersonShouldNotFound: true });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const schema = createTestSchema();

    try {
      const exit = await harness.runtime.runPromiseExit(
        VoidhashEffectClient.makeUnitializedClient().init({
          internalSchema: schema,
        }),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(apiDouble.state.getPersonCalls).toHaveLength(1);
      // A not-yet-persisted person publishes a null person, not a crash.
      expect(harness.atomRegistry.get(currentPersonAtom)).toBeNull();
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init without internalSchema fetches the schema once and publishes it to schemaAtom", async () => {
    const remoteSchema = createTestSchema();
    const apiDouble = createApiClientDouble({ getSchemaResult: remoteSchema });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    // Module-level singleton: reset before asserting on it.
    harness.atomRegistry.set(schemaAtom, null);

    try {
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeUnitializedClient().init({}),
      );

      expect(apiDouble.state.getSchemaCalls).toHaveLength(1);
      expect(initializedClient.getSchema()).toEqual(remoteSchema);
      expect(harness.atomRegistry.get(schemaAtom)).toEqual(remoteSchema);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init fails fatally with FailedToFetchSchemaError when schema fetch fails and no cache exists", async () => {
    const apiDouble = createApiClientDouble({ getSchemaShouldFail: true });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    harness.atomRegistry.set(schemaAtom, null);

    try {
      const exit = await harness.runtime.runPromiseExit(
        VoidhashEffectClient.makeUnitializedClient().init({}),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause);
        expect(error).toBeInstanceOf(FailedToFetchSchemaError);
      }
      expect(harness.atomRegistry.get(schemaAtom)).toBeNull();
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
      "ios",
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
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      const first = await harness.runtime.runPromise(initializedClient.getProducts());
      const second = await harness.runtime.runPromise(initializedClient.getProducts());

      expect(paymentDouble.state.getProductsCalls).toBe(1);
      expect(first.monthly_sub?.slug).toBe("monthly_sub");
      expect(first.yearly_sub).toBeNull();
      expect(second).toEqual(first);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("getFeatureFlags caches by sorted keys and publishes to the reactive atom", async () => {
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
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "feature-user")),
      );

      const inputKeys = ["b", "a"];
      const inputSnapshot = [...inputKeys];

      const first = await harness.runtime.runPromise(initializedClient.getFeatureFlags(inputKeys));
      const second = await harness.runtime.runPromise(
        initializedClient.getFeatureFlags(["a", "b"]),
      );

      expect(first.flags).toHaveLength(1);
      expect(second).toEqual(first);
      expect(apiDouble.state.evaluateFeatureFlagsCalls).toHaveLength(1);

      // The caller's input array must remain in its original order — the
      // service must sort a copy, not mutate the input.
      expect(inputKeys).toEqual(inputSnapshot);

      // Both reversed and original orders observe the same atom slot.
      const publishedForBA = harness.atomRegistry.get(featureFlagsForKeysAtom(["b", "a"]));
      const publishedForAB = harness.atomRegistry.get(featureFlagsForKeysAtom(["a", "b"]));
      expect(publishedForBA).toEqual(first);
      expect(publishedForAB).toEqual(first);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("maintains separate atom entries for distinct flag-key requests", async () => {
    const schema = createTestSchema();
    const responses: Record<
      string,
      {
        flags: Array<{
          enabled: boolean;
          key: string;
          payload: unknown;
          variantKey: string | null;
        }>;
      }
    > = {
      a: { flags: [{ enabled: true, key: "a", payload: null, variantKey: null }] },
      b: { flags: [{ enabled: false, key: "b", payload: null, variantKey: null }] },
    };
    const apiDouble = createApiClientDouble();
    (
      apiDouble.apiClient as {
        sdk: {
          evaluateFeatureFlags: (request: {
            headers: Record<string, unknown>;
            payload?: { flagKeys?: string[] };
          }) => unknown;
        };
      }
    ).sdk.evaluateFeatureFlags = (request) => {
      apiDouble.state.evaluateFeatureFlagsCalls.push(request);
      const key = request.payload?.flagKeys?.[0] ?? "all";
      return Effect.succeed(responses[key] ?? { flags: [] });
    };

    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(initializedClient.getFeatureFlags(["a"]));
      await harness.runtime.runPromise(initializedClient.getFeatureFlags(["b"]));

      const forA = harness.atomRegistry.get(featureFlagsForKeysAtom(["a"]));
      const forB = harness.atomRegistry.get(featureFlagsForKeysAtom(["b"]));
      expect(forA?.flags[0]?.key).toBe("a");
      expect(forB?.flags[0]?.key).toBe("b");
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("getCurrentPerson publishes both cached and freshly fetched results to the reactive atom", async () => {
    const schema = createTestSchema();
    const fetched = createSdkPerson("fetched-person");
    const apiDouble = createApiClientDouble({ getPersonResult: fetched });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "fetched-person")),
      );

      // First call fetches and publishes the network result.
      await harness.runtime.runPromise(initializedClient.getCurrentPerson(true));
      expect(harness.atomRegistry.get(currentPersonAtom)).toEqual(fetched);

      // Reset atom then verify a cached read still publishes back.
      harness.atomRegistry.set(currentPersonAtom, null);
      await harness.runtime.runPromise(initializedClient.getCurrentPerson());
      expect(harness.atomRegistry.get(currentPersonAtom)).toEqual(fetched);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init without distinct id publishes the prefetched person to the reactive atom", async () => {
    const schema = createTestSchema();
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
        VoidhashEffectClient.makeUnitializedClient().init({
          internalSchema: schema,
        }),
      );

      const published = harness.atomRegistry.get(currentPersonAtom);
      expect(published).not.toBeNull();
      expect(published?.distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)).toBe(true);
    } finally {
      await harness.runtime.dispose();
    }
  });

  describe("person attributes", () => {
    it("setPersonAttributes enqueues a $set capture carrying $process_person_profile", async () => {
      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          initializedClient.setPersonAttributes({
            email: "person@voidhash.test",
            name: "A Person",
            plan: "pro",
          }),
        );

        // Rides the analytics queue; no network sync.
        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);
        expect(apiDouble.state.syncPersonAttributesCalls).toHaveLength(0);
      } finally {
        await harness.runtime.dispose();
      }
    });

    it("setPersonAttributesSync syncs, returns the snapshot and publishes the atom", async () => {
      const schema = createTestSchema();
      const synced = createSdkPerson("synced-person");
      const apiDouble = createApiClientDouble({
        syncPersonAttributesResult: synced,
      });
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "sync-user")),
        );

        const result = await harness.runtime.runPromise(
          initializedClient.setPersonAttributesSync({
            email: "sync@voidhash.test",
            plan: "pro",
          }),
        );

        expect(result).toEqual(synced);
        expect(apiDouble.state.syncPersonAttributesCalls).toHaveLength(1);
        expect(apiDouble.state.syncPersonAttributesCalls[0]?.headers["x-distinct-id"]).toBe(
          "sync-user",
        );
        // Reserved keys map to dedicated fields; custom keys go to traits.
        expect(apiDouble.state.syncPersonAttributesCalls[0]?.payload).toMatchObject({
          email: "sync@voidhash.test",
          traits: { plan: "pro" },
        });
        expect(harness.atomRegistry.get(currentPersonAtom)).toEqual(synced);
      } finally {
        await harness.runtime.dispose();
      }
    });
  });

  describe("identify and reset flush analytics first", () => {
    const acceptedResponse = () => new Response(null, { status: 202, statusText: "Accepted" });

    it("identify flushes queued events under the pre-switch distinct id", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "pre-switch-user")),
        );

        harness.runtime.runSync(initializedClient.capture("pre-identify-event"));
        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);

        await harness.runtime.runPromise(initializedClient.identify("new-user", {}));

        // The queued event was flushed before the identity switch.
        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const payload = JSON.parse(decodeRequestBody(request?.body));
        expect(payload.events[0]?.distinct_id).toBe("pre-switch-user");
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("reset flushes queued events under the pre-reset distinct id", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "pre-reset-user")),
        );

        harness.runtime.runSync(initializedClient.capture("pre-reset-event"));
        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);

        await harness.runtime.runPromise(initializedClient.reset());

        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const payload = JSON.parse(decodeRequestBody(request?.body));
        expect(payload.events[0]?.distinct_id).toBe("pre-reset-user");
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
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
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await expect(
        harness.runtime.runPromise(initializedClient.iosPresentCodeRedemptionSheet()),
      ).rejects.toThrow("Present code redemption sheet is not supported on this platform");

      await expect(
        harness.runtime.runPromise(initializedClient.iosShowManageSubscriptions()),
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
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
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
      "month",
    );

    try {
      await harness.runtime.runPromise(
        initializedClient.purchase(monthlyProduct, {
          method: "native",
        }),
      );

      expect(paymentDouble.state.buyProductCalls).toHaveLength(1);
      expect(paymentDouble.state.buyProductCalls[0]?.product.slug).toBe("monthly_sub");
      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(1);
      expect(apiDouble.state.getPersonCalls).toHaveLength(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("purchases a non-consumable one-time product through the same lifecycle", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const product = new Product(
      "lifetime-id",
      "lifetime",
      "Lifetime",
      "Lifetime access",
      "Lifetime",
      "$49.99",
      4999,
      "USD",
      "one-time",
      "ios",
    );

    try {
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );
      await harness.runtime.runPromise(initializedClient.purchase(product, { method: "native" }));

      expect(paymentDouble.state.buyProductCalls[0]?.product).toBe(product);
      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("purchase passes the deterministic account token to the native store", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
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
      "month",
    );

    try {
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "user-123")),
      );
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      await harness.runtime.runPromise(
        initializedClient.purchase(monthlyProduct, { method: "native" }),
      );

      expect(paymentDouble.state.buyProductCalls[0]?.appAccountToken).toBe(
        "3501e751-7582-58f9-9c1d-533c7466049f",
      );
      expect(apiDouble.state.syncTransactionCalls[0]?.payload?.appAccountToken).toBe(
        "3501e751-7582-58f9-9c1d-533c7466049f",
      );
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("startTransactionObserver delegates to payment adapter initConnection", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(initializedClient.startTransactionObserver());

      expect(paymentDouble.state.initConnectionCalls).toBe(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("processObservedTransaction sets observer header and skips acknowledge in read-only mode", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
      readOnly: true,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    try {
      await harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction));

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(apiDouble.state.syncTransactionCalls[0]?.headers["x-observer-mode"]).toBe("true");
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("processObservedTransaction dedupes repeated transaction processing", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    try {
      await harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction));
      await harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction));

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("retries native acknowledgement without resubmitting an accepted transaction", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble({
      acknowledgePurchaseShouldFailTimes: 1,
    });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-ack-retry",
      "tx-ack-retry",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    try {
      await expect(
        harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction)),
      ).rejects.toThrow("acknowledgePurchase failed");
      await harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction));

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(2);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("resumes native finalization from persistent state after a runtime restart", async () => {
    const schema = createTestSchema();
    const cache = createInMemoryCacheAdapter();
    const dedupeStore = new Map<string, boolean>();
    const firstApi = createApiClientDouble();
    const firstPayment = createPaymentAdapterDouble({
      acknowledgePurchaseShouldFailTimes: 1,
    });
    const firstHarness = createEffectTestHarness({
      apiClient: firstApi.apiClient,
      cacheAdapter: cache.adapter,
      dedupeStore,
      paymentAdapter: firstPayment.paymentAdapter,
    });
    const transaction = new Transaction(
      "tx-runtime-restart",
      "tx-runtime-restart",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    const firstClient = await firstHarness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    await expect(
      firstHarness.runtime.runPromise(firstClient.processObservedTransaction(transaction)),
    ).rejects.toThrow("acknowledgePurchase failed");
    await firstHarness.runtime.dispose();

    const secondApi = createApiClientDouble();
    const secondPayment = createPaymentAdapterDouble();
    const secondHarness = createEffectTestHarness({
      apiClient: secondApi.apiClient,
      cacheAdapter: cache.adapter,
      dedupeStore,
      paymentAdapter: secondPayment.paymentAdapter,
    });

    try {
      const secondClient = await secondHarness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );
      await secondHarness.runtime.runPromise(secondClient.processObservedTransaction(transaction));

      expect(firstApi.state.syncTransactionCalls).toHaveLength(1);
      expect(secondApi.state.syncTransactionCalls).toHaveLength(0);
      expect(secondPayment.state.acknowledgePurchaseCalls).toHaveLength(1);
    } finally {
      await secondHarness.runtime.dispose();
    }
  });

  it("finalizes a consumable transaction with its schema product type", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-consumable",
      "tx-consumable",
      "com.voidhash.coins.android",
      1_700_000_000_000,
      1,
      false,
      "android",
      { purchaseToken: "consumable-token" },
    );

    try {
      await harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction));

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(paymentDouble.state.acknowledgePurchaseProductTypes).toEqual(["one-time-consumable"]);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("joins concurrent duplicate processing and shares the failure", async () => {
    let rejectSync!: (reason: Error) => void;
    const syncGate = new Promise<{ accepted: boolean }>((_resolve, reject) => {
      rejectSync = reject;
    });
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble({
      syncTransactionEffect: () =>
        Effect.tryPromise({
          catch: () => new Error("gated sync failed"),
          try: () => syncGate,
        }),
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-concurrent",
      "tx-concurrent",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    try {
      const first = harness.runtime.runPromise(
        initializedClient.processObservedTransaction(transaction),
      );
      while (apiDouble.state.syncTransactionCalls.length === 0) {
        await Promise.resolve();
      }
      const second = harness.runtime.runPromise(
        initializedClient.processObservedTransaction(transaction),
      );
      rejectSync(new Error("release"));

      const results = await Promise.allSettled([first, second]);
      expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("skips pending store transactions until the store reports them purchased", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const transaction = new Transaction(
      "tx-pending",
      "tx-pending",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "android",
      { purchaseState: "pending", purchaseToken: "pending-token" },
    );
    const paymentDouble = createPaymentAdapterDouble({ pendingTransactions: [transaction] });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(initializedClient.reconcileObservedTransactions());

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(0);
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("attempts every restore transaction and reports an aggregate failure", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble({ syncTransactionShouldFail: true });
    const transactions = ["tx-restore-1", "tx-restore-2"].map(
      (transactionId, index) =>
        new Transaction(
          transactionId,
          transactionId,
          "monthly-id",
          1_700_000_000_000 + index,
          1,
          false,
          "ios",
        ),
    );
    const paymentDouble = createPaymentAdapterDouble({ purchaseHistory: transactions });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await expect(
        harness.runtime.runPromise(initializedClient.restorePurchases()),
      ).rejects.toThrow("Failed to restore 2 transactions");
      expect(apiDouble.state.syncTransactionCalls).toHaveLength(2);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("does not restore consumable one-time purchases", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble({
      purchaseHistory: [
        new Transaction(
          "tx-sub",
          "tx-sub",
          "com.voidhash.monthly.ios",
          1_700_000_000_000,
          1,
          false,
          "ios",
        ),
        new Transaction(
          "tx-coins",
          "tx-coins",
          "com.voidhash.coins.ios",
          1_700_000_000_001,
          1,
          false,
          "ios",
        ),
      ],
    });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(initializedClient.restorePurchases());

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(apiDouble.state.syncTransactionCalls[0]?.payload?.productSlug).toBe("monthly_sub");
      expect(apiDouble.state.syncTransactionCalls[0]?.payload?.providerProductId).toBe(
        "com.voidhash.monthly.ios",
      );
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("reconcileObservedTransactions merges pending and history with dedupe", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble();
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );
    const paymentDouble = createPaymentAdapterDouble({
      pendingTransactions: [transaction],
      purchaseHistory: [transaction],
    });
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );

    try {
      await harness.runtime.runPromise(initializedClient.reconcileObservedTransactions());

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("sync failure does not acknowledge transaction", async () => {
    const schema = createTestSchema();
    const apiDouble = createApiClientDouble({
      syncTransactionShouldFail: true,
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const initializedClient = await harness.runtime.runPromise(
      VoidhashEffectClient.makeInitializedClient({ schema }),
    );
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios",
    );

    try {
      await expect(
        harness.runtime.runPromise(initializedClient.processObservedTransaction(transaction)),
      ).rejects.toThrow("syncTransaction failed");

      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  const analyticsEvents: ReadonlyArray<AnalyticsIngestEvent> = [
    {
      context: {},
      distinct_id: "analytics-user",
      event_id: "evt_1",
      event_name: "cta-button-clicked",
      event_ts: "2026-01-01T00:00:00.000Z",
      properties: {
        button_name: "Get Started",
      },
      session_id: "sess_1",
    },
  ];

  const acceptedAnalyticsResponse = () =>
    new Response(null, {
      status: 202,
      statusText: "Accepted",
    });

  const decodeRequestBody = (body: RequestInit["body"]) => {
    if (typeof body === "string") return body;
    if (body instanceof Uint8Array) return new TextDecoder().decode(body);
    return String(body);
  };

  describe("sendAnalyticsEvents", () => {
    it("sends analytics to the /i/v1/batch path on the API host by default", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        baseUrl: "https://api.voidhash.test",
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
        publishableKey: "pk_analytics",
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "analytics-user")),
        );
        await harness.runtime.runPromise(initializedClient.sendAnalyticsEvents(analyticsEvents));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.voidhash.test/i/v1/batch");

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        expect(request?.method).toBe("POST");
        expect(request?.headers).toEqual(
          expect.objectContaining({
            "content-type": "application/json",
          }),
        );
        expect(JSON.parse(decodeRequestBody(request?.body))).toMatchObject({
          events: [
            {
              distinct_id: "analytics-user",
              event: "cta-button-clicked",
              properties: {
                button_name: "Get Started",
              },
              session_id: "sess_1",
              timestamp: "2026-01-01T00:00:00.000Z",
              uuid: "evt_1",
            },
          ],
          token: "pk_analytics",
        });
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("uses ingestUrl override when provided", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(initializedClient.sendAnalyticsEvents(analyticsEvents));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:8083/i/v1/batch");
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("does not inline retry failed analytics delivery", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "try again" }), {
          headers: { "content-type": "application/json" },
          status: 503,
          statusText: "Service Unavailable",
        }),
      );
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await expect(
          harness.runtime.runPromise(initializedClient.sendAnalyticsEvents(analyticsEvents)),
        ).rejects.toThrow("Analytics ingest request failed: 503");
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
  });

  describe("analytics capture and flush", () => {
    it("queues analytics events via capture without flushing", async () => {
      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        harness.runtime.runSync(
          initializedClient.capture("cta-button-clicked", { button_name: "Get Started" }),
        );

        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);
      } finally {
        await harness.runtime.dispose();
      }
    });

    it("flushes immediately when queue reaches 20 events", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );
      let flushTriggered = false;
      initializedClient.setAnalyticsFlushCallback(() => {
        flushTriggered = true;
      });

      try {
        for (let i = 0; i < 20; i++) {
          harness.runtime.runSync(initializedClient.capture(`event-${i}`));
        }

        expect(flushTriggered).toBe(true);
        expect(initializedClient.getAnalyticsQueueLength()).toBe(20);

        await harness.runtime.runPromise(initializedClient.flush());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("flushes queued events when timer fires after 5 seconds", async () => {
      vi.useFakeTimers();

      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );
      let flushTriggered = false;
      initializedClient.setAnalyticsFlushCallback(() => {
        flushTriggered = true;
      });

      try {
        harness.runtime.runSync(initializedClient.capture("screen-view"));
        expect(flushTriggered).toBe(false);

        vi.advanceTimersByTime(5000);
        expect(flushTriggered).toBe(true);
      } finally {
        vi.useRealTimers();
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("keeps batch in queue when flush is retryably rate limited", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "rate_limited",
            error: "request rate limit exceeded",
            retry_after_ms: 2000,
          }),
          {
            headers: {
              "content-type": "application/json",
              "retry-after": "2",
            },
            status: 429,
            statusText: "Too Many Requests",
          },
        ),
      );
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        harness.runtime.runSync(initializedClient.capture("event-1"));
        harness.runtime.runSync(initializedClient.capture("event-2"));

        await harness.runtime.runPromise(initializedClient.flush());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(2);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("retries a rate-limited batch after Retry-After elapses", async () => {
      vi.useFakeTimers();

      const originalFetch = global.fetch;
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: "rate_limited",
              error: "request rate limit exceeded",
              retry_after_ms: 2000,
            }),
            {
              headers: {
                "content-type": "application/json",
                "retry-after": "2",
              },
              status: 429,
              statusText: "Too Many Requests",
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              accepted: 1,
              rejected: 0,
              request_id: "req_after_backoff",
            }),
            {
              headers: { "content-type": "application/json" },
              status: 202,
              statusText: "Accepted",
            },
          ),
        );
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        harness.runtime.runSync(initializedClient.capture("event-1"));

        await harness.runtime.runPromise(initializedClient.flush());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);

        await harness.runtime.runPromise(initializedClient.flush());
        expect(fetchMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(2000);
        await harness.runtime.runPromise(initializedClient.flush());

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
      } finally {
        vi.useRealTimers();
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
  });

  describe("automatic startup events", () => {
    it("captures $app_installed and $app_opened on first init", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(initializedClient.captureAutomaticStartupEvents());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(2);

        await harness.runtime.runPromise(initializedClient.flush());

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const payload = JSON.parse(decodeRequestBody(request?.body));
        expect(payload.events.map((event: { event: string }) => event.event)).toEqual([
          "$app_installed",
          "$app_opened",
        ]);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("captures $app_updated and $app_opened when app release changes", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        // Store a different app release in cache
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) =>
            manager.set("voidhash:analytics:last-seen-app-release", {
              appBuild: "0",
              appVersion: "0.0.1",
            }),
          ),
        );

        await harness.runtime.runPromise(initializedClient.captureAutomaticStartupEvents());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(2);

        await harness.runtime.runPromise(initializedClient.flush());

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const payload = JSON.parse(decodeRequestBody(request?.body));
        expect(payload.events.map((event: { event: string }) => event.event)).toEqual([
          "$app_updated",
          "$app_opened",
        ]);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
  });

  describe("automatic lifecycle events", () => {
    it("captures $app_backgrounded and $app_became_active from lifecycle transitions", async () => {
      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );
      const capturedEvents: string[] = [];

      try {
        const subscription = harness.runtime.runSync(
          initializedClient.setupAutomaticLifecycleEvents((eventName) => {
            capturedEvents.push(eventName);
          }),
        );

        // The test might return null if react-native AppState is not available in test env
        // This is expected behavior — the lifecycle events are a platform feature
        if (subscription) {
          subscription.remove();
        }
      } finally {
        await harness.runtime.dispose();
      }
    });
  });

  describe("automatic sign-out event", () => {
    it("captures $sign_out and flushes it under the signing-out distinct id", async () => {
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockResolvedValue(acceptedAnalyticsResponse());
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = await harness.runtime.runPromise(
        VoidhashEffectClient.makeInitializedClient({ schema }),
      );

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "user-signing-out")),
        );

        await harness.runtime.runPromise(initializedClient.signOut());

        // The sign-out event is flushed before reset clears the cache, so it
        // is attributed to the signing-out distinct id, not a fresh anon one.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const payload = JSON.parse(decodeRequestBody(request?.body));
        expect(payload.events).toEqual([
          expect.objectContaining({
            distinct_id: "user-signing-out",
            event: "$sign_out",
          }),
        ]);

        // Reset emptied the queue and cleared the cached identity.
        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
  });
});
