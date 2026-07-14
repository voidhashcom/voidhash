import { Schema } from "effect";

export const CompilerRequest = Schema.Struct({
  mode: Schema.Literals(["check", "extract"]),
  source: Schema.String,
});

const Diagnostic = Schema.Struct({
  column: Schema.optional(Schema.Number),
  line: Schema.optional(Schema.Number),
  message: Schema.String,
  phase: Schema.optional(Schema.Literals(["compile", "runtime"])),
});

export const CompileCheckResponse = Schema.Union([
  Schema.Struct({ status: Schema.Literals(["ready"]) }),
  Schema.Struct({ diagnostics: Schema.Array(Diagnostic), status: Schema.Literals(["error"]) }),
  Schema.Struct({ status: Schema.Literals(["unavailable"]) }),
]);

export const CompileExtractResponse = Schema.Union([
  Schema.Struct({
    manifest: Schema.Unknown,
    previewTrees: Schema.Record(Schema.String, Schema.Unknown),
    status: Schema.Literals(["ready"]),
  }),
  Schema.Struct({
    diagnostics: Schema.Array(Diagnostic),
    phase: Schema.Literals(["compile", "runtime"]),
    status: Schema.Literals(["error"]),
  }),
  Schema.Struct({ status: Schema.Literals(["unavailable"]) }),
]);
