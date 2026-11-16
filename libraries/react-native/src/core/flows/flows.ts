import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { VoidhashError, type VoidhashErrorCode } from "../../errors";

/**
 * What an app lets its flows do, granted at SDK setup. Purchases, restores,
 * closing and analytics need no grant; an action needing a capability the
 * app did not grant is dropped with a warning.
 *
 * - `notifications`: ask the user to allow notifications.
 * - `tracking`: ask the user to allow tracking (App Tracking Transparency on iOS).
 * - `attributes`: set attributes on the current person.
 * - `links`: open links outside the app.
 */
export type FlowCapability = "notifications" | "tracking" | "attributes" | "links";

/** Capabilities granted when `flowCapabilities` is not set. */
export const DEFAULT_FLOW_CAPABILITIES: ReadonlyArray<FlowCapability> = ["links"];

/** Codes of the errors a failed flow presentation carries. */
export type FlowErrorCode = Extract<VoidhashErrorCode, `FLOW_${string}`>;

/**
 * How a presented flow ended.
 *
 * - `finished`: the flow reached one of its finish actions. `result` is the
 *   finish action's result name; `variables` are the flow's variables then.
 * - `purchased`: a purchase started from the flow completed and the flow was
 *   dismissed; `productSlug` names the product bought.
 * - `restored`: a restore started from the flow completed and the flow was dismissed.
 * - `closed`: the user or the app closed the flow, or another flow replaced it.
 * - `failed`: the flow could not be presented; `error.code` says why.
 */
export type FlowResult =
  | { status: "finished"; result: string; variables: Record<string, unknown> }
  | { status: "purchased"; productSlug: string }
  | { status: "restored" }
  | { status: "closed" }
  | { status: "failed"; error: VoidhashError };

/** A failed presentation. */
export const flowFailure = (code: FlowErrorCode, message: string): FlowResult => ({
  error: new VoidhashError(code, `${code}: ${message}`),
  status: "failed",
});

const NativeFlowResult = Schema.Union([
  Schema.Struct({
    result: Schema.String,
    status: Schema.Literal("finished"),
    variables: Schema.Record(Schema.String, Schema.Unknown),
  }),
  Schema.Struct({ productSlug: Schema.String, status: Schema.Literal("purchased") }),
  Schema.Struct({ status: Schema.Literal("restored") }),
  Schema.Struct({ status: Schema.Literal("closed") }),
  Schema.Struct({
    code: Schema.Literals([
      "FLOW_DISABLED",
      "FLOW_NOT_ASSIGNED",
      "FLOW_UNAVAILABLE",
      "FLOW_RENDERER_MISSING",
      "FLOW_UNSUPPORTED_PACKAGE",
      "FLOW_PRESENTATION_FAILED",
    ]),
    message: Schema.String,
    status: Schema.Literal("failed"),
  }),
]);

const decodeNativeFlowResult = Schema.decodeUnknownResult(Schema.fromJsonString(NativeFlowResult));

/**
 * Reads the result the native coordinator reported. An answer this SDK does
 * not understand (a native module from another SDK version) is a failed
 * presentation rather than an exception.
 */
export const parseFlowResult = (json: string): FlowResult => {
  const decoded = decodeNativeFlowResult(json);
  if (Result.isFailure(decoded)) {
    return flowFailure("FLOW_PRESENTATION_FAILED", `unreadable flow result ${json}`);
  }
  return Match.value(decoded.success).pipe(
    Match.discriminatorsExhaustive("status")({
      closed: (): FlowResult => ({ status: "closed" }),
      // The native message already starts with its code.
      failed: (native): FlowResult => ({
        error: new VoidhashError(native.code, native.message),
        status: "failed",
      }),
      finished: (native): FlowResult => ({
        result: native.result,
        status: "finished",
        variables: { ...native.variables },
      }),
      purchased: (native): FlowResult => ({
        productSlug: native.productSlug,
        status: "purchased",
      }),
      restored: (): FlowResult => ({ status: "restored" }),
    }),
  );
};
