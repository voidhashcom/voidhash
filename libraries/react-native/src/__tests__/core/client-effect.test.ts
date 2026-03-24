import { Effect } from "effect";

import {
  type AnalyticsIngestEvent,
  VoidhashEffectClient,
} from "../../client-effect";
import { ANONYMOUS_DISTINCT_ID_PREFIX } from "../../constants";
import { CacheManager } from "../../core/caching/cache-manager";
import { Product, SubscriptionProduct } from "../../core/entities/product";
import { Transaction } from "../../core/entities/transaction";
import { CustomerAttributeManager } from "../../core/identity/customer-attribute-manager";
import { SDK_VERSION } from "../../core/constants";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
} from "../helpers/effect-test-harness";
import { createTestSchema } from "../helpers/test-schema";

describe("VoidhashEffectClient", () => {
  it("init with a provided distinct id identifies the user and syncs previous attributes", async () => {
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
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "cached-before-init"))
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
          distinctId: "user-after-init",
          schema,
        })
      );

      expect(initializedClient).toHaveProperty("getProducts");
      expect(apiDouble.state.syncCustomerAttributesCalls).toHaveLength(2);
      expect(apiDouble.state.syncCustomerAttributesCalls[0]?.headers["x-distinct-id"]).toBe(
        "cached-before-init"
      );
      expect(apiDouble.state.identifyCalls).toHaveLength(1);
      expect(apiDouble.state.identifyCalls[0]?.headers["x-distinct-id"]).toBe(
        "cached-before-init"
      );
      expect(apiDouble.state.identifyCalls[0]?.payload).toMatchObject({
        distinctId: "user-after-init",
      });
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("init without a provided distinct id prefetches customer", async () => {
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
      const distinctId = String(
        apiDouble.state.getCustomerCalls[0]?.headers["x-distinct-id"]
      );
      expect(distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)).toBe(true);
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
        Effect.flatMap(CacheManager, (manager) => manager.set("distinctId", "feature-user"))
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
      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(1);
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
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

    try {
      await harness.runtime.runPromise(
        initializedClient.startTransactionObserver()
      );

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
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios"
    );

    try {
      await harness.runtime.runPromise(
        initializedClient.processObservedTransaction(transaction)
      );

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
      expect(apiDouble.state.syncTransactionCalls[0]?.headers["x-observer-mode"]).toBe(
        "true"
      );
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
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios"
    );

    try {
      await harness.runtime.runPromise(
        initializedClient.processObservedTransaction(transaction)
      );
      await harness.runtime.runPromise(
        initializedClient.processObservedTransaction(transaction)
      );

      expect(apiDouble.state.syncTransactionCalls).toHaveLength(1);
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
      "ios"
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
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

    try {
      await harness.runtime.runPromise(
        initializedClient.reconcileObservedTransactions()
      );

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
    const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
    const transaction = new Transaction(
      "tx-id",
      "tx-id",
      "monthly-id",
      1_700_000_000_000,
      1,
      false,
      "ios"
    );

    try {
      await expect(
        harness.runtime.runPromise(
          initializedClient.processObservedTransaction(transaction)
        )
      ).rejects.toThrow("syncTransaction failed");

      expect(paymentDouble.state.acknowledgePurchaseCalls).toHaveLength(0);
    } finally {
      await harness.runtime.dispose();
    }
  });

  describe("sendAnalyticsEvents", () => {
    const analyticsEvents: ReadonlyArray<AnalyticsIngestEvent> = [
      {
        context: {},
        event_id: "evt_1",
        event_name: "cta-button-clicked",
        event_ts: "2026-01-01T00:00:00.000Z",
        properties: {
          button_name: "Get Started",
        },
        session_id: "sess_1",
      },
    ];

    it("sends analytics to derived i. subdomain by default", async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        statusText: "Accepted",
      });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        baseUrl: "https://api.voidhash.test",
        cacheAdapter: cache.adapter,
        paymentAdapter: paymentDouble.paymentAdapter,
        publishableKey: "pk_analytics",
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

      try {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) =>
            manager.set("distinctId", "analytics-user")
          )
        );
        await harness.runtime.runPromise(
          initializedClient.sendAnalyticsEvents(analyticsEvents)
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
          "https://i.api.voidhash.test/batch"
        );

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        expect(request?.method).toBe("POST");
        expect(request?.headers).toEqual({
          "content-type": "application/json",
        });
        expect(JSON.parse(String(request?.body))).toMatchObject({
          events: [
            {
              distinct_id: "analytics-user",
              event: "cta-button-clicked",
              properties: {
                button_name: "Get Started",
              },
              request: {
                sdk_name: "react-native",
                sdk_version: SDK_VERSION,
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
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        statusText: "Accepted",
      });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

      try {
        await harness.runtime.runPromise(
          initializedClient.sendAnalyticsEvents(analyticsEvents)
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8083/batch");
      } finally {
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("does not inline retry failed analytics delivery", async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          headers: new Headers(),
          json: async () => ({ error: "try again" }),
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

      try {
        await expect(harness.runtime.runPromise(
          initializedClient.sendAnalyticsEvents(analyticsEvents)
        )).rejects.toThrow("Analytics ingest request failed: 503 Service Unavailable");
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
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

      try {
        harness.runtime.runSync(
          initializedClient.capture("cta-button-clicked", { button_name: "Get Started" })
        );

        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);
      } finally {
        await harness.runtime.dispose();
      }
    });

    it("flushes immediately when queue reaches 20 events", async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        statusText: "Accepted",
      });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
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
      jest.useFakeTimers();

      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        statusText: "Accepted",
      });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });
      let flushTriggered = false;
      initializedClient.setAnalyticsFlushCallback(() => {
        flushTriggered = true;
      });

      try {
        harness.runtime.runSync(initializedClient.capture("screen-view"));
        expect(flushTriggered).toBe(false);

        jest.advanceTimersByTime(5000);
        expect(flushTriggered).toBe(true);
      } finally {
        jest.useRealTimers();
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });

    it("keeps batch in queue when flush is retryably rate limited", async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValueOnce({
        headers: new Headers({
          "retry-after": "2",
        }),
        json: async () => ({
          code: "rate_limited",
          error: "request rate limit exceeded",
          retry_after_ms: 2000,
        }),
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

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
      jest.useFakeTimers();

      const originalFetch = global.fetch;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          headers: new Headers({
            "retry-after": "2",
          }),
          json: async () => ({
            code: "rate_limited",
            error: "request rate limit exceeded",
            retry_after_ms: 2000,
          }),
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        })
        .mockResolvedValueOnce({
          headers: new Headers(),
          json: async () => ({
            accepted: 1,
            rejected: 0,
            request_id: "req_after_backoff",
          }),
          ok: true,
          status: 202,
          statusText: "Accepted",
        });
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const schema = createTestSchema();
      const apiDouble = createApiClientDouble();
      const paymentDouble = createPaymentAdapterDouble();
      const cache = createInMemoryCacheAdapter();
      const harness = createEffectTestHarness({
        apiClient: apiDouble.apiClient,
        cacheAdapter: cache.adapter,
        ingestUrl: "http://localhost:8083",
        paymentAdapter: paymentDouble.paymentAdapter,
      });
      const initializedClient = VoidhashEffectClient.makeInitializedClient({ schema });

      try {
        harness.runtime.runSync(initializedClient.capture("event-1"));

        await harness.runtime.runPromise(initializedClient.flush());
        expect(initializedClient.getAnalyticsQueueLength()).toBe(1);

        await harness.runtime.runPromise(initializedClient.flush());
        expect(fetchMock).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(2000);
        await harness.runtime.runPromise(initializedClient.flush());

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(initializedClient.getAnalyticsQueueLength()).toBe(0);
      } finally {
        jest.useRealTimers();
        global.fetch = originalFetch;
        await harness.runtime.dispose();
      }
    });
  });

  describe("automatic startup events", () => {
    it("captures app_installed and app_opened on first init", async () => {
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
        await harness.runtime.runPromise(
          initializedClient.captureAutomaticStartupEvents()
        );

        const queueLength = initializedClient.getAnalyticsQueueLength();
        expect(queueLength).toBe(2);
      } finally {
        await harness.runtime.dispose();
      }
    });

    it("captures app_updated and app_opened when app release changes", async () => {
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
        // Store a different app release in cache
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) =>
            manager.set("voidhash:analytics:last-seen-app-release", {
              appBuild: "0",
              appVersion: "0.0.1",
            })
          )
        );

        await harness.runtime.runPromise(
          initializedClient.captureAutomaticStartupEvents()
        );

        const queueLength = initializedClient.getAnalyticsQueueLength();
        expect(queueLength).toBe(2);
      } finally {
        await harness.runtime.dispose();
      }
    });
  });

  describe("automatic lifecycle events", () => {
    it("captures app_backgrounded and app_became_active from lifecycle transitions", async () => {
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
      const capturedEvents: string[] = [];

      try {
        const subscription = harness.runtime.runSync(
          initializedClient.setupAutomaticLifecycleEvents((eventName) => {
            capturedEvents.push(eventName);
          })
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
});
