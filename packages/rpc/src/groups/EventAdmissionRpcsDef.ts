import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import { RpcEventAdmissionServiceError } from "../errors/EventAdmission.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** One built-in event entry resolved against a project's stored overrides. */
export const BuiltinEventAdmission = Schema.Struct({
  /** The edition's code default, shown when the project has no override. */
  defaultEnabled: Schema.Boolean,
  description: Schema.String,
  /** Effective state: `override ?? defaultEnabled`. */
  enabled: Schema.Boolean,
  /** Every event name this entry admits (the revenue entry covers 19). */
  eventNames: Schema.Array(Schema.String),
  key: Schema.String,
  name: Schema.String,
  /** The project's explicit override, or `null` when falling back to the default. */
  override: Schema.NullOr(Schema.Boolean),
  /** Rendered inline in settings when turning the entry off breaks a feature. */
  warning: Schema.NullOr(Schema.String),
});

/** A project's complete event admission policy. */
export const EventAdmissionPolicy = Schema.Struct({
  builtinEvents: Schema.Array(BuiltinEventAdmission),
  customEventBlocklist: Schema.Array(Schema.String),
});

const policyError = Schema.Union([RpcEventAdmissionServiceError, RpcActionForbiddenError]);

/**
 * Read and write the per-project event admission policy backing the project's
 * Events settings page. Built-in (`$`-prefixed) events are opt-in toggles over a
 * code registry; custom events are allowed by default and turned off by name.
 */
export class EventAdmissionRpcsDef extends RpcGroup.make(
  Rpc.make("GetEventAdmissionPolicy", {
    error: policyError,
    payload: { projectId: Schema.String },
    success: EventAdmissionPolicy,
  }),
  Rpc.make("SetBuiltinEventAdmission", {
    error: policyError,
    payload: {
      enabled: Schema.Boolean,
      key: Schema.String,
      projectId: Schema.String,
    },
    success: EventAdmissionPolicy,
  }),
  Rpc.make("SetCustomEventBlocked", {
    error: policyError,
    payload: {
      blocked: Schema.Boolean,
      eventName: Schema.String,
      projectId: Schema.String,
    },
    success: EventAdmissionPolicy,
  }),
).middleware(AuthMiddleware) {}
