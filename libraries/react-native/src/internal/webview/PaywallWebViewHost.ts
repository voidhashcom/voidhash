import { getHostComponent, type HybridRef } from "react-native-nitro-modules";

import type { PaywallWebViewMethods, PaywallWebViewProps } from "../../specs/PaywallWebView.nitro";

// We intentionally use require() to avoid requiring resolveJsonModule in this package tsconfig.
// generated JSON view config type is inferred at runtime.
// oxlint-disable-next-line effect/noDynamicImports -- see the two lines above: the require() avoids turning on `resolveJsonModule` in this package's tsconfig, and the nitrogen-generated JSON view config is only present after codegen, so a static import would break a clean typecheck.
const PaywallWebViewConfig: any = require("../../../nitrogen/generated/shared/json/PaywallWebViewConfig.json");

export const PaywallWebViewHost = getHostComponent<PaywallWebViewProps, PaywallWebViewMethods>(
  "PaywallWebView",
  () => PaywallWebViewConfig,
);

export type PaywallWebViewHostRef = HybridRef<PaywallWebViewProps, PaywallWebViewMethods>;
