export const PAYWALL_BRIDGE_VERSION = 1 as const;

export type PaywallBridgeActionType =
  | "ready"
  | "close"
  | "purchase"
  | "restore"
  | "openExternal"
  | "log";

export interface PaywallBridgeBaseEnvelope<TType extends PaywallBridgeActionType> {
  version: typeof PAYWALL_BRIDGE_VERSION;
  type: TType;
  requestId?: string;
}

export interface PaywallBridgeReadyEnvelope
  extends PaywallBridgeBaseEnvelope<"ready"> {
  payload?: {
    templateVersion?: string;
  };
}

export interface PaywallBridgeCloseEnvelope
  extends PaywallBridgeBaseEnvelope<"close"> {
  payload?: {
    reason?: string;
  };
}

export interface PaywallBridgePurchaseEnvelope
  extends PaywallBridgeBaseEnvelope<"purchase"> {
  payload: {
    productId: string;
    paywallProductId?: string;
  };
}

export interface PaywallBridgeRestoreEnvelope
  extends PaywallBridgeBaseEnvelope<"restore"> {
  payload?: {
    source?: string;
  };
}

export interface PaywallBridgeOpenExternalEnvelope
  extends PaywallBridgeBaseEnvelope<"openExternal"> {
  payload: {
    url: string;
  };
}

export interface PaywallBridgeLogEnvelope
  extends PaywallBridgeBaseEnvelope<"log"> {
  payload: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
  };
}

export type PaywallBridgeEnvelope =
  | PaywallBridgeReadyEnvelope
  | PaywallBridgeCloseEnvelope
  | PaywallBridgePurchaseEnvelope
  | PaywallBridgeRestoreEnvelope
  | PaywallBridgeOpenExternalEnvelope
  | PaywallBridgeLogEnvelope;
