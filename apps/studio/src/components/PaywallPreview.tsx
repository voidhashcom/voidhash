import { type PaywallBridge, PaywallRenderer, type PaywallRuntimeConfig } from "@voidhash/paywalls";
import type { ReactNode } from "react";

import type { PaywallEntry } from "../voidhash/paywalls";
import { PhoneFrame } from "./PhoneFrame";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";

export interface PaywallPreviewProps {
  entry: PaywallEntry;
  config: PaywallRuntimeConfig;
  bridge: PaywallBridge;
}

/**
 * Renders the selected paywall inside the phone frame using the real
 * `@voidhash/paywalls` DOM renderer — the same code path that runs on a device.
 */
export const PaywallPreview = ({ entry, config, bridge }: PaywallPreviewProps): ReactNode => (
  <PhoneFrame>
    <PreviewErrorBoundary key={entry.id}>
      <PaywallRenderer bridge={bridge} config={config} paywall={entry.definition} />
    </PreviewErrorBoundary>
  </PhoneFrame>
);
