import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { VoidhashError, type VoidhashErrorCode } from "../../errors";
import type { FlowActions, FlowInput, FlowOutcome, FlowOutput } from "../schema/registry";

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

/**
 * Which flow runtime draws flows, for the whole app process.
 *
 * - `linked`: the runtime built into the SDK (the default).
 * - `module`: the flow runtime module each flow names, which the SDK
 *   downloads once, verifies and caches, so flows can use flow editor
 *   features newer than the SDK. Not yet recommended for production.
 */
export type FlowRuntime = "linked" | "module";

/** Capabilities granted when `flowCapabilities` is not set. */
export const DEFAULT_FLOW_CAPABILITIES: ReadonlyArray<FlowCapability> = ["links"];

/** Codes of the errors a failed flow presentation carries. */
export type FlowErrorCode = Extract<VoidhashErrorCode, `FLOW_${string}`>;

/**
 * How a presented flow ended.
 *
 * - `outcome`: `purchased` when a purchase ended the flow, `restored` when a
 *   restore did, `dismissed` when the user or the app closed it or another
 *   flow replaced it; otherwise the outcome the flow finished with.
 * - `output`: the flow's outputs by name; empty when it declares none.
 * - `productId`: the store product bought, when the outcome is `purchased`.
 *
 * A flow that could not be presented is not a result: `presentFlow()` rejects.
 */
export interface FlowResult<L extends string = string> {
  readonly outcome: FlowOutcome<L>;
  readonly output: FlowOutput<L>;
  readonly productId?: string;
}

type RequiredWhenNotEmpty<Key extends string, Value> =
  Record<never, never> extends Value
    ? { readonly [K in Key]?: Value }
    : { readonly [K in Key]: Value };

/**
 * What an app passes to one presentation of the flow at location `L`.
 *
 * - `input`: the flow's inputs by name.
 * - `actions`: a handler per app action the flow can call.
 * - `revision`: the interface revision the app was built against. Leave it
 *   out to use the one set for the location in the `flowRevisions` option.
 */
export type PresentFlowOptions<L extends string = string> = {
  readonly revision?: number;
} & RequiredWhenNotEmpty<"input", FlowInput<L>> &
  RequiredWhenNotEmpty<"actions", FlowActions<L>>;

/**
 * The arguments of a presentation after its location: the options are
 * required when the location's flow has required inputs or app actions.
 */
export type PresentFlowArguments<L extends string = string> =
  Record<never, never> extends PresentFlowOptions<L>
    ? [options?: PresentFlowOptions<L>]
    : [options: PresentFlowOptions<L>];

/** The error a presentation that could not be shown rejects with. */
export const flowError = (code: FlowErrorCode, message: string): VoidhashError =>
  new VoidhashError(code, `${code}: ${message}`);

const NativeFlowValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String),
]);

const NativeFlowResult = Schema.Union([
  Schema.Struct({
    outcome: Schema.String,
    output: Schema.Record(Schema.String, NativeFlowValue),
    productId: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    failure: Schema.Struct({
      code: Schema.Literals([
        "FLOW_DISABLED",
        "FLOW_NOT_ASSIGNED",
        "FLOW_UNAVAILABLE",
        "FLOW_RENDERER_MISSING",
        "FLOW_UNSUPPORTED_PACKAGE",
        "FLOW_PRESENTATION_FAILED",
      ]),
      message: Schema.String,
    }),
  }),
]);

const decodeNativeFlowResult = Schema.decodeUnknownResult(Schema.fromJsonString(NativeFlowResult));

/**
 * Reads the answer of the native coordinator: how the flow ended, or the
 * error of a flow that could not be presented. An answer this SDK does not
 * understand (a native module from another SDK version) is such an error too.
 */
export const parseFlowResult = (json: string): Result.Result<FlowResult, VoidhashError> => {
  const decoded = decodeNativeFlowResult(json);
  if (Result.isFailure(decoded)) {
    return Result.fail(flowError("FLOW_PRESENTATION_FAILED", `unreadable flow result ${json}`));
  }
  const native = decoded.success;
  // The native message already starts with its code.
  if ("failure" in native) {
    return Result.fail(new VoidhashError(native.failure.code, native.failure.message));
  }
  return Result.succeed({
    outcome: native.outcome,
    output: native.output,
    ...(native.productId === undefined ? {} : { productId: native.productId }),
  });
};
