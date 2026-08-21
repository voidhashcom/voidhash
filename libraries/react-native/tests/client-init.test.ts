import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { vi } from "vitest";
import { describe, expect, it } from "./helpers/effect-vitest";

const appState = vi.hoisted(() => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  currentState: "active",
}));

const nativeStore = vi.hoisted(() => ({
  endConnectionCalls: 0,
  initConnectionCalls: 0,
}));

vi.mock("react-native", () => ({ AppState: appState }));

vi.mock("@react-native-async-storage/async-storage", () => {
  const entries = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => entries.get(key) ?? null,
      removeItem: async (key: string) => {
        entries.delete(key);
      },
      setItem: async (key: string, value: string) => {
        entries.set(key, value);
      },
    },
  };
});

vi.mock("../src/core/payment-adapters/app-store-adapter", async () => {
  const { Effect: ActualEffect, Layer } = await vi.importActual<typeof import("effect")>("effect");
  const { PaymentAdapter } = await vi.importActual<
    typeof import("../src/core/payment-adapters/payment-adapter")
  >("../src/core/payment-adapters/payment-adapter");
  return {
    AppStoreAdapter: Layer.succeed(PaymentAdapter, {
      acknowledgePurchase: () => ActualEffect.void,
      buyProduct: () => ActualEffect.die(new Error("buyProduct is not part of init")),
      endConnection: () =>
        ActualEffect.sync(() => {
          nativeStore.endConnectionCalls += 1;
        }),
      getPendingTransactions: () => ActualEffect.succeed([]),
      getProducts: () => ActualEffect.succeed([]),
      getPurchaseHistory: () => ActualEffect.succeed([]),
      initConnection: () =>
        ActualEffect.sync(() => {
          nativeStore.initConnectionCalls += 1;
        }),
    } as unknown as typeof PaymentAdapter.Service),
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
import { LifecycleAdapter } from "../src/core/lifecycle/lifecycle-adapter";
import { ReactNativeLifecycleAdapter } from "../src/core/lifecycle/react-native-lifecycle-adapter";
import { createTestSchema } from "./helpers/test-schema";

function createClient() {
  return new VoidhashClient(
    null,
    "voidhash",
    "https://api.voidhash.test",
    undefined,
    "pk_test",
    false,
    false,
    AtomRegistry.make(),
    "ios",
    false,
    createTestSchema(),
  );
}

/** Answers every SDK request with a person-shaped 200 so init can complete. */
function createFetchDouble() {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ distinctId: "anon", personId: "person-anon", email: null, name: null }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
  );
}

/** Disposes the runtime the client owns privately — it has no public teardown. */
const disposeRuntime = (client: VoidhashClient) =>
  (
    client as unknown as { effectRuntime: { dispose: () => Promise<void> } }
  ).effectRuntime.dispose();

describe("VoidhashClient init", () => {
  it("resolves through the real code path and wires automatic lifecycle events", async () => {
    vi.stubGlobal("fetch", createFetchDouble());
    const client = createClient();

    // Regression: wiring the lifecycle events used to run an asynchronous
    // effect with `runSync`, so `init()` marked the client initialized and
    // then failed, leaving a half-live client behind.
    const initResult = await client.init();
    expect(initResult.isOk()).toBe(true);

    expect(client.isInitialized).toBe(true);
    expect(nativeStore.initConnectionCalls).toBe(1);
    expect(appState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    const endResult = await client.end();
    expect(endResult.isOk()).toBe(true);
    expect(client.isInitialized).toBe(false);

    await disposeRuntime(client);
    vi.unstubAllGlobals();
  });

  it("subscribes to AppState synchronously", () => {
    // `runSync` is the assertion: an adapter that resolves `react-native`
    // asynchronously dies here instead of returning a subscription.
    const subscription = Effect.runSync(
      Effect.flatMap(LifecycleAdapter, (adapter) => adapter.subscribe(() => {})).pipe(
        Effect.provide(ReactNativeLifecycleAdapter),
      ),
    );

    expect(subscription).not.toBeNull();
  });
});
