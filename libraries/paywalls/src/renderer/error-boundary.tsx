import { Component, type ReactNode } from "react";

import { postOutboundEnvelope } from "../runtime/bridge";
import { createEventEnvelope, type PaywallOutboundEnvelope } from "../runtime/envelope";

export interface PaywallErrorBoundaryProps {
  /** Posts an outbound envelope; defaults to the production bridge channel. */
  post?: (envelope: PaywallOutboundEnvelope) => void;
  children: ReactNode;
}

interface PaywallErrorBoundaryState {
  failed: boolean;
}

/**
 * Last-resort error boundary around a mounted paywall: a runtime crash is
 * `console.error`-ed AND reported through the bridge as a `paywall_error`
 * event envelope, then the tree renders null — so crashes are observable by
 * the host instead of presenting as a blank WebView with no signal.
 */
export class PaywallErrorBoundary extends Component<
  PaywallErrorBoundaryProps,
  PaywallErrorBoundaryState
> {
  state: PaywallErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PaywallErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    // biome-ignore lint/suspicious/noConsole: deliberate crash signal — the WebView has no other visible failure channel.
    console.error("[voidhash-paywall] paywall render crashed", error);
    const post = this.props.post ?? postOutboundEnvelope;
    post(
      createEventEnvelope("paywall_error", {
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
