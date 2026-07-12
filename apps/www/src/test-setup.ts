/**
 * Test-only environment shim. Component tests that render real designer UI pull
 * in the app's typed env module (`src/lib/env.ts`), which validates
 * `VITE_APP_API_URL` at import. The test runner doesn't load `.env`, so seed a
 * harmless value here BEFORE any app module imports it (setupFiles run first).
 */
process.env.VITE_APP_API_URL ??= "http://localhost:8787";

// jsdom lacks ResizeObserver, which some Radix primitives (Slider, etc.) touch
// on mount. A no-op stub is enough for render/interaction tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
