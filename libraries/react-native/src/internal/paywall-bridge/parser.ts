import {
  PAYWALL_BRIDGE_VERSION,
  type PaywallBridgeActionType,
  type PaywallBridgeEnvelope,
} from "./protocol";

export type PaywallBridgeParseErrorCode =
  | "INVALID_JSON"
  | "INVALID_ENVELOPE"
  | "UNSUPPORTED_VERSION"
  | "UNSUPPORTED_TYPE"
  | "INVALID_PAYLOAD";

export class PaywallBridgeParseError extends Error {
  constructor(
    readonly code: PaywallBridgeParseErrorCode,
    message: string,
    readonly causeValue?: unknown
  ) {
    super(message);
    this.name = "PaywallBridgeParseError";
  }
}

const ACTION_TYPES: PaywallBridgeActionType[] = [
  "ready",
  "close",
  "purchase",
  "restore",
  "openExternal",
  "log",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredString(
  value: unknown,
  fieldName: string,
  type: PaywallBridgeActionType
): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new PaywallBridgeParseError(
    "INVALID_PAYLOAD",
    `Invalid paywall bridge payload for '${type}': '${fieldName}' must be a non-empty string`,
    value
  );
}

function validatePayload(
  type: PaywallBridgeActionType,
  payload: unknown
): void {
  if (payload === undefined || payload === null) {
    if (type === "purchase" || type === "openExternal" || type === "log") {
      throw new PaywallBridgeParseError(
        "INVALID_PAYLOAD",
        `Invalid paywall bridge payload for '${type}': payload is required`
      );
    }
    return;
  }

  if (!isRecord(payload)) {
    throw new PaywallBridgeParseError(
      "INVALID_PAYLOAD",
      `Invalid paywall bridge payload for '${type}': payload must be an object`,
      payload
    );
  }

  if (type === "purchase") {
    getRequiredString(payload.productId, "productId", type);
    return;
  }

  if (type === "openExternal") {
    getRequiredString(payload.url, "url", type);
    return;
  }

  if (type === "log") {
    const level = payload.level;
    const message = payload.message;

    if (
      level !== "debug" &&
      level !== "info" &&
      level !== "warn" &&
      level !== "error"
    ) {
      throw new PaywallBridgeParseError(
        "INVALID_PAYLOAD",
        "Invalid paywall bridge payload for 'log': 'level' must be debug|info|warn|error",
        level
      );
    }

    getRequiredString(message, "message", type);
  }
}

export function parsePaywallBridgeEnvelope(raw: string): PaywallBridgeEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new PaywallBridgeParseError(
      "INVALID_JSON",
      "Invalid paywall bridge payload: failed to parse JSON",
      error
    );
  }

  if (!isRecord(parsed)) {
    throw new PaywallBridgeParseError(
      "INVALID_ENVELOPE",
      "Invalid paywall bridge payload: expected object envelope",
      parsed
    );
  }

  if (parsed.version !== PAYWALL_BRIDGE_VERSION) {
    throw new PaywallBridgeParseError(
      "UNSUPPORTED_VERSION",
      `Unsupported paywall bridge version: ${String(parsed.version)}`,
      parsed.version
    );
  }

  if (!ACTION_TYPES.includes(parsed.type as PaywallBridgeActionType)) {
    throw new PaywallBridgeParseError(
      "UNSUPPORTED_TYPE",
      `Unsupported paywall bridge message type: ${String(parsed.type)}`,
      parsed.type
    );
  }

  if (
    parsed.requestId !== undefined &&
    (typeof parsed.requestId !== "string" || parsed.requestId.length === 0)
  ) {
    throw new PaywallBridgeParseError(
      "INVALID_ENVELOPE",
      "Invalid paywall bridge payload: 'requestId' must be a non-empty string when present",
      parsed.requestId
    );
  }

  const type = parsed.type as PaywallBridgeActionType;
  validatePayload(type, parsed.payload);

  return parsed as unknown as PaywallBridgeEnvelope;
}
