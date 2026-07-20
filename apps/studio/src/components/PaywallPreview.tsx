import { type PaywallBridge, PaywallRenderer, type PaywallRuntimeConfig } from "@voidhash/paywalls";
import type { ReactNode } from "react";

import type { PaywallEntry } from "../voidhash/paywalls";
import type { PreviewDeviceProfile } from "../voidhash/preview-devices";
import { PhoneFrame } from "./PhoneFrame";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";

export interface PaywallPreviewProps {
  entry: PaywallEntry;
  config: PaywallRuntimeConfig;
  bridge: PaywallBridge;
  profile: PreviewDeviceProfile;
}

/**
 * Renders the selected paywall inside the phone frame using the real
 * `@voidhash/paywalls` DOM renderer — the same code path that runs on a device.
 */
export const PaywallPreview = ({
  entry,
  config,
  bridge,
  profile,
}: PaywallPreviewProps): ReactNode => (
  <PhoneFrame profile={profile}>
    <PreviewErrorBoundary key={entry.id}>
      <PaywallRenderer bridge={bridge} config={config} paywall={entry.definition} />
    </PreviewErrorBoundary>
  </PhoneFrame>
);
