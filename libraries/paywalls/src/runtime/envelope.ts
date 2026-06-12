/**
 * The bridge envelope wire format spoken between a rendered paywall (inside a
 * mobile WebView) and the native Voidhash SDK. The normative implementation is
 * `@voidhash/react-native`'s `paywall-bridge/protocol.ts` (envelope
 * `version: 1`); this module mirrors it exactly and adds the two contract §7.2
 * extensions: the outbound `event` action and the inbound `configure` action.
 */
import { normalizeRuntimeConfig, type PaywallRuntimeConfig } from "./config";

/** Bridge envelope wire version. Unchanged in Phase 1. */
export const PAYWALL_BRIDGE_VERSION = 1 as const;

// ── Outbound (paywall → host) ────────────────────────────────────────────────

interface OutboundBase<TType extends string> {
  readonly version: typeof PAYWALL_BRIDGE_VERSION;
  readonly type: TType;
  readonly requestId?: string;
}

export interface PaywallReadyEnvelope extends OutboundBase<"ready"> {
  readonly payload?: { readonly templateVersion?: string };
}

export interface PaywallCloseEnvelope extends OutboundBase<"close"> {
  readonly payload?: { readonly reason?: string };
}

export interface PaywallPurchaseEnvelope extends OutboundBase<"purchase"> {
  readonly payload: {
    readonly productId: string;
    readonly paywallProductId?: string;
  };
}

export interface PaywallRestoreEnvelope extends OutboundBase<"restore"> {
  readonly payload?: { readonly source?: string };
}

export interface PaywallOpenExternalEnvelope
  extends OutboundBase<"openExternal"> {
  readonly payload: { readonly url: string };
}

/** Custom analytics event (contract §7.2; not part of the original protocol). */
export interface PaywallEventEnvelope extends OutboundBase<"event"> {
  readonly payload: {
    readonly name: string;
    readonly properties?: Readonly<Record<string, unknown>>;
  };
}

export interface PaywallLogEnvelope extends OutboundBase<"log"> {
  readonly payload: {
    readonly level: "debug" | "info" | "warn" | "error";
    readonly message: string;
  };
}

export type PaywallOutboundEnvelope =
  | PaywallReadyEnvelope
  | PaywallCloseEnvelope
  | PaywallPurchaseEnvelope
  | PaywallRestoreEnvelope
  | PaywallOpenExternalEnvelope
  | PaywallEventEnvelope
  | PaywallLogEnvelope;

export type PaywallOutboundActionType = PaywallOutboundEnvelope["type"];

// ── Inbound (host → paywall) ─────────────────────────────────────────────────

/** Transaction lifecycle reflected into the paywall by the host. */
export type PaywallTransactionStatus =
  | "idle"
  | "purchasing"
  | "restoring"
  | "purchased"
  | "restored"
  | "cancelled"
  | "failed";

export interface PaywallBridgeError {
  readonly code: string;
  readonly message: string;
}

/** Success/error response to a previously sent action (mirrors protocol.ts). */
export interface PaywallResponseEnvelope {
  readonly version: typeof PAYWALL_BRIDGE_VERSION;
  readonly type: "response";
  readonly requestId?: string;
  readonly payload: {
    readonly action: string;
    readonly status: "success" | "error";
    readonly data?: Readonly<Record<string, unknown>>;
    readonly error?: PaywallBridgeError;
  };
}

/** Direct transaction-status push from the host. */
export interface PaywallStatusEnvelope {
  readonly version: typeof PAYWALL_BRIDGE_VERSION;
  readonly type: "status";
  readonly requestId?: string;
  readonly payload: {
    readonly status: PaywallTransactionStatus;
    readonly productId?: string;
    readonly error?: string;
  };
}

/** Late runtime configuration (contract §7.2). Sent after `ready`. */
export interface PaywallConfigureEnvelope {
  readonly version: typeof PAYWALL_BRIDGE_VERSION;
  readonly type: "configure";
  readonly requestId?: string;
  readonly payload: PaywallRuntimeConfig;
}

export type PaywallInboundEnvelope =
  | PaywallResponseEnvelope
  | PaywallStatusEnvelope
  | PaywallConfigureEnvelope;

// ── Encode ───────────────────────────────────────────────────────────────────

export const createReadyEnvelope = (
  templateVersion?: string,
): PaywallReadyEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "ready",
  ...(templateVersion === undefined ? {} : { payload: { templateVersion } }),
});

export const createCloseEnvelope = (reason?: string): PaywallCloseEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "close",
  ...(reason === undefined ? {} : { payload: { reason } }),
});

export const createPurchaseEnvelope = (
  productId: string,
  requestId?: string,
): PaywallPurchaseEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "purchase",
  requestId,
  payload: { productId },
});

export const createRestoreEnvelope = (
  requestId?: string,
): PaywallRestoreEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "restore",
  requestId,
});

export const createOpenExternalEnvelope = (
  url: string,
): PaywallOpenExternalEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "openExternal",
  payload: { url },
});

export const createEventEnvelope = (
  name: string,
  properties?: Record<string, unknown>,
): PaywallEventEnvelope => ({
  version: PAYWALL_BRIDGE_VERSION,
  type: "event",
  payload: properties === undefined ? { name } : { name, properties },
});

/** Serializes an outbound envelope to its JSON wire form. */
export const serializeEnvelope = (envelope: PaywallOutboundEnvelope): string =>
  JSON.stringify(envelope);

// ── Decode ───────────────────────────────────────────────────────────────────

const TRANSACTION_STATUSES: ReadonlyArray<PaywallTransactionStatus> = [
  "idle",
  "purchasing",
  "restoring",
  "purchased",
  "restored",
  "cancelled",
  "failed",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readRequestId = (value: Record<string, unknown>): string | undefined =>
  typeof value.requestId === "string" && value.requestId.length > 0
    ? value.requestId
    : undefined;

const parseResponse = (
  value: Record<string, unknown>,
): PaywallResponseEnvelope | null => {
  const payload = value.payload;
  if (!isRecord(payload)) {
    return null;
  }
  const { action, status, data, error } = payload;
  if (typeof action !== "string") {
    return null;
  }
  if (status !== "success" && status !== "error") {
    return null;
  }
  const parsedError =
    isRecord(error) &&
    typeof error.code === "string" &&
    typeof error.message === "string"
      ? { code: error.code, message: error.message }
      : undefined;
  return {
    version: PAYWALL_BRIDGE_VERSION,
    type: "response",
    requestId: readRequestId(value),
    payload: {
      action,
      status,
      data: isRecord(data) ? data : undefined,
      error: parsedError,
    },
  };
};

const parseStatus = (
  value: Record<string, unknown>,
): PaywallStatusEnvelope | null => {
  const payload = value.payload;
  if (!isRecord(payload)) {
    return null;
  }
  const status = payload.status;
  if (
    typeof status !== "string" ||
    !TRANSACTION_STATUSES.includes(status as PaywallTransactionStatus)
  ) {
    return null;
  }
  return {
    version: PAYWALL_BRIDGE_VERSION,
    type: "status",
    requestId: readRequestId(value),
    payload: {
      status: status as PaywallTransactionStatus,
      productId:
        typeof payload.productId === "string" ? payload.productId : undefined,
      error: typeof payload.error === "string" ? payload.error : undefined,
    },
  };
};

const parseConfigure = (
  value: Record<string, unknown>,
): PaywallConfigureEnvelope | null => {
  const payload = value.payload;
  if (!isRecord(payload)) {
    return null;
  }
  return {
    version: PAYWALL_BRIDGE_VERSION,
    type: "configure",
    requestId: readRequestId(value),
    payload: normalizeRuntimeConfig(payload as Partial<PaywallRuntimeConfig>),
  };
};

/**
 * Parses a raw inbound message (JSON string or already-parsed object) into a
 * {@link PaywallInboundEnvelope}. Returns `null` for malformed input, unknown
 * versions and unknown actions — the runtime ignores those rather than
 * crashing the paywall.
 */
export const parseInboundEnvelope = (
  raw: unknown,
): PaywallInboundEnvelope | null => {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || value.version !== PAYWALL_BRIDGE_VERSION) {
    return null;
  }
  switch (value.type) {
    case "response":
      return parseResponse(value);
    case "status":
      return parseStatus(value);
    case "configure":
      return parseConfigure(value);
    default:
      return null;
  }
};
