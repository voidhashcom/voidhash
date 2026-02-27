import type { VoidhashClient } from "../../client";
import type { VoidhashSchema } from "../../core/schema";
import {
  __internal_handlePaywallBridgeEventForTests,
  __internal_resetPaywallByLocationCachesForTests,
} from "../../react/hooks/use-paywall-by-location";

jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../nitro", () => ({
  PaywallPresenter: undefined,
}));

function createClientMock() {
  return {
    getProducts: jest.fn(),
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
  } as unknown as jest.Mocked<VoidhashClient<VoidhashSchema>>;
}

function createPresenterMock() {
  return {
    dismiss: jest.fn().mockResolvedValue(undefined),
    postMessage: jest.fn(),
  };
}

describe("usePaywallByLocation bridge coordinator", () => {
  beforeEach(() => {
    __internal_resetPaywallByLocationCachesForTests();
    jest.clearAllMocks();
  });

  it("handles purchase bridge action and dismisses on success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const openExternalUrl = jest.fn().mockResolvedValue(undefined);

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
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

    expect(client.purchase).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prod_monthly" }),
      { method: "native" }
    );
    expect(presenter.postMessage).toHaveBeenCalled();
    expect(presenter.dismiss).toHaveBeenCalled();
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("invokes onPurchase callback on purchase success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onPurchase = jest.fn();
    const onError = jest.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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

    const response = JSON.parse(presenter.postMessage.mock.calls[0][1] as string);
    expect(response.payload.status).toBe("error");
    expect(presenter.dismiss).not.toHaveBeenCalled();
  });

  it("invokes onError callback when purchase product cannot be resolved", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = jest.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
      presenter,
      rawBridgeEvent: JSON.stringify({
        requestId: "req_restore",
        type: "restore",
        version: 1,
      }),
    });

    expect(client.restorePurchases).toHaveBeenCalledTimes(1);
    expect(presenter.postMessage).toHaveBeenCalledTimes(1);
    expect(presenter.dismiss).toHaveBeenCalledTimes(1);
  });

  it("invokes onRestore callback on restore success", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onRestore = jest.fn();
    const onError = jest.fn();

    client.restorePurchases.mockResolvedValue(undefined as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
    const onError = jest.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);
    client.purchase.mockRejectedValue(new Error("purchase failed") as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
    const onError = jest.fn();

    client.restorePurchases.mockRejectedValue(new Error("restore failed") as never);

    await __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
    const openExternalUrl = jest.fn().mockResolvedValue(undefined);

    await __internal_handlePaywallBridgeEventForTests({
      client,
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
      client,
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

  it("returns deterministic busy error while another action is in-flight", async () => {
    const client = createClientMock();
    const presenter = createPresenterMock();
    const onError = jest.fn();

    client.getProducts.mockResolvedValue({
      monthly: {
        id: "prod_monthly",
        slug: "monthly",
      },
    } as never);

    let resolvePurchase: (() => void) | undefined;
    client.purchase.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePurchase = resolve;
        }) as never
    );

    const firstRequest = __internal_handlePaywallBridgeEventForTests({
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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
      client,
      locationKey: "home",
      openExternalUrl: jest.fn().mockResolvedValue(undefined),
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

    const busyResponse = JSON.parse(
      presenter.postMessage.mock.calls[0][1] as string
    );
    expect(busyResponse.payload.error.code).toBe("ACTION_BUSY");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      action: "purchase",
      requestId: "req_2",
    });

    resolvePurchase?.();
    await firstRequest;
    expect(presenter.dismiss).toHaveBeenCalledTimes(1);
  });
});
