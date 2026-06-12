import type { ReactNode } from "react";

import {
  type PaywallDefinition,
  renderPaywallBody,
} from "../authoring/create-paywall";
import { RendererProvider } from "../primitives/host-context";
import type { HostComponents } from "../primitives/types";
import type { PaywallBridge } from "../runtime/bridge";
import type { PaywallRuntimeConfig } from "../runtime/config";
import { PaywallRuntimeProvider } from "../runtime/runtime";

export interface PaywallRendererProps {
  /** The paywall to render. */
  paywall: PaywallDefinition;
  /**
   * Runtime products/variables. Defaults to the host-injected config (or an
   * empty one), live-updated by `configure` bridge messages.
   */
  config?: PaywallRuntimeConfig;
  /** Override the renderer's host components (e.g. the tree host map). */
  host?: HostComponents;
  /** Override the bridge (Studio/tests inject their own). */
  bridge?: PaywallBridge;
}

/**
 * Renders a {@link PaywallDefinition} into the current React tree. This is the
 * embeddable entry point used by Studio; the deploy bundle uses `mountPaywall`
 * (from `@voidhash/paywalls/dom`) which wraps this in a `createRoot`.
 *
 * It composes the two ambient providers a paywall needs — the renderer
 * registry (defaulting to the DOM host) and the runtime (products, variables,
 * actions, bridge).
 */
export const PaywallRenderer = ({
  paywall,
  config,
  host,
  bridge,
}: PaywallRendererProps): ReactNode => (
  <RendererProvider host={host}>
    <PaywallRuntimeProvider bridge={bridge} config={config}>
      {renderPaywallBody(paywall.render)}
    </PaywallRuntimeProvider>
  </RendererProvider>
);
