import { Result } from "better-result";
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
import { PurchasePendingError, UserCancelledError } from "../src/core/payment-adapters/errors";
import { createTestSchema } from "./helpers/test-schema";

function createClient(
  readOnly = false,
  unstableSwallowErrors = false,
  dev = false,
  enabled = true,
) {
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

async function expectOk<T>(promise: Promise<Result<T, VoidhashError>>): Promise<T> {
  const result = await promise;
  if (!result.isOk()) {
    expect.fail(`expected Ok, got Err: ${result.error.message}`);
  }
  return result.value;
}

async function expectErr(promise: Promise<Result<unknown, VoidhashError>>): Promise<VoidhashError> {
  const result = await promise;
  if (result.isOk()) {
    expect.fail("expected Err, got Ok");
  }
  return result.error;
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

      await expectOk(client.flush());
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

      await expectOk(client.identify("new-user", { email: "new@voidhash.test" }));
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

      await expectOk(client.restorePurchases());
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

      await expectOk(client.init());
      expect(client.isInitialized).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "[voidhash] swallowed error in init",
        expect.any(VoidhashError),
      );
      warnSpy.mockRestore();
    });

    it("swallows not-initialized errors in side-effect methods when unstable_swallowErrors is enabled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        return;
      });
      const client = createClient(false, true);

      await expectOk(client.identify("new-user", { email: "new@voidhash.test" }));
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

      const error = await expectErr(client.getProducts());
      expect(error.code).toBe("FAILED_TO_GET_PRODUCTS");
    });

    it("keeps purchase strict even when unstable_swallowErrors is enabled", async () => {
      const client = createClient(false, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.fail("boom")),
      };

      const error = await expectErr(client.purchase({ id: "monthly-id" } as never));
      expect(error.code).toBe("FAILED_TO_PURCHASE");
    });
  });

  describe("purchase results", () => {
    it("maps a user cancellation to the cancelled status instead of an error", async () => {
      const client = createClient();

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi
          .fn()
          .mockResolvedValue(Exit.fail(new UserCancelledError({ message: "cancelled" }))),
      };

      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "cancelled" }),
      );
    });

    it("maps a pending purchase to the pending status", async () => {
      const client = createClient();

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi
          .fn()
          .mockResolvedValue(Exit.fail(new PurchasePendingError({ message: "pending" }))),
      };

      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "pending" }),
      );
    });

    it("resolves completed on success", async () => {
      const client = createClient();
      stubInitializedClient(client, { purchase: () => "purchase-effect" });

      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "completed" }),
      );
    });
  });

  describe("readOnly mode", () => {
    it("fails purchasing in read-only mode with a structured error", async () => {
      const client = createClient(true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      const error = await expectErr(client.purchase({ id: "monthly-id" } as never));
      expect(error).toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
      expect(error.code).toBe("READ_ONLY_PURCHASE_NOT_ALLOWED");
    });

    it("keeps read-only purchase failure strict when unstable_swallowErrors is enabled", async () => {
      const client = createClient(true, true);

      (client as unknown as Record<string, unknown>).initializedClient = {
        purchase: () => "purchase-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: vi.fn().mockResolvedValue(Exit.succeed(undefined)),
      };

      const result = await client.purchase({ id: "monthly-id" } as never);
      expect(result.isErr()).toBe(true);
    });

    it("allows purchasing after setReadOnly(false) flips the client to owner mode", async () => {
      const client = createClient(true);
      stubInitializedClient(client, { purchase: () => "purchase-effect" });

      expect(client.isReadOnly).toBe(true);
      const blocked = await client.purchase({ id: "monthly-id" } as never);
      expect(blocked.isErr()).toBe(true);

      client.setReadOnly(false);

      expect(client.isReadOnly).toBe(false);
      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "completed" }),
      );
    });

    it("blocks purchasing again after setReadOnly(true) flips the client to observer mode", async () => {
      const client = createClient(false);
      stubInitializedClient(client, { purchase: () => "purchase-effect" });

      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "completed" }),
      );

      client.setReadOnly(true);

      const blocked = await client.purchase({ id: "monthly-id" } as never);
      expect(blocked.isErr()).toBe(true);
    });

    it("gates setPersonAttributesSync on the current mode", async () => {
      const client = createClient(true);
      stubInitializedClient(client, { setPersonAttributesSync: () => "sync-effect" });

      const blocked = await client.setPersonAttributesSync({ email: "a@voidhash.test" });
      expect(blocked.isErr()).toBe(true);
      if (blocked.isErr()) {
        expect(blocked.error).toBeInstanceOf(ReadOnlyModePurchaseNotAllowedError);
      }

      client.setReadOnly(false);

      await expect(
        client.setPersonAttributesSync({ email: "a@voidhash.test" }),
      ).resolves.toBeTruthy();
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

  describe("hasPerk", () => {
    const activeGrant = { perkId: "premium", status: "active" };
    const expiredGrant = { perkId: "premium", status: "expired" };

    function stubPersonResponses(
      client: VoidhashClient,
      options: {
        fresh?: unknown;
        cached?: unknown;
        freshFails?: boolean;
      },
    ) {
      stubInitializedClient(client, {
        getCachedPerson: () => "cached-person-effect",
        getCurrentPerson: () => "person-effect",
      });
      const runPromiseExit = vi.fn().mockImplementation(async () => {
        if (options.freshFails) {
          return Exit.fail(new Error("offline"));
        }
        return Exit.succeed(options.fresh ?? null);
      });
      // The second call in a stale fallback reads the cache.
      if (options.freshFails && options.cached !== undefined) {
        runPromiseExit.mockResolvedValueOnce(Exit.fail(new Error("offline")));
        runPromiseExit.mockResolvedValueOnce(Exit.succeed(options.cached));
      }
      (client as unknown as Record<string, unknown>).effectRuntime = { runPromiseExit };
    }

    it("answers from a fresh snapshot when the refresh succeeds", async () => {
      const client = createClient();
      stubPersonResponses(client, { fresh: { entitlements: { grants: [activeGrant] } } });

      await expect(client.hasPerk("premium")).resolves.toEqual(
        Result.ok({ grant: activeGrant, hasAccess: true, isStale: false }),
      );
    });

    it("answers false for an expired or missing grant", async () => {
      const client = createClient();
      stubPersonResponses(client, { fresh: { entitlements: { grants: [expiredGrant] } } });

      await expect(client.hasPerk("premium")).resolves.toEqual(
        Result.ok({ grant: null, hasAccess: false, isStale: false }),
      );
    });

    it("falls back to the cached snapshot and flags staleness when the refresh fails", async () => {
      const client = createClient();
      stubPersonResponses(client, {
        cached: { entitlements: { grants: [activeGrant] } },
        fresh: { entitlements: { grants: [] } },
        freshFails: true,
      });

      await expect(client.hasPerk("premium")).resolves.toEqual(
        Result.ok({ grant: activeGrant, hasAccess: true, isStale: true }),
      );
    });

    it("fails with the refresh error when there is no cached evidence of access", async () => {
      const client = createClient();
      stubPersonResponses(client, {
        cached: { entitlements: { grants: [] } },
        freshFails: true,
      });

      const error = await expectErr(client.hasPerk("premium"));
      expect(error.code).toBe("FAILED_TO_GET_CURRENT_PERSON");
    });

    it("fails with the refresh error when allowStale is false", async () => {
      const client = createClient();
      stubPersonResponses(client, {
        cached: { entitlements: { grants: [activeGrant] } },
        freshFails: true,
      });

      const error = await expectErr(client.hasPerk("premium", { allowStale: false }));
      expect(error.code).toBe("FAILED_TO_GET_CURRENT_PERSON");
    });

    it("answers no access on a disabled client", async () => {
      const client = createClient(false, false, false, false);

      await expect(client.hasPerk("premium")).resolves.toEqual(
        Result.ok({ grant: null, hasAccess: false, isStale: false }),
      );
    });
  });

  describe("disabled mode", () => {
    it("resolves init and end as no-ops and stays uninitialized", async () => {
      const client = createClient(false, false, false, false);

      expect(client.isEnabled).toBe(false);
      await expectOk(client.init());
      expect(client.isInitialized).toBe(false);
      await expectOk(client.end());
    });

    it("resolves every side-effect method without throwing", async () => {
      const client = createClient(false, false, false, false);

      await expectOk(client.identify("user", { email: "user@voidhash.test" }));
      await expectOk(client.setPersonAttributes({ name: "User" }));
      await expectOk(client.reset());
      await expectOk(client.signOut());
      await expect(client.purchase({ id: "monthly-id" } as never)).resolves.toEqual(
        Result.ok({ status: "disabled" }),
      );
      await expectOk(client.restorePurchases());
      await expectOk(client.flush());
      await expectOk(client.iosPresentCodeRedemptionSheet());
      await expectOk(client.iosShowManageSubscriptions());
      expect(() => client.capture("cta_seen")).not.toThrow();
    });

    it("answers reads with their empty shape", async () => {
      const client = createClient(false, false, false, false);

      await expect(client.getCurrentPerson()).resolves.toEqual(Result.ok(null));
      await expect(client.getDistinctId()).resolves.toEqual(Result.ok(null));
      await expect(client.setPersonAttributesSync({ name: "User" })).resolves.toEqual(
        Result.ok(null),
      );
      await expect(client.getProducts()).resolves.toEqual(Result.ok({}));
      await expect(client.getFeatureFlags()).resolves.toEqual(Result.ok({ flags: [] }));
      await expect(client.getPaywallForLocation("home")).resolves.toEqual(Result.ok(null));
      expect(client.internal.getSchema()).toBeNull();
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
