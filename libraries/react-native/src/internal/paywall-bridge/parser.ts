import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
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

const ParseErrorCode = Schema.Literals([
  "INVALID_JSON",
  "INVALID_ENVELOPE",
  "UNSUPPORTED_VERSION",
  "UNSUPPORTED_TYPE",
  "INVALID_PAYLOAD",
]);

export class PaywallBridgeParseError extends Schema.TaggedErrorClass<PaywallBridgeParseError>(
  "PaywallBridgeParseError",
)("PaywallBridgeParseError", {
  code: ParseErrorCode,
  message: Schema.String,
  causeValue: Schema.optional(Schema.Unknown),
}) {}

const ACTION_TYPES: readonly PaywallBridgeActionType[] = [
  "ready",
  "close",
  "purchase",
  "restore",
  "openExternal",
  "event",
  "log",
];

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));
const BaseFields = {
  version: Schema.Literal(PAYWALL_BRIDGE_VERSION),
  requestId: Schema.optional(NonEmptyString),
};
const EnvelopeSchema = Schema.Union([
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("ready"),
    payload: Schema.optional(Schema.Struct({ templateVersion: Schema.optional(Schema.String) })),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("close"),
    payload: Schema.optional(Schema.Struct({ reason: Schema.optional(Schema.String) })),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("purchase"),
    payload: Schema.Struct({
      productId: NonEmptyString,
      paywallProductId: Schema.optional(Schema.String),
    }),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("restore"),
    payload: Schema.optional(Schema.Struct({ source: Schema.optional(Schema.String) })),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("openExternal"),
    payload: Schema.Struct({ url: NonEmptyString }),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("event"),
    payload: Schema.Struct({
      name: NonEmptyString,
      properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    }),
  }),
  Schema.Struct({
    ...BaseFields,
    type: Schema.Literal("log"),
    payload: Schema.Struct({
      level: Schema.Literals(["debug", "info", "warn", "error"]),
      message: NonEmptyString,
    }),
  }),
]) satisfies Schema.Schema<PaywallBridgeEnvelope>;

const decodeJson = Schema.decodeEffect(Schema.UnknownFromJsonString);
const decodeEnvelope = Schema.decodeUnknownOption(EnvelopeSchema);

function isRecord(value: unknown): value is Record<string, unknown> {
  return P.isObject(value) && value !== null;
}

function isActionType(value: unknown): value is PaywallBridgeActionType {
  return P.isString(value) && ACTION_TYPES.some((type) => type === value);
}

/** Parse and validate a message received from the paywall bridge. */
export const parsePaywallBridgeEnvelope = Effect.fn("parsePaywallBridgeEnvelope")(function* (
  raw: string,
): Effect.fn.Return<PaywallBridgeEnvelope, PaywallBridgeParseError> {
  const parsed = yield* decodeJson(raw).pipe(
    Effect.mapError(
      (causeValue) =>
        new PaywallBridgeParseError({
          code: "INVALID_JSON",
          message: "Invalid paywall bridge payload: failed to parse JSON",
          causeValue,
        }),
    ),
  );
  if (!isRecord(parsed)) {
    return yield* new PaywallBridgeParseError({
      code: "INVALID_ENVELOPE",
      message: "Invalid paywall bridge payload: expected object envelope",
      causeValue: parsed,
    });
  }
  if (parsed.version !== PAYWALL_BRIDGE_VERSION) {
    return yield* new PaywallBridgeParseError({
      code: "UNSUPPORTED_VERSION",
      message: `Unsupported paywall bridge version: ${String(parsed.version)}`,
      causeValue: parsed.version,
    });
  }
  if (!isActionType(parsed.type)) {
    return yield* new PaywallBridgeParseError({
      code: "UNSUPPORTED_TYPE",
      message: `Unsupported paywall bridge message type: ${String(parsed.type)}`,
      causeValue: parsed.type,
    });
  }
  const actionType = parsed.type;
  return yield* Option.match(decodeEnvelope(parsed), {
    onSome: Effect.succeed,
    onNone: () =>
      new PaywallBridgeParseError({
        code: parsed.requestId === undefined ? "INVALID_PAYLOAD" : "INVALID_ENVELOPE",
        message: `Invalid paywall bridge payload for '${actionType}'`,
        causeValue: parsed,
      }),
  });
});
