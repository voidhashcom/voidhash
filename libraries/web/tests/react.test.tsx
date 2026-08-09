import { Effect } from "effect";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { createJsonResponse } from "./helpers";

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

/** Restores the globals each test stubs, replacing an `afterEach` teardown hook. */
const withCleanup = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.ensuring(
    effect,
    Effect.sync(() => {
      vi.unstubAllGlobals();
      window.localStorage.clear();
      delete window.IS_REACT_ACT_ENVIRONMENT;
    }),
  );

const requestUrl = (input: URL | RequestInfo): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const respondTo = (url: string) => {
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
};

/** Runs a callback inside React's `act`, awaiting the scheduled work. */
const actEffect = <A,>(effect: Effect.Effect<A>) =>
  Effect.promise(() => act(() => Effect.runPromise(effect)));

describe("react integration", () => {
  it("keeps the root entry importable without react", () =>
    Effect.runPromise(
      withCleanup(
        Effect.gen(function* importRootEntry() {
          const mod = yield* Effect.promise(() => import("../src/index"));

          expect(typeof mod.createVoidhashClient).toBe("function");
        }),
      ),
    ));

  it("renders provider and hooks safely", () =>
    Effect.runPromise(
      withCleanup(
        Effect.gen(function* renderProvider() {
          window.IS_REACT_ACT_ENVIRONMENT = true;
          vi.stubGlobal(
            "fetch",
            vi.fn((input: URL | RequestInfo) =>
              Effect.runPromise(Effect.sync(() => respondTo(requestUrl(input)))),
            ),
          );

          const { VoidhashProvider, useFeatureFlags, useVoidhash } = yield* Effect.promise(
            () => import("../src/react/index"),
          );

          const container = document.createElement("div");
          const root = createRoot(container);

          function TestComponent() {
            const { distinctId, isInitialized } = useVoidhash();
            const flags = useFeatureFlags(["new-nav"]);

            return (
              <div>
                <span data-testid="ready">{String(isInitialized)}</span>
                <span data-testid="distinct-id">{distinctId ?? ""}</span>
                <span data-testid="flag">{String(flags.isEnabled("new-nav"))}</span>
              </div>
            );
          }

          yield* actEffect(
            Effect.sync(() => {
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
                </VoidhashProvider>,
              );
            }),
          );
          yield* actEffect(Effect.forEach(Array.from({ length: 3 }), () => Effect.yieldNow));

          expect(container.querySelector('[data-testid="ready"]')?.textContent).toBe("true");
          expect(container.querySelector('[data-testid="distinct-id"]')?.textContent).toMatch(
            /^vh:anon:/,
          );
          expect(container.querySelector('[data-testid="flag"]')?.textContent).toBe("true");

          yield* actEffect(Effect.sync(() => root.unmount()));
        }),
      ),
    ));
});
