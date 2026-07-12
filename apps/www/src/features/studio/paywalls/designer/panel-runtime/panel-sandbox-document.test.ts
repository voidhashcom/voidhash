import { describe, expect, test } from "vite-plus/test";

import { PANEL_SANDBOX_DOCUMENT } from "./panel-sandbox-document";

describe("panel-sandbox-document — CSP + isolation", () => {
  test("declares the locked-down CSP (no network, opaque-origin friendly)", () => {
    expect(PANEL_SANDBOX_DOCUMENT).toContain("Content-Security-Policy");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("default-src 'none'");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("connect-src 'none'");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("style-src 'unsafe-inline'");
  });

  test("evaluates the OSS sandbox IIFE global via the guest bundle", () => {
    // The bootstrap evals the injected bundle and reads the guest global that
    // exposes describeComponent + createPanelSession + the require shim modules.
    expect(PANEL_SANDBOX_DOCUMENT).toContain("__VOIDHASH_PAYWALLS_SANDBOX__");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("describeComponent");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("createPanelSession");
    expect(PANEL_SANDBOX_DOCUMENT).toContain("runtime.modules");
  });

  test("is a LIVE document — it never freezes time / rAF (unlike the preview)", () => {
    // The preview document overrides Date.now / Math.random / requestAnimationFrame
    // for deterministic caching. The panel document must NOT, so timers/effects run.
    expect(PANEL_SANDBOX_DOCUMENT).not.toContain("Date.now = function");
    expect(PANEL_SANDBOX_DOCUMENT).not.toContain("Math.random = function");
    expect(PANEL_SANDBOX_DOCUMENT).not.toContain("window.requestAnimationFrame = function () { return");
  });

  test("speaks the panel protocol (init/update/event/ping/unmount, ready/tree/pong)", () => {
    for (const type of [
      "panel/init",
      "panel/update",
      "panel/event",
      "panel/ping",
      "panel/unmount",
      "panel/ready",
      "panel/tree",
      "panel/pong",
      "panel/intent",
      "panel/error",
    ]) {
      expect(PANEL_SANDBOX_DOCUMENT).toContain(type);
    }
  });

  test("contains no unescaped template-literal hazards", () => {
    // The bootstrap must embed safely in a template literal (no backticks / ${).
    const body = PANEL_SANDBOX_DOCUMENT;
    expect(body.includes("`")).toBe(false);
    expect(body.includes("${")).toBe(false);
  });
});
