import { afterEach, describe, expect, test } from "vite-plus/test";

import { resolveRuntimeLocale } from "./runtime-locale";

// Tests run in a node environment (no `window`), so the SDK-injected config is
// simulated by planting a minimal `window` global with the contract §7.1 shape.
const testGlobal = globalThis as unknown as { window?: unknown };

afterEach(() => {
  delete testGlobal.window;
});

describe("resolveRuntimeLocale", () => {
  test("prefers the SDK-injected runtime config locale over the payload locale", () => {
    testGlobal.window = {
      __VOIDHASH_PAYWALL__: { locale: "de", products: [], variables: {} },
    };
    expect(resolveRuntimeLocale("en")).toBe("de");
  });

  test("falls back to the payload locale when the injected config carries none", () => {
    testGlobal.window = {
      __VOIDHASH_PAYWALL__: { products: [], variables: {} },
    };
    expect(resolveRuntimeLocale("cs")).toBe("cs");
  });

  test("falls back to the payload locale when no config is injected", () => {
    expect(resolveRuntimeLocale("cs")).toBe("cs");
  });

  test("returns undefined (base content) when neither source carries a locale", () => {
    expect(resolveRuntimeLocale(undefined)).toBeUndefined();
  });
});
