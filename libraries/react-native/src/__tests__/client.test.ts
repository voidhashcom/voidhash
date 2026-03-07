import { Exit } from "effect";

jest.mock("react-native", () => ({ AppState: null }), { virtual: true });

jest.mock("../core/payment-adapters/app-store-adapter", () => {
  const { Layer } = jest.requireActual("effect");
  return {
    AppStoreAdapter: Layer.empty,
  };
});

jest.mock("../core/payment-adapters/google-play-adapter", () => {
  const { Layer } = jest.requireActual("effect");
  return {
    GooglePlayAdapter: Layer.empty,
  };
});

jest.mock("../core/platform/react-native-platform-provider", () => {
  const { Layer } = jest.requireActual("effect");
  const { PlatformProvider } = jest.requireActual(
    "../core/platform/platform-provider"
  );
  return {
    ReactNativePlatformProvider: Layer.succeed(PlatformProvider, {
      appBuild: "100",
      appName: "Voidhash Test",
      appVersion: "1.0.0",
      bundleId: "com.voidhash.test",
      deviceBrand: "Test Brand",
      deviceName: "Test Device",
      isDebugBuild: true,
      locales: [{ languageTag: "en-US" }],
      platform: "ios",
      systemVersion: "17.0",
    }),
  };
});

import { VoidhashClient } from "../client";
import { EventBus } from "../core/event-bus";
import {
  ReadOnlyModePurchaseNotAllowedError,
  VoidhashError,
} from "../errors";
import { createTestSchema } from "./helpers/test-schema";

function createClient(readOnly = false, unstableSwallowErrors = false) {
  return new VoidhashClient(
    null,
    "voidhash",
    createTestSchema(),
    "https://api.voidhash.test",
    undefined,
    "pk_test",
    readOnly,
    unstableSwallowErrors,
    new EventBus(),
    "ios"
  );
}

describe("VoidhashClient", () => {
  describe("unstable_swallowErrors", () => {
    it("swallows flush errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        flush: () => "flush-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.flush()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in flush",
        expect.any(VoidhashError)
      );

      warnSpy.mockRestore();
    });

    it("swallows identify errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        identify: () => "identify-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(
        client.identify("new-user", { email: "new@voidhash.test" })
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in identify",
        expect.any(VoidhashError)
      );
      warnSpy.mockRestore();
    });

    it("swallows restorePurchases errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        restorePurchases: () => "restore-purchases-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.restorePurchases()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in restorePurchases",
        expect.any(VoidhashError)
      );
      warnSpy.mockRestore();
    });

    it("swallows init errors and keeps client uninitialized when unstable_swallowErrors is enabled", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).unitializedClient = {
        init: () => "init-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.init()).resolves.toBeUndefined();
      expect(client.isInitialized).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in init",
        expect.any(VoidhashError)
      );
      warnSpy.mockRestore();
    });

    it("swallows ensureInitialized errors in side-effect methods when unstable_swallowErrors is enabled", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      await expect(
        client.identify("new-user", { email: "new@voidhash.test" })
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in identify",
        expect.any(VoidhashError)
      );
      warnSpy.mockRestore();
    });

    it("keeps getProducts strict even when unstable_swallowErrors is enabled", async () => {
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        getProducts: () => "get-products-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.getProducts()).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: expect.stringContaining("FAILED_TO_GET_PRODUCTS"),
        })
      );
    });

    it("keeps purchase strict even when unstable_swallowErrors is enabled", async () => {
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {}
        )
      ).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: expect.stringContaining("FAILED_TO_PURCHASE"),
        })
      );
    });
  });

  describe("readOnly mode", () => {
    it("throws when purchasing in read-only mode", async () => {
      const client = createClient(true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {}
        )
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
    });

    it("keeps read-only purchase rejection strict when unstable_swallowErrors is enabled", async () => {
      const client = createClient(true, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {}
        )
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
    });
  });
});
