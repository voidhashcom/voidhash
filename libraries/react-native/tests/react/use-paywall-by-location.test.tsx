import { Deferred, Effect } from "effect";
import { vi } from "vitest";
// The real `@voidhash/paywalls` runtime encoder, used to prove the SDK handles
// the exact wire bytes a deployed bundle emits.
import { createEventEnvelope, serializeEnvelope } from "../../../paywalls/src/runtime/envelope";
import type { VoidhashClient } from "../../src/client";
import {
  __internal_handlePaywallBridgeEventForTests,
  __internal_resetPaywallByLocationCachesForTests,
  __internal_setResolvedPaywallForTests,
  __internal_showResolvedPaywallForTests,
} from "../../src/react/hooks/use-paywall-by-location";
import { beforeEach, describe, expect, it } from "../helpers/effect-vitest";

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn(),
  },
  Linking: {
    openURL: vi.fn().mockResolvedValue(undefined),
  },
  Platform: {
    OS: "ios",
  },
}));

vi.mock("../../src/nitro", () => ({
  PaywallPresenter: undefined,
}));

function createClientMock() {
  return {
    capture: vi.fn(),
    getProducts: vi.fn(),
    internal_buildPaywallRuntimeConfig: vi.fn(),
    purchase: vi.fn(),
    restorePurchases: vi.fn(),
  };
}

/**
 * The mock stays a plain bag of `vi.fn()`s so assertions read each spy as a
 * standalone value; the client shape is only asserted at the call boundary.
 */
const asClient = (mock: ReturnType<typeof createClientMock>) => mock as unknown as VoidhashClient;

function createPresenterMock() {
  return {
    dismiss: vi.fn().mockResolvedValue(undefined),
    postMessage: vi.fn(),
  };
}

const postedEnvelopes = (presenter: ReturnType<typeof createPresenterMock>) =>
  presenter.postMessage.mock.calls.map((call) => JSON.parse(call[1] as string));

describe("usePaywallByLocation bridge coordinator", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- vitest module-mock reset: `vi.clearAllMocks` plus the per-test default return values operate on hoisted `vi.mock` factories, which live outside any Effect scope; effect-bun-test scoped tests cannot reach them.
  beforeEach(() => {
    __internal_resetPaywallByLocationCachesForTests();
    vi.clearAllMocks();
  });

  it("handles purchase bridge action and dismisses on success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const openExternalUrl = vi.fn().mockResolvedValue(undefined);

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl,
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_purchase",
        type: "purchase",
        version: 1,
      }),
    });

    expect(client.purchase).toHaveBeenCalledWith(expect.objectContaining({ id: "prod_monthly" }), {
      method: "native",
    });
    expect(presenter.postMessage).toHaveBeenCalled();
    expect(postedEnvelopes(presenter).map((envelope) => envelope.payload.status)).toEqual([
      "purchasing",
      "purchased",
      "success",
    ]);
    expect(presenter.dismiss).toHaveBeenCalled();
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("invokes onPurchase callback on purchase success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onPurchase = vi.fn();
    const onError = vi.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
        onPurchase,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_purchase_callback",
        type: "purchase",
        version: 1,
      }),
    });

    expect(onPurchase).toHaveBeenCalledWith({
      productId: "prod_monthly",
      requestId: "req_purchase_callback",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("returns purchase error response and does not dismiss when purchase fails", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockRejectedValue(new Error("purchase failed") as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_purchase_error",
        type: "purchase",
        version: 1,
      }),
    });

    const envelopes = postedEnvelopes(presenter);
    const response = envelopes.find((envelope) => envelope.type === "response");
    expect(response.payload.status).toBe("error");
    expect(envelopes.map((envelope) => envelope.payload.status)).toEqual([
      "purchasing",
      "failed",
      "error",
    ]);
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("emits cancelled when the purchase adapter reports user cancellation", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockRejectedValue({
      _tag: "UserCancelledError",
      message: "Purchase cancelled",
    } as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: { productId: "prod_monthly" },
        requestId: "req_purchase_cancelled",
        type: "purchase",
        version: 1,
      }),
    });

    expect(postedEnvelopes(presenter).map((envelope) => envelope.payload.status)).toEqual([
      "purchasing",
      "cancelled",
      "error",
    ]);
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("invokes onError callback when purchase product cannot be resolved", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = vi.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_unknown",
        },
        requestId: "req_purchase_missing_product",
        type: "purchase",
        version: 1,
      }),
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      action: "purchase",
      requestId: "req_purchase_missing_product",
    });
    expect(client.purchase).not.toHaveBeenCalled();
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("handles restore bridge action and dismisses on success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    client.restorePurchases.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        requestId: "req_restore",
        type: "restore",
        version: 1,
      }),
    });

    expect(client.restorePurchases).toHaveBeenCalledTimes(1);
    expect(postedEnvelopes(presenter).map((envelope) => envelope.payload.status)).toEqual([
      "restoring",
      "restored",
      "success",
    ]);
    expect(presenter.dismiss).toHaveBeenCalledTimes(1);
  });

  it("invokes onRestore callback on restore success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onRestore = vi.fn();
    const onError = vi.fn();

    client.restorePurchases.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
        onRestore,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        requestId: "req_restore_callback",
        type: "restore",
        version: 1,
      }),
    });

    expect(onRestore).toHaveBeenCalledWith({
      requestId: "req_restore_callback",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("invokes onError callback when purchase fails", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = vi.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockRejectedValue(new Error("purchase failed") as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_purchase_error_callback",
        type: "purchase",
        version: 1,
      }),
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      action: "purchase",
      requestId: "req_purchase_error_callback",
    });
  });

  it("invokes onError callback when restore fails", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = vi.fn();

    client.restorePurchases.mockRejectedValue(new Error("restore failed") as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        requestId: "req_restore_error_callback",
        type: "restore",
        version: 1,
      }),
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      action: "restore",
      requestId: "req_restore_error_callback",
    });
  });

  it("handles openExternal and close actions", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const openExternalUrl = vi.fn().mockResolvedValue(undefined);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl,
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          url: "https://example.com",
        },
        type: "openExternal",
        version: 1,
      }),
    });

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl,
      presenter,
      rawBridgeEvent: JSON.stringify({
        type: "close",
        version: 1,
      }),
    });

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(presenter.dismiss).toHaveBeenCalledTimes(1);
  });

  it("answers ready with a configure envelope when the release has a runtime block", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const runtime = {
      contentHash: "5b00934c",
      productSlugs: ["yearly", "monthly"],
      variables: { accentColor: "#16a34a" },
    };
    const runtimeConfig = {
      products: [
        {
          id: "store_yearly",
          slug: "yearly",
          displayName: "Yearly Pro",
          priceString: "$59.99",
        },
      ],
      variables: { accentColor: "#16a34a" },
      locale: "en-US",
      platform: "ios" as const,
      defaultSelectedProductId: "store_yearly",
    };

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      runtime,
    });
    client.internal_buildPaywallRuntimeConfig.mockResolvedValue(runtimeConfig as never);

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        requestId: "req_ready",
        type: "ready",
        version: 1,
      }),
    });

    expect(client.internal_buildPaywallRuntimeConfig).toHaveBeenCalledWith(runtime);
    expect(presenter.postMessage).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(presenter.postMessage.mock.calls[0][1] as string);
    expect(envelope).toEqual({
      version: 1,
      type: "configure",
      requestId: "req_ready",
      payload: runtimeConfig,
    });
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("re-sends configure after show when preload dropped the bundle's ready event", async () => {
    const client = createClientMock();
    const runtimeConfig = {
      products: [
        {
          id: "store_yearly",
          slug: "yearly",
          displayName: "Yearly Pro",
          priceString: "$59.99",
        },
      ],
      variables: { accentColor: "#16a34a" },
    };

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      runtime: {
        contentHash: "5b00934c",
        productSlugs: ["yearly"],
        variables: { accentColor: "#16a34a" },
      },
    });
    client.internal_buildPaywallRuntimeConfig.mockResolvedValue(runtimeConfig as never);

    // Simulates the native presenters in the preload-then-show flow: the
    // bundle's one-shot `ready` fired during preload, before show() attached
    // the bridge callback, so NOTHING is ever delivered to onBridgeEvent.
    const onBridgeEvent = vi.fn();
    const presenter = {
      ...createPresenterMock(),
      show: vi.fn().mockResolvedValue(true),
    };

    const shown = await __internal_showResolvedPaywallForTests({
      client: asClient(client),
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      locationKey: "home",
      onBridgeEvent,
      presenter,
    });

    expect(shown).toBe(true);
    expect(onBridgeEvent).not.toHaveBeenCalled();
    // The post-show configure is fire-and-forget; wait for it to land.
    await vi.waitFor(() => expect(presenter.postMessage).toHaveBeenCalledTimes(1));
    const envelope = JSON.parse(presenter.postMessage.mock.calls[0][1] as string);
    expect(envelope.type).toBe("configure");
    expect(envelope.payload).toEqual(runtimeConfig);
  });

  it("sends no post-show configure for visual-editor releases or failed shows", async () => {
    const client = createClientMock();

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/legacy/index.html",
      runtime: null,
    });

    const visualEditorPresenter = {
      ...createPresenterMock(),
      show: vi.fn().mockResolvedValue(true),
    };
    await __internal_showResolvedPaywallForTests({
      client: asClient(client),
      htmlUrl: "https://cdn.example/p/legacy/index.html",
      locationKey: "home",
      onBridgeEvent: vi.fn(),
      presenter: visualEditorPresenter,
    });

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      runtime: {
        contentHash: "5b00934c",
        productSlugs: ["yearly"],
        variables: {},
      },
    });

    const failedShowPresenter = {
      ...createPresenterMock(),
      show: vi.fn().mockResolvedValue(false),
    };
    const shown = await __internal_showResolvedPaywallForTests({
      client: asClient(client),
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      locationKey: "home",
      onBridgeEvent: vi.fn(),
      presenter: failedShowPresenter,
    });

    expect(shown).toBe(false);
    await Effect.runPromise(Effect.sleep(0));
    expect(client.internal_buildPaywallRuntimeConfig).not.toHaveBeenCalled();
    expect(visualEditorPresenter.postMessage).not.toHaveBeenCalled();
    expect(failedShowPresenter.postMessage).not.toHaveBeenCalled();
  });

  it("sends no configure for visual-editor releases (no runtime block)", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/legacy/index.html",
      runtime: null,
    });

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        type: "ready",
        version: 1,
      }),
    });

    expect(client.internal_buildPaywallRuntimeConfig).not.toHaveBeenCalled();
    expect(presenter.postMessage).not.toHaveBeenCalled();
  });

  it("sends a degraded configure envelope when the config build fails", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    __internal_setResolvedPaywallForTests("home", {
      htmlUrl: "https://cdn.example/p/5b00934c/index.html",
      runtime: {
        contentHash: "5b00934c",
        productSlugs: ["yearly"],
        variables: { accentColor: "#16a34a" },
      },
    });
    client.internal_buildPaywallRuntimeConfig.mockRejectedValue(
      new Error("store unavailable") as never,
    );

    await expect(
      __internal_handlePaywallBridgeEventForTests({
        client: asClient(client),
        locationKey: "home",
        openExternalUrl: vi.fn().mockResolvedValue(undefined),
        presenter,
        rawBridgeEvent: JSON.stringify({
          requestId: "req_ready_degraded",
          type: "ready",
          version: 1,
        }),
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    expect(presenter.postMessage).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(presenter.postMessage.mock.calls[0][1] as string);
    expect(envelope).toEqual({
      version: 1,
      type: "configure",
      requestId: "req_ready_degraded",
      payload: {
        products: [],
        variables: { accentColor: "#16a34a" },
        platform: "ios",
      },
    });
    warnSpy.mockRestore();
  });

  it("routes event bridge actions to analytics capture with the location", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          name: "cta_seen",
          properties: { screen: "intro" },
        },
        type: "event",
        version: 1,
      }),
    });

    expect(client.capture).toHaveBeenCalledTimes(1);
    expect(client.capture).toHaveBeenCalledWith("cta_seen", {
      paywall_location: "home",
      screen: "intro",
    });
    // Fire-and-forget: no response envelope, no dismissal.
    expect(presenter.postMessage).not.toHaveBeenCalled();
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("routes a property-less event through the real paywalls runtime encoder", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: serializeEnvelope(createEventEnvelope("paywall_error")),
    });

    expect(client.capture).toHaveBeenCalledWith("paywall_error", {
      paywall_location: "home",
    });
  });

  it("returns deterministic busy error while another action is in-flight", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = vi.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);

    const purchaseGate = Deferred.makeUnsafe<void>();
    const resolvePurchase = () => Deferred.doneUnsafe(purchaseGate, Effect.void);
    client.purchase.mockImplementation(
      () => Effect.runPromise(Deferred.await(purchaseGate)) as never,
    );

    const firstRequest = __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_1",
        type: "purchase",
        version: 1,
      }),
    });

    await __internal_handlePaywallBridgeEventForTests({
      client: asClient(client),
      locationKey: "home",
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      paywallOptions: {
        onError,
      },
      presenter,
      rawBridgeEvent: JSON.stringify({
        payload: {
          productId: "prod_monthly",
        },
        requestId: "req_2",
        type: "purchase",
        version: 1,
      }),
    });

    const busyResponse = postedEnvelopes(presenter).find(
      (envelope) => envelope.payload.error?.code === "ACTION_BUSY",
    );
    expect(busyResponse.payload.error.code).toBe("ACTION_BUSY");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      action: "purchase",
      requestId: "req_2",
    });

    resolvePurchase();
    await firstRequest;
    expect(presenter.dismiss).toHaveBeenCalledTimes(1);
  });
});
