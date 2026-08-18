import { Effect, Exit } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { vi } from "vitest";
import { describe, expect, it } from "./helpers/effect-vitest";

vi.mock("react-native", () => ({ AppState: null }));

vi.mock("../src/core/payment-adapters/app-store-adapter", async () => {
  const { Layer } = await vi.importActual<typeof import("effect")>("effect");
  return {
    AppStoreAdapter: Layer.empty,
  };
});

vi.mock("../src/core/payment-adapters/google-play-adapter", async () => {
  const { Layer } = await vi.importActual<typeof import("effect")>("effect");
  return {
    GooglePlayAdapter: Layer.empty,
  };
});

vi.mock("../src/core/platform/react-native-platform-provider", async () => {
  const { Layer } = await vi.importActual<typeof import("effect")>("effect");
  const { PlatformProvider } = await vi.importActual<
    typeof import("../src/core/platform/platform-provider")
  >("../src/core/platform/platform-provider");
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

import { VoidhashClient } from "../src/client";
import { ReadOnlyModePurchaseNotAllowedError, VoidhashError } from "../src/errors";
import { createTestSchema } from "./helpers/test-schema";

function createClient(readOnly = false, unstableSwallowErrors = false, dev = false) {
  return new VoidhashClient(
    null,
    "voidhash",
    "https://api.voidhash.test",
    undefined,
    "pk_test",
    readOnly,
    unstableSwallowErrors,
    AtomRegistry.make(),
    "ios",
    false,
    createTestSchema(),
    dev,
  );
}

describe("VoidhashClient", () => {
  describe("dev mode", () => {
    it("disables dev mode in release builds even when requested", () =>
      Effect.sync(() => {
        vi.stubGlobal("__DEV__", false);
        const client = createClient(false, false, true);

        expect((client as unknown as { developmentMode: boolean }).developmentMode).toBe(false);
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            vi.unstubAllGlobals();
          }),
        ),
      ));
  });

  describe("unstable_swallowErrors", () => {
    it("swallows flush errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        flush: () => "flush-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.flush()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in flush",
        expect.any(VoidhashError),
      );

      warnSpy.mockRestore();
    });

    it("swallows identify errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        identify: () => "identify-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(
        client.identify("new-user", { email: "new@voidhash.test" }),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in identify",
        expect.any(VoidhashError),
      );
      warnSpy.mockRestore();
    });

    it("swallows restorePurchases errors when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        restorePurchases: () => "restore-purchases-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.restorePurchases()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in restorePurchases",
        expect.any(VoidhashError),
      );
      warnSpy.mockRestore();
    });

    it("swallows init errors and keeps client uninitialized when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).unitializedClient = {
        init: () => "init-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.init()).resolves.toBeUndefined();
      expect(client.isInitialized).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in init",
        expect.any(VoidhashError),
      );
      warnSpy.mockRestore();
    });

    it("swallows ensureInitialized errors in side-effect methods when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      await expect(
        client.identify("new-user", { email: "new@voidhash.test" }),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in identify",
        expect.any(VoidhashError),
      );
      warnSpy.mockRestore();
    });

    it("keeps getProducts strict even when unstable_swallowErrors is enabled", async () => {
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        getProducts: () => "get-products-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.getProducts()).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: expect.stringContaining("FAILED_TO_GET_PRODUCTS"),
        }),
      );
    });

    it("keeps purchase strict even when unstable_swallowErrors is enabled", async () => {
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {},
        ),
      ).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: expect.stringContaining("FAILED_TO_PURCHASE"),
        }),
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
        runPromiseExit: vi.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {},
        ),
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
    });

    it("keeps read-only purchase rejection strict when unstable_swallowErrors is enabled", async () => {
      const client = createClient(true, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      await expect(
        client.purchase(
          {
            id: "monthly-id",
          } as never,
          {},
        ),
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
    });
  });
});
