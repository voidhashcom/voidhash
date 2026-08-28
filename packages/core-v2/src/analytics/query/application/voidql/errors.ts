/**
 * VoidQL compile/run domain errors and the structured {@link Diagnostic} the
 * agent repair-loop and the editor caret both consume.
 *
 * Every error is a {@link Schema.TaggedErrorClass} so the RPC layer can translate
 * each `_tag` through `Effect.catchTags`. Messages are path-precise but carry no
 * ClickHouse internals, keeping client-facing execution failures opaque.
 */
import { Schema } from "effect";

/**
 * A typed compile diagnostic. Returned as data by validation and mirrored by
 * the thrown error's fields on the run path.
 */
export interface Diagnostic {
  /** Which compiler stage produced it. */
  readonly stage: "parse" | "resolve" | "verify";
  /** A stable machine code (e.g. `"unknown_field"`, `"pii"`). */
  readonly code: string;
  /** Human/agent-readable message. */
  readonly message: string;
  /** A teachable hint for self-repair (e.g. "VoidQL is read-only…"). */
  readonly hint?: string;
}

/** The query text could not be tokenised or parsed into a valid VoidQL AST. */
export class VoidQlSyntaxError extends Schema.TaggedErrorClass<VoidQlSyntaxError>(
  "VoidQlSyntaxError",
)("VoidQlSyntaxError", { message: Schema.String, hint: Schema.String }) {}

/**
 * The query is syntactically reachable but uses a construct VoidQL does not (yet)
 * compile — a deferred node, an unknown/denied function, a table function, or a
 * `*.table` qualifier. Default-deny: anything not in an allow-list lands here.
 */
export class VoidQlUnsupportedError extends Schema.TaggedErrorClass<VoidQlUnsupportedError>(
  "VoidQlUnsupportedError",
)("VoidQlUnsupportedError", { message: Schema.String, hint: Schema.String }) {}

/** A relation could not be resolved to a registered logical view. */
export class VoidQlSchemaError extends Schema.TaggedErrorClass<VoidQlSchemaError>(
  "VoidQlSchemaError",
)("VoidQlSchemaError", { message: Schema.String }) {}

/** A column/property did not resolve; `suggestion` carries the nearest catalog entry. */
export class VoidQlUnknownFieldError extends Schema.TaggedErrorClass<VoidQlUnknownFieldError>(
  "VoidQlUnknownFieldError",
)("VoidQlUnknownFieldError", {
  field: Schema.String,
  message: Schema.String,
  suggestion: Schema.String,
}) {}

/**
 * A PII column/namespace was referenced without the `pii` capability. The *whole*
 * query is rejected so a `WHERE email = …` cannot act as a row-count oracle.
 */
export class VoidQlPiiError extends Schema.TaggedErrorClass<VoidQlPiiError>("VoidQlPiiError")(
  "VoidQlPiiError",
  { message: Schema.String },
) {}

/** A parser/AST resource cap was exceeded (depth, tokens, nodes, joins, subqueries). */
export class VoidQlComplexityError extends Schema.TaggedErrorClass<VoidQlComplexityError>(
  "VoidQlComplexityError",
)("VoidQlComplexityError", { message: Schema.String }) {}

/**
 * The value-level isolation verifier rejected the compiled statement. This is a
 * **compiler defect**, never user error — it must never reach ClickHouse. Surfaced
 * to clients as an opaque execution error.
 */
export class VoidQlIsolationError extends Schema.TaggedErrorClass<VoidQlIsolationError>(
  "VoidQlIsolationError",
)("VoidQlIsolationError", { message: Schema.String }) {}

/** Catch-all for execution-time failures (the sanitised ClickHouse-error boundary). */
export class VoidQlExecutionError extends Schema.TaggedErrorClass<VoidQlExecutionError>(
  "VoidQlExecutionError",
)("VoidQlExecutionError", { cause: Schema.String, message: Schema.String }) {}

/** The union of errors the pure compile pipeline can raise (execution excluded). */
export type VoidQlCompileError =
  | VoidQlSyntaxError
  | VoidQlUnsupportedError
  | VoidQlSchemaError
  | VoidQlUnknownFieldError
  | VoidQlPiiError
  | VoidQlComplexityError
  | VoidQlIsolationError;

const COMPILE_TAGS = new Set([
  "VoidQlSyntaxError",
  "VoidQlUnsupportedError",
  "VoidQlSchemaError",
  "VoidQlUnknownFieldError",
  "VoidQlPiiError",
  "VoidQlComplexityError",
  "VoidQlIsolationError",
]);

/** Narrow an unknown thrown value to a VoidQL compile error instance. */
export const isVoidQlCompileError = (u: unknown): u is VoidQlCompileError => {
  if (typeof u !== "object" || u === null) return false;
  if (!("_tag" in u)) return false;
  const tag = u._tag;
  return typeof tag === "string" && COMPILE_TAGS.has(tag);
};

/** Renders the "did you mean" hint, or nothing when there is no suggestion. */
const suggestionHint = (suggestion: string | undefined) => {
  if (suggestion) return `Did you mean '${suggestion}'?`;
  return undefined;
};

/** Map a compile error to a public {@link Diagnostic} (used by `validateQuery`). */
export const toDiagnostic = (error: VoidQlCompileError): Diagnostic => {
  switch (error._tag) {
    case "VoidQlSyntaxError":
      return { stage: "parse", code: "syntax", message: error.message, hint: error.hint };
    case "VoidQlUnsupportedError":
      return { stage: "parse", code: "unsupported", message: error.message, hint: error.hint };
    case "VoidQlSchemaError":
      return { stage: "resolve", code: "unknown_relation", message: error.message };
    case "VoidQlUnknownFieldError":
      return {
        stage: "resolve",
        code: "unknown_field",
        message: error.message,
        hint: suggestionHint(error.suggestion),
      };
    case "VoidQlPiiError":
      return { stage: "resolve", code: "pii", message: error.message };
    case "VoidQlComplexityError":
      return { stage: "parse", code: "complexity", message: error.message };
    case "VoidQlIsolationError":
      // Never leak the internal reason; the diagnostic is generic.
      return { stage: "verify", code: "internal", message: "Query could not be compiled." };
  }
};
