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

export type PaywallBridgeResponseStatus = "success" | "error";

export interface PaywallBridgeResponseErrorPayload {
  code: string;
  message: string;
}

export interface PaywallBridgeResponseEnvelope {
  version: typeof PAYWALL_BRIDGE_VERSION;
  type: "response";
  requestId?: string;
  payload: {
    action: PaywallBridgeActionType;
    status: PaywallBridgeResponseStatus;
    data?: Record<string, unknown>;
    error?: PaywallBridgeResponseErrorPayload;
  };
}

export function createPaywallBridgeSuccessResponse(
  action: PaywallBridgeActionType,
  requestId?: string,
  data?: Record<string, unknown>
): string {
  const response: PaywallBridgeResponseEnvelope = {
    version: PAYWALL_BRIDGE_VERSION,
    type: "response",
    requestId,
    payload: {
      action,
      status: "success",
      data,
    },
  };

  return JSON.stringify(response);
}

export function createPaywallBridgeErrorResponse(
  action: PaywallBridgeActionType,
  code: string,
  message: string,
  requestId?: string
): string {
  const response: PaywallBridgeResponseEnvelope = {
    version: PAYWALL_BRIDGE_VERSION,
    type: "response",
    requestId,
    payload: {
      action,
      status: "error",
      error: {
        code,
        message,
      },
    },
  };

  return JSON.stringify(response);
}
