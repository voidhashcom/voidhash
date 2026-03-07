import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createJsonResponse } from "./helpers";

describe("react integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it("keeps the root entry importable without react", async () => {
    const mod = await import("../src/index");

    expect(typeof mod.createVoidhashClient).toBe("function");
  });

  it("renders provider and hooks safely", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = input.toString();
      if (url.endsWith("/sdk/evaluate-flags")) {
        return createJsonResponse({
          flags: [
            {
              enabled: true,
              key: "new-nav",
              payload: null,
              variantKey: "on",
            },
          ],
        });
      }

      return createJsonResponse({});
    }));

    const {
      VoidhashProvider,
      useFeatureFlags,
      useVoidhash,
    } = await import("../src/react/index");

    const container = document.createElement("div");
    const root = createRoot(container);

    function TestComponent() {
      const { appUserId, isInitialized } = useVoidhash();
      const flags = useFeatureFlags(["new-nav"]);

      return (
        <div>
          <span data-testid="ready">{String(isInitialized)}</span>
          <span data-testid="app-user-id">{appUserId ?? ""}</span>
          <span data-testid="flag">{String(flags.isEnabled("new-nav"))}</span>
        </div>
      );
    }

    await act(async () => {
      root.render(
        <VoidhashProvider
          config={{
            analytics: {
              enabled: false,
            },
            publishableKey: "vh_pk_test",
          }}
        >
          <TestComponent />
        </VoidhashProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="ready"]')?.textContent).toBe(
      "true"
    );
    expect(
      container.querySelector('[data-testid="app-user-id"]')?.textContent
    ).toMatch(/^vh:anon:/);
    expect(container.querySelector('[data-testid="flag"]')?.textContent).toBe(
      "true"
    );

    await act(async () => {
      root.unmount();
    });
  });
});
