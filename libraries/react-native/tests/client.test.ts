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

function createClient(readOnly = false, unstableSwallowErrors = false, dev = false, enabled = true) {
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
    enabled,
  );
}

/** Stubs the pieces of an initialized client that the guards run through. */
function stubInitializedClient(client: VoidhashClient, initializedClient: Record<string, unknown>) {
  (client as unknown as Record<string, unknown>).initializedClient = initializedClient;
  (client as unknown as Record<string, unknown>).effectRuntime = {
    runPromiseExit: vi.fn().mockResolvedValue(Exit.succeed(undefined)),
  };
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

    it("allows purchasing after setReadOnly(false) flips the client to owner mode", async () => {
      const client = createClient(true);
      stubInitializedClient(client, { purchase: () => "purchase-effect" });

      expect(client.isReadOnly).toBe(true);
      await expect(
        client.purchase({ id: "monthly-id" } as never, {}),
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);

      client.setReadOnly(false);

      expect(client.isReadOnly).toBe(false);
      await expect(client.purchase({ id: "monthly-id" } as never, {})).resolves.toBeUndefined();
    });

    it("blocks purchasing again after setReadOnly(true) flips the client to observer mode", async () => {
      const client = createClient(false);
      stubInitializedClient(client, { purchase: () => "purchase-effect" });

      await expect(client.purchase({ id: "monthly-id" } as never, {})).resolves.toBeUndefined();

      client.setReadOnly(true);

      await expect(
        client.purchase({ id: "monthly-id" } as never, {}),
      ).rejects.toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
    });

    it("gates setPersonAttributesSync on the current mode", async () => {
      const client = createClient(true);
      stubInitializedClient(client, { setPersonAttributesSync: () => "sync-effect" });

      await expect(client.setPersonAttributesSync({ email: "a@voidhash.test" })).rejects.toBeInstanceOf(
        ReadOnlyModePurchaseNotAllowedError,
      );

      client.setReadOnly(false);

      await expect(
        client.setPersonAttributesSync({ email: "a@voidhash.test" }),
      ).resolves.toBeUndefined();
    });

    it("publishes the switch to the SdkConfiguration the Effect layer reads", () => {
      const client = createClient(true);
      const { service } = (
        client as unknown as { sdkConfiguration: { service: { readOnly: boolean } } }
      ).sdkConfiguration;

      expect(service.readOnly).toBe(true);

      client.setReadOnly(false);

      // The service object handed to the layer is never rebuilt, so every
      // consumer reading `sdkConfiguration.readOnly` observes the new mode.
      expect(service.readOnly).toBe(false);
    });
  });

  describe("disabled mode", () => {
    it("resolves init and end as no-ops and stays uninitialized", async () => {
      const client = createClient(false, false, false, false);

      expect(client.isEnabled).toBe(false);
      await expect(client.init()).resolves.toBeUndefined();
      expect(client.isInitialized).toBe(false);
      await expect(client.end()).resolves.toBeUndefined();
    });

    it("resolves every side-effect method without throwing", async () => {
      const client = createClient(false, false, false, false);

      await expect(
        client.identify("user", { email: "user@voidhash.test" }),
      ).resolves.toBeUndefined();
      await expect(client.setPersonAttributes({ name: "User" })).resolves.toBeUndefined();
      await expect(client.reset()).resolves.toBeUndefined();
      await expect(client.signOut()).resolves.toBeUndefined();
      await expect(client.purchase({ id: "monthly-id" } as never, {})).resolves.toBeUndefined();
      await expect(client.restorePurchases()).resolves.toBeUndefined();
      await expect(client.flush()).resolves.toBeUndefined();
      await expect(client.iosPresentCodeRedemptionSheet()).resolves.toBeUndefined();
      await expect(client.iosShowManageSubscriptions()).resolves.toBeUndefined();
      expect(() => client.capture("cta_seen")).not.toThrow();
    });

    it("answers reads with their empty shape", async () => {
      const client = createClient(false, false, false, false);

      await expect(client.getCurrentPerson()).resolves.toBeNull();
      await expect(client.getDistinctId()).resolves.toBeNull();
      await expect(client.setPersonAttributesSync({ name: "User" })).resolves.toBeNull();
      await expect(client.getProducts()).resolves.toEqual({});
      await expect(client.getFeatureFlags()).resolves.toEqual({ flags: [] });
      await expect(client.getPaywallForLocation("home")).resolves.toBeNull();
      expect(client.internal_getSchema()).toBeNull();
    });

    it("never runs an effect, so nothing is queued, persisted or sent", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const client = createClient(false, false, false, false);
      const runSync = vi.fn();
      const runPromiseExit = vi.fn();
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit,
        runSync,
      };

      await client.init();
      client.capture("cta_seen");
      await client.flush();
      await client.end();

      expect(runSync).not.toHaveBeenCalled();
      expect(runPromiseExit).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(
        (client as unknown as { preInitAnalyticsBuffer: unknown[] }).preInitAnalyticsBuffer,
      ).toHaveLength(0);
      vi.unstubAllGlobals();
    });
  });
});
