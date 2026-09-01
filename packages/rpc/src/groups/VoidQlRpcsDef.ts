/**
 * The VoidQL RPC group (docs/analytics-access-layer.html §13): `RunVoidQlQuery`,
 * `ValidateVoidQlQuery`, `GetVoidQlSchema`, `SaveVoidQlInsight`. The client always
 * sends VoidQL *text* — no SQL ever crosses the wire pre-compiled, and there is no
 * `organizationId`-scoped filter or `SETTINGS` field for a caller to influence
 * tenant scope. Guarded by {@link AuthMiddleware}.
 */
import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { constant } from "@voidhash/lib/lang";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcVoidQlComplexityError,
  RpcVoidQlExecutionError,
  RpcVoidQlPiiError,
  RpcVoidQlSchemaError,
  RpcVoidQlSyntaxError,
  RpcVoidQlUnknownFieldError,
  RpcVoidQlUnsupportedError,
} from "../errors/voidql.ts";

import { AuthMiddleware } from "../middlewares.ts";

/**
 * VoidQL query text, length-bounded at the wire so a multi-MB string literal or
 * comment — which the lexer's MAX_TOKENS cap counts as a single token and would
 * otherwise wave through — can't drive worker CPU/memory before compilation.
 */
const VoidQlQueryText = Schema.String.check(Schema.isMaxLength(50_000));

/** A result column descriptor (name + resolved logical type). */
export const VoidQlColumn = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
});
export type VoidQlColumn = typeof VoidQlColumn.Type;

/** One result row — arbitrary JSON keyed by the projected column names. */
export const VoidQlRow = Schema.Record(Schema.String, Schema.Unknown);
export type VoidQlRow = typeof VoidQlRow.Type;

/** A span-precise compile diagnostic (the agent repair-loop / editor caret currency). */
export const VoidQlDiagnostic = Schema.Struct({
  stage: Schema.String,
  code: Schema.String,
  message: Schema.String,
  hint: Schema.optional(Schema.String),
});
export type VoidQlDiagnostic = typeof VoidQlDiagnostic.Type;

export const RunVoidQlQueryRequest = Schema.Struct({
  organizationId: Schema.String,
  text: VoidQlQueryText,
});
export type RunVoidQlQueryRequest = typeof RunVoidQlQueryRequest.Type;
export type RunVoidQlQueryRequestType = typeof RunVoidQlQueryRequest.Type;

export const RunVoidQlQueryResponse = Schema.Struct({
  columns: Schema.Array(VoidQlColumn),
  rows: Schema.Array(VoidQlRow),
});
export type RunVoidQlQueryResponse = typeof RunVoidQlQueryResponse.Type;

export const ValidateVoidQlQueryResponse = Schema.Struct({
  isValid: Schema.Boolean,
  columns: Schema.optional(Schema.Array(VoidQlColumn)),
  diagnostic: Schema.optional(VoidQlDiagnostic),
}).pipe(Schema.encodeKeys({ isValid: "valid" }));
export type ValidateVoidQlQueryResponse = typeof ValidateVoidQlQueryResponse.Type;

export const GetVoidQlSchemaResponse = Schema.Struct({
  dialect: Schema.String,
  tables: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      columns: Schema.Array(
        Schema.Struct({
          name: Schema.String,
          type: Schema.String,
          isPii: Schema.Boolean,
          doc: Schema.String,
        }).pipe(Schema.encodeKeys({ isPii: "pii" })),
      ),
      namespaces: Schema.Array(
        Schema.Struct({ name: Schema.String, isPii: Schema.Boolean, doc: Schema.String }).pipe(
          Schema.encodeKeys({ isPii: "pii" }),
        ),
      ),
    }),
  ),
  functions: Schema.Array(Schema.String),
});
export type GetVoidQlSchemaResponse = typeof GetVoidQlSchemaResponse.Type;

export const SaveVoidQlInsightRequest = Schema.Struct({
  organizationId: Schema.String,
  name: Schema.String.check(Schema.isMaxLength(255)),
  text: VoidQlQueryText,
});
export type SaveVoidQlInsightRequest = typeof SaveVoidQlInsightRequest.Type;

export const SaveVoidQlInsightResponse = Schema.Struct({ id: Schema.String });
export type SaveVoidQlInsightResponse = typeof SaveVoidQlInsightResponse.Type;

export const SavedVoidQlInsight = Schema.Struct({
  createdAt: Schema.Date,
  createdBy: Schema.String,
  id: Schema.String,
  name: Schema.String,
  organizationId: Schema.String,
  schemaVersion: Schema.Number,
  text: VoidQlQueryText,
  updatedAt: Schema.Date,
});
export type SavedVoidQlInsight = typeof SavedVoidQlInsight.Type;
export type SavedVoidQlInsightType = typeof SavedVoidQlInsight.Type;

export const ListVoidQlInsightsResponse = Schema.Struct({
  insights: Schema.Array(SavedVoidQlInsight),
});
export type ListVoidQlInsightsResponse = typeof ListVoidQlInsightsResponse.Type;

/** The compile-error union shared by the run + save surfaces. */
const COMPILE_ERRORS = constant([
  RpcActionForbiddenError,
  RpcVoidQlSyntaxError,
  RpcVoidQlUnsupportedError,
  RpcVoidQlSchemaError,
  RpcVoidQlUnknownFieldError,
  RpcVoidQlPiiError,
  RpcVoidQlComplexityError,
  RpcVoidQlExecutionError,
]);

export class VoidQlRpcsDef extends RpcGroup.make(
  Rpc.make("RunVoidQlQuery", {
    error: Schema.Union([...COMPILE_ERRORS]),
    payload: RunVoidQlQueryRequest,
    success: RunVoidQlQueryResponse,
  }),
  Rpc.make("ValidateVoidQlQuery", {
    error: Schema.Union([RpcActionForbiddenError, RpcVoidQlExecutionError]),
    payload: RunVoidQlQueryRequest,
    success: ValidateVoidQlQueryResponse,
  }),
  Rpc.make("GetVoidQlSchema", {
    error: Schema.Union([RpcActionForbiddenError]),
    payload: Schema.Struct({}),
    success: GetVoidQlSchemaResponse,
  }),
  Rpc.make("SaveVoidQlInsight", {
    error: Schema.Union([...COMPILE_ERRORS]),
    payload: SaveVoidQlInsightRequest,
    success: SaveVoidQlInsightResponse,
  }),
  Rpc.make("ListVoidQlInsights", {
    error: Schema.Union([RpcActionForbiddenError, RpcVoidQlExecutionError]),
    payload: Schema.Struct({ organizationId: Schema.String }),
    success: ListVoidQlInsightsResponse,
  }),
  Rpc.make("RunSavedVoidQlInsight", {
    error: Schema.Union([...COMPILE_ERRORS]),
    payload: Schema.Struct({ id: Schema.String }),
    success: RunVoidQlQueryResponse,
  }),
  Rpc.make("DeleteVoidQlInsight", {
    error: Schema.Union([RpcActionForbiddenError, RpcVoidQlExecutionError]),
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ isDeleted: Schema.Boolean }).pipe(
      Schema.encodeKeys({ isDeleted: "deleted" }),
    ),
  }),
).middleware(AuthMiddleware) {}
