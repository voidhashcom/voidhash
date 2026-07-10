/**
 * Runtime observability: malformed inbound messages and product-less
 * purchase() calls warn instead of silently no-oping, and a crashing paywall
 * reports a `paywall_error` event through the bridge instead of leaving a
 * blank WebView with no signal.
 */
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type PaywallBridge,
  type PaywallOutboundEnvelope,
  PaywallRuntimeProvider,
  usePaywallActions,
} from "../src/index";
import { PaywallErrorBoundary } from "../src/renderer/error-boundary";
import { subscribeToInboundEnvelopes } from "../src/runtime/bridge";
import type { PaywallInboundEnvelope } from "../src/runtime/envelope";
import { renderToNodeTree } from "../src/tree";

const collectingBridge = (posted: PaywallOutboundEnvelope[]): PaywallBridge => ({
  post: (envelope) => {
    posted.push(envelope);
  },
  subscribe: () => () => {
    // no inbound channel in tests
  },
});

interface FakeWindow {
  addEventListener: (type: string, listener: (event: { data: unknown }) => void) => void;
  onVoidhashNativeMessage?: (data: string) => void;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("inbound bridge parsing", () => {
  it("warns when an inbound message fails to parse and keeps dispatching valid ones", () => {
    const fakeWindow: FakeWindow = {
      addEventListener: () => {
        // the studio postMessage channel is not under test here
      },
    };
    vi.stubGlobal("window", fakeWindow);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const received: PaywallInboundEnvelope[] = [];
    const unsubscribe = subscribeToInboundEnvelopes((envelope) => {
      received.push(envelope);
    });

    // The native presenter delivers raw JSON through the installed global.
    fakeWindow.onVoidhashNativeMessage?.("{not json");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);

    fakeWindow.onVoidhashNativeMessage?.(
      JSON.stringify({ version: 99, type: "configure", payload: {} }),
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(received).toEqual([]);

    fakeWindow.onVoidhashNativeMessage?.(
      JSON.stringify({
        version: 1,
        type: "status",
        payload: { status: "purchasing" },
      }),
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(received).toHaveLength(1);

    unsubscribe();
  });
});

describe("purchase() without a product", () => {
  it("warns and posts no purchase envelope", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const posted: PaywallOutboundEnvelope[] = [];

    const Trigger = () => {
      const actions = usePaywallActions();
      useEffect(() => {
        actions.purchase();
      }, [actions]);
      return null;
    };

    await renderToNodeTree(
      <PaywallRuntimeProvider
        bridge={collectingBridge(posted)}
        config={{ products: [], variables: {} }}
      >
        <Trigger />
      </PaywallRuntimeProvider>,
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("purchase() called with no selected"),
    );
    expect(posted.filter((envelope) => envelope.type === "purchase")).toEqual([]);
  });
});

describe("PaywallErrorBoundary", () => {
  it("console.errors, posts a paywall_error event and renders null on a crash", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const posted: PaywallOutboundEnvelope[] = [];

    const Thrower = (): null => {
      throw new Error("boom from paywall");
    };

    const tree = await renderToNodeTree(
      <PaywallErrorBoundary post={(envelope) => posted.push(envelope)}>
        <Thrower />
      </PaywallErrorBoundary>,
    );

    expect(errorSpy).toHaveBeenCalled();
    const events = posted.filter((envelope) => envelope.type === "event");
    expect(events).toEqual([
      {
        version: 1,
        type: "event",
        payload: {
          name: "paywall_error",
          properties: { message: "boom from paywall" },
        },
      },
    ]);
    // The boundary renders null, so the serialized root is the legitimate
    // "render returned null" placeholder — not a crashed reconciler.
    expect(tree.root).toEqual({
      type: "placeholder",
      reason: "render returned null",
    });
  });

  it("renders its children when nothing throws", async () => {
    const posted: PaywallOutboundEnvelope[] = [];
    const tree = await renderToNodeTree(
      <PaywallErrorBoundary post={(envelope) => posted.push(envelope)}>
        {null}
      </PaywallErrorBoundary>,
    );
    expect(posted).toEqual([]);
    expect(tree.root.type).toBe("placeholder");
  });
});
