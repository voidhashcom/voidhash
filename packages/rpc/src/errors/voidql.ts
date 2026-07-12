/**
 * RPC-layer counterparts of the VoidQL domain errors (the 3-layer error
 * convention). Backend handlers translate each core `VoidQl*` `_tag` into one of
 * these via `Effect.catchTags`. The internal `VoidQlIsolationError` (a compiler
 * defect) is mapped to {@link RpcVoidQlExecutionError} so clients never see its
 * reason — uniform opaque envelopes starve side-channels (§7 L7, §13).
 */
import { Schema } from "effect";

/** Query text could not be tokenised/parsed. */
export class RpcVoidQlSyntaxError extends Schema.TaggedErrorClass<RpcVoidQlSyntaxError>(
  "RpcVoidQlSyntaxError",
)("Rpc/VoidQlSyntaxError", { message: Schema.String, hint: Schema.String }) {}

/** A construct outside the supported VoidQL surface (deferred/denied/unknown fn). */
export class RpcVoidQlUnsupportedError extends Schema.TaggedErrorClass<RpcVoidQlUnsupportedError>(
  "RpcVoidQlUnsupportedError",
)("Rpc/VoidQlUnsupportedError", { message: Schema.String, hint: Schema.String }) {}

/** A relation did not resolve to a registered logical view. */
export class RpcVoidQlSchemaError extends Schema.TaggedErrorClass<RpcVoidQlSchemaError>(
  "RpcVoidQlSchemaError",
)("Rpc/VoidQlSchemaError", { message: Schema.String }) {}

/** A column/property did not resolve. */
export class RpcVoidQlUnknownFieldError extends Schema.TaggedErrorClass<RpcVoidQlUnknownFieldError>(
  "RpcVoidQlUnknownFieldError",
)("Rpc/VoidQlUnknownFieldError", {
  field: Schema.String,
  message: Schema.String,
  suggestion: Schema.String,
}) {}

/** A PII column/namespace was referenced without the capability. */
export class RpcVoidQlPiiError extends Schema.TaggedErrorClass<RpcVoidQlPiiError>(
  "RpcVoidQlPiiError",
)("Rpc/VoidQlPiiError", { message: Schema.String }) {}

/** A parser/AST resource cap was exceeded. */
export class RpcVoidQlComplexityError extends Schema.TaggedErrorClass<RpcVoidQlComplexityError>(
  "RpcVoidQlComplexityError",
)("Rpc/VoidQlComplexityError", { message: Schema.String }) {}

/** Catch-all execution failure — sanitised (no CH internals, no row counts). */
export class RpcVoidQlExecutionError extends Schema.TaggedErrorClass<RpcVoidQlExecutionError>(
  "RpcVoidQlExecutionError",
)("Rpc/VoidQlExecutionError", { cause: Schema.String, message: Schema.String }) {}
