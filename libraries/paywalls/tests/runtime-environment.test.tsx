// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  normalizeRuntimeConfig,
  type PaywallBridge,
  type PaywallInboundEnvelope,
  PaywallRuntimeProvider,
  useDimensions,
  usePlatform,
  useSafeAreaInsets,
} from "../src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

interface HookSnapshot {
  readonly platform: ReturnType<typeof usePlatform>;
  readonly safeAreaInsets: ReturnType<typeof useSafeAreaInsets>;
  readonly screen: ReturnType<typeof useDimensions>;
  readonly window: ReturnType<typeof useDimensions>;
}

const setWindowNumber = (name: string, value: number): void => {
  Object.defineProperty(window, name, { configurable: true, value });
};

const setScreenNumber = (name: string, value: number): void => {
  Object.defineProperty(window.screen, name, { configurable: true, value });
};

const setSafeAreaCss = (top: number, right: number, bottom: number, left: number): void => {
  const style = document.documentElement.style;
  style.setProperty("--voidhash-safe-area-top", `${top}px`);
  style.setProperty("--voidhash-safe-area-right", `${right}px`);
  style.setProperty("--voidhash-safe-area-bottom", `${bottom}px`);
  style.setProperty("--voidhash-safe-area-left", `${left}px`);
};

describe("runtime environment hooks", () => {
  let root: Root;
  let container: HTMLDivElement;
  let inboundListener: ((envelope: PaywallInboundEnvelope) => void) | undefined;
  const visualViewport = new EventTarget();
  const bridge: PaywallBridge = {
    post: () => {},
    subscribe: (listener) => {
      inboundListener = listener;
      return () => {
        inboundListener = undefined;
      };
    },
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });
    setScreenNumber("width", 1024);
    setScreenNumber("height", 768);
    setWindowNumber("innerWidth", 800);
    setWindowNumber("innerHeight", 600);
    setWindowNumber("screenX", -20);
    setWindowNumber("screenY", 30);
    setSafeAreaCss(12, 3, 18, 4);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.documentElement.removeAttribute("style");
    inboundListener = undefined;
  });

  it("measures browser metrics and refreshes on layout and viewport events", () => {
    const snapshots: HookSnapshot[] = [];
    const Probe = (): ReactNode => {
      const snapshot = {
        platform: usePlatform(),
        safeAreaInsets: useSafeAreaInsets(),
        screen: useDimensions("screen"),
        window: useDimensions("window"),
      };
      snapshots.push(snapshot);
      return <output>{JSON.stringify(snapshot)}</output>;
    };

    act(() => {
      root.render(
        <PaywallRuntimeProvider bridge={bridge} config={{ products: [], variables: {} }}>
          <Probe />
        </PaywallRuntimeProvider>,
      );
    });

    expect(snapshots.at(-1)).toEqual({
      platform: "web",
      safeAreaInsets: { top: 12, right: 3, bottom: 18, left: 4 },
      screen: { width: 1024, height: 768, x: 0, y: 0 },
      window: { width: 800, height: 600, x: -20, y: 30 },
    });

    const renderCount = snapshots.length;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(snapshots).toHaveLength(renderCount);

    setWindowNumber("innerWidth", 640);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(snapshots.at(-1)?.window.width).toBe(640);

    setScreenNumber("height", 1024);
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
    expect(snapshots.at(-1)?.screen.height).toBe(1024);

    setSafeAreaCss(24, 0, 20, 0);
    act(() => {
      visualViewport.dispatchEvent(new Event("scroll"));
    });
    expect(snapshots.at(-1)?.safeAreaInsets).toEqual({
      top: 24,
      right: 0,
      bottom: 20,
      left: 0,
    });
  });

  it("applies late configured native metrics and removes browser observation", () => {
    let latest: HookSnapshot | undefined;
    const Probe = (): ReactNode => {
      latest = {
        platform: usePlatform(),
        safeAreaInsets: useSafeAreaInsets(),
        screen: useDimensions("screen"),
        window: useDimensions("window"),
      };
      return null;
    };

    act(() => {
      root.render(
        <PaywallRuntimeProvider bridge={bridge} config={{ products: [], variables: {} }}>
          <Probe />
        </PaywallRuntimeProvider>,
      );
    });
    expect(document.documentElement.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);

    act(() => {
      inboundListener?.({
        version: 1,
        type: "configure",
        payload: normalizeRuntimeConfig({
          products: [],
          variables: {},
          platform: "android",
          safeAreaInsets: { top: 24, right: 0, bottom: 24, left: 0 },
          dimensions: {
            screen: { width: 412, height: 915, x: 0, y: 0 },
            window: { width: 400, height: 820, x: 6, y: 48 },
          },
        }),
      });
    });

    expect(latest).toEqual({
      platform: "android",
      safeAreaInsets: { top: 24, right: 0, bottom: 24, left: 0 },
      screen: { width: 412, height: 915, x: 0, y: 0 },
      window: { width: 400, height: 820, x: 6, y: 48 },
    });
    expect(document.documentElement.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it("uses the measured screen rectangle for both native targets when dimensions are absent", () => {
    let latest: HookSnapshot | undefined;
    const Probe = (): ReactNode => {
      latest = {
        platform: usePlatform(),
        safeAreaInsets: useSafeAreaInsets(),
        screen: useDimensions("screen"),
        window: useDimensions("window"),
      };
      return null;
    };

    act(() => {
      root.render(
        <PaywallRuntimeProvider
          bridge={bridge}
          config={{
            products: [],
            variables: {},
            platform: "ios",
            safeAreaInsets: { top: 20, right: 0, bottom: 0, left: 0 },
          }}
        >
          <Probe />
        </PaywallRuntimeProvider>,
      );
    });

    expect(latest?.screen).toEqual({ width: 1024, height: 768, x: 0, y: 0 });
    expect(latest?.window).toEqual(latest?.screen);
  });
});
