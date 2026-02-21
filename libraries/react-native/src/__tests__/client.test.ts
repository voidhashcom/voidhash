import { Exit } from "effect";

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
import { VoidhashError } from "../errors";
import { createTestSchema } from "./helpers/test-schema";

function createClient() {
  return new VoidhashClient(
    null,
    "voidhash",
    createTestSchema(),
    "https://api.voidhash.test",
    "pk_test",
    new EventBus(),
    "ios"
  );
}

describe("VoidhashClient", () => {
  describe("init/end lifecycle", () => {
    it("sets initialized true after successful init", async () => {
      const client = createClient();
      const initializedClient = {
        end: () => "end-effect",
      };

      (client as unknown as Record<string, unknown>).unitializedClient = {
        init: () => "init-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.succeed(initializedClient)),
      };

      await client.init();

      expect(client.isInitialized).toBe(true);
    });

    it("sets initialized false after successful end", async () => {
      const client = createClient();
      const initializedClient = {
        end: () => "end-effect",
      };

      (client as unknown as Record<string, unknown>).unitializedClient = {
        init: () => "init-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest
          .fn()
          .mockResolvedValueOnce(Exit.succeed(initializedClient))
          .mockResolvedValueOnce(Exit.succeed(undefined)),
      };

      await client.init();
      expect(client.isInitialized).toBe(true);

      await client.end();
      expect(client.isInitialized).toBe(false);
    });
  });

  describe("error mapping", () => {
    it("maps getProducts effect failures to VoidhashError", async () => {
      const client = createClient();

      (client as unknown as Record<string, unknown>).initializedClient = {
        getProducts: () => "get-products-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(client.getProducts()).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: "FAILED_TO_GET_PRODUCTS",
        })
      );
    });

    it("maps identify effect failures to VoidhashError", async () => {
      const client = createClient();

      (client as unknown as Record<string, unknown>).initializedClient = {
        identify: () => "identify-effect",
      };
      (client as unknown as Record<string, unknown>).effectRuntime = {
        runPromiseExit: jest.fn().mockResolvedValue(Exit.fail("boom")),
      };

      await expect(
        client.identify("new-user", { email: "new@voidhash.test" })
      ).rejects.toEqual(
        expect.objectContaining<Partial<VoidhashError>>({
          message: "FAILED_TO_IDENTIFY",
        })
      );
    });
  });
});
