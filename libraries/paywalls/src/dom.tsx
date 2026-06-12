/**
 * `@voidhash/paywalls/dom` — the web mount entry point.
 *
 * Where the main entry exposes the platform-agnostic `PaywallRenderer`
 * component, this module owns the one web-specific concern: committing a
 * paywall to a real DOM container via `react-dom`. The deployed WebView bundle
 * calls {@link mountPaywall}.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { PaywallDefinition } from "./authoring/create-paywall";
import { PaywallErrorBoundary } from "./renderer/error-boundary";
import { PaywallRenderer } from "./renderer/paywall-renderer";
import type { PaywallBridge } from "./runtime/bridge";
import type { PaywallRuntimeConfig } from "./runtime/config";

export interface MountPaywallOptions {
  /**
   * Runtime config (products/variables). When omitted the runtime reads the
   * host-injected `window.__VOIDHASH_PAYWALL__` (or starts empty) and applies
   * `configure` bridge messages as they arrive — contract §7.1.
   */
  config?: PaywallRuntimeConfig;
  /** Override the bridge (mainly for tests/preview). */
  bridge?: PaywallBridge;
  /** Wrap in `StrictMode`. Defaults to `false` for production parity. */
  strict?: boolean;
}

/** A handle to an active paywall mount. */
export interface PaywallMount {
  /** Unmounts the paywall and releases the React root. */
  unmount: () => void;
}

/**
 * Mounts a paywall into a DOM container and returns a handle. This is the
 * entry point the generated deploy bundle invokes:
 *
 * ```ts
 * import paywall from "./paywall";
 * import { mountPaywall } from "@voidhash/paywalls/dom";
 * mountPaywall(paywall, document.getElementById("root")!);
 * ```
 */
export const mountPaywall = (
  paywall: PaywallDefinition,
  container: Element | DocumentFragment,
  options: MountPaywallOptions = {},
): PaywallMount => {
  const root: Root = createRoot(container);

  const tree = (
    <PaywallErrorBoundary post={options.bridge?.post}>
      <PaywallRenderer
        bridge={options.bridge}
        config={options.config}
        paywall={paywall}
      />
    </PaywallErrorBoundary>
  );

  root.render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);

  return { unmount: () => root.unmount() };
};

export { domHostComponents } from "./renderer/dom-host";
export {
  PaywallErrorBoundary,
  type PaywallErrorBoundaryProps,
} from "./renderer/error-boundary";
export {
  PaywallRenderer,
  type PaywallRendererProps,
} from "./renderer/paywall-renderer";
