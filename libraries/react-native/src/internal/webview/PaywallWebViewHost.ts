import { getHostComponent, type HybridRef } from "react-native-nitro-modules";

import type { PaywallWebViewMethods, PaywallWebViewProps } from "../../specs/PaywallWebView.nitro";

// We intentionally use require() to avoid requiring resolveJsonModule in this package tsconfig.
// biome-ignore lint/suspicious/noExplicitAny: generated JSON view config type is inferred at runtime.
const PaywallWebViewConfig: any = require("../../../nitrogen/generated/shared/json/PaywallWebViewConfig.json");

export const PaywallWebViewHost = getHostComponent<PaywallWebViewProps, PaywallWebViewMethods>(
  "PaywallWebView",
  () => PaywallWebViewConfig,
);

export type PaywallWebViewHostRef = HybridRef<PaywallWebViewProps, PaywallWebViewMethods>;
