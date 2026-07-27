export const PAYWALL_BRIDGE_VERSION = 1 as const;

/**
 * Serializes to JSON with every non-ASCII code unit escaped as `\uXXXX`.
 * The native presenters deliver inbound messages by base64-encoding the UTF-8
 * JSON and decoding it in the page with `atob`, which yields one Latin-1
 * character per byte — multi-byte UTF-8 sequences (localized prices like
 * "59,99 €", accented product names, author variables) would arrive as
 * mojibake. Escaping per code unit keeps the wire payload pure ASCII and is
 * surrogate-pair-safe (each half of an astral pair escapes independently and
 * `JSON.parse` reassembles them).
 */
const toAsciiSafeJson = (value: unknown): string =>
  JSON.stringify(value).replace(
    /[\u0080-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

export type PaywallBridgeActionType =
  | "ready"
  | "close"
  | "purchase"
  | "restore"
  | "openExternal"
  | "event"
  | "log";

export interface PaywallBridgeBaseEnvelope<TType extends PaywallBridgeActionType> {
  version: typeof PAYWALL_BRIDGE_VERSION;
  type: TType;
  requestId?: string;
}

export interface PaywallBridgeReadyEnvelope extends PaywallBridgeBaseEnvelope<"ready"> {
  payload?: {
    templateVersion?: string;
  };
}

export interface PaywallBridgeCloseEnvelope extends PaywallBridgeBaseEnvelope<"close"> {
  payload?: {
    reason?: string;
  };
}

export interface PaywallBridgePurchaseEnvelope extends PaywallBridgeBaseEnvelope<"purchase"> {
  payload: {
    productId: string;
    paywallProductId?: string;
  };
}

export interface PaywallBridgeRestoreEnvelope extends PaywallBridgeBaseEnvelope<"restore"> {
  payload?: {
    source?: string;
  };
}

export interface PaywallBridgeOpenExternalEnvelope extends PaywallBridgeBaseEnvelope<"openExternal"> {
  payload: {
    url: string;
  };
}

/**
 * Custom analytics event emitted by a paywall bundle (deploy-contract §7.2).
 * Fire-and-forget: the SDK routes it to analytics capture and never sends a
 * response envelope.
 */
export interface PaywallBridgeEventEnvelope extends PaywallBridgeBaseEnvelope<"event"> {
  payload: {
    name: string;
    properties?: Record<string, unknown>;
  };
}

export interface PaywallBridgeLogEnvelope extends PaywallBridgeBaseEnvelope<"log"> {
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
  | PaywallBridgeEventEnvelope
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
  data?: Record<string, unknown>,
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

  return toAsciiSafeJson(response);
}

/** Billing period of a {@link PaywallRuntimeConfigProduct} (contract §7.1). */
export type PaywallRuntimeConfigProductPeriod = "month" | "year" | "week" | "lifetime";

/**
 * A purchasable product surfaced to a paywall bundle, per deploy-contract
 * §7.1. Built by mapping the release's product slugs through the native store
 * metadata (StoreKit / Play Billing) — `priceString` is the locale-correct
 * formatted price from the store.
 */
export interface PaywallRuntimeConfigProduct {
  id: string;
  slug: string;
  displayName: string;
  description?: string;
  price?: number;
  priceString: string;
  currencyCode?: string;
  period?: PaywallRuntimeConfigProductPeriod;
  trialPeriod?: string;
}

/**
 * Everything a code-release paywall bundle needs at runtime beyond its own
 * React tree (deploy-contract §7.1). Delivered late via a `configure`
 * envelope after the bundle's `ready` event.
 */
export interface PaywallRuntimeConfig {
  products: PaywallRuntimeConfigProduct[];
  variables: Readonly<Record<string, string | number | boolean>>;
  locale?: string;
  platform?: "ios" | "android" | "web";
  defaultSelectedProductId?: string;
}

/**
 * Inbound (native → paywall) `configure` envelope (deploy-contract §7.2).
 * Not part of {@link PaywallBridgeEnvelope} on purpose: like `response`, it
 * only travels native → WebView and is never parsed by
 * `parsePaywallBridgeEnvelope`.
 */
export interface PaywallBridgeConfigureEnvelope {
  version: typeof PAYWALL_BRIDGE_VERSION;
  type: "configure";
  requestId?: string;
  payload: PaywallRuntimeConfig;
}

export function createPaywallBridgeErrorResponse(
  action: PaywallBridgeActionType,
  code: string,
  message: string,
  requestId?: string,
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

  return toAsciiSafeJson(response);
}

/**
 * Serializes a `configure` envelope carrying the runtime config, ready to be
 * delivered to the WebView via `PaywallPresenter.postMessage`.
 */
export function createPaywallBridgeConfigureMessage(
  config: PaywallRuntimeConfig,
  requestId?: string,
): string {
  const envelope: PaywallBridgeConfigureEnvelope = {
    version: PAYWALL_BRIDGE_VERSION,
    type: "configure",
    requestId,
    payload: config,
  };

  return toAsciiSafeJson(envelope);
}
