import { describe, expect, test } from "vite-plus/test";

import { resolveRuntimeLocale } from "./runtime-locale";

// Tests run in a node environment (no `window`), so the SDK-injected config is
// simulated by planting a minimal `window` global with the contract §7.1 shape.
const testGlobal = globalThis as unknown as { window?: unknown };

/**
 * Establishes the SDK-injected runtime config seen by the next
 * `resolveRuntimeLocale` call. Passing `undefined` simulates a host that never
 * injected one. Every test states its own precondition, so the tests stay
 * order-independent without a shared teardown hook.
 */
const injectRuntimeConfig = (config: Record<string, unknown> | undefined): void => {
  if (config === undefined) {
    delete testGlobal.window;
    return;
  }
  testGlobal.window = { __VOIDHASH_PAYWALL__: config };
};

describe("resolveRuntimeLocale", () => {
  test("prefers the SDK-injected runtime config locale over the payload locale", () => {
    injectRuntimeConfig({ locale: "de", products: [], variables: {} });
    expect(resolveRuntimeLocale("en")).toBe("de");
  });

  test("falls back to the payload locale when the injected config carries none", () => {
    injectRuntimeConfig({ products: [], variables: {} });
    expect(resolveRuntimeLocale("cs")).toBe("cs");
  });

  test("falls back to the payload locale when no config is injected", () => {
    injectRuntimeConfig(undefined);
    expect(resolveRuntimeLocale("cs")).toBe("cs");
  });

  test("returns undefined (base content) when neither source carries a locale", () => {
    injectRuntimeConfig(undefined);
    expect(resolveRuntimeLocale(undefined)).toBeUndefined();
  });
});
