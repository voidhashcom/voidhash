import type { Path } from "../core/types.ts";

export const SchemaErrorCodes = {
  InvalidSchema: "invalid_schema",
  MissingRequired: "missing_required",
  TypeMismatch: "type_mismatch",
  LiteralMismatch: "literal_mismatch",
  ValidatorFailed: "validator_failed",
  UnionNoMatch: "union_no_match",
  EitherNoMatch: "either_no_match",
  TreeInvalidRootType: "tree_invalid_root_type",
  TreeInvalidChildType: "tree_invalid_child_type",
  TreeUnknownVariant: "tree_unknown_variant",
} as const;

export type SchemaErrorCode = (typeof SchemaErrorCodes)[keyof typeof SchemaErrorCodes];

export class SchemaError extends Error {
  readonly code: SchemaErrorCode;
  readonly valuePath: Path;
  readonly schemaPath: readonly (string | number)[];

  constructor(
    code: SchemaErrorCode,
    message = "",
    options?: {
      valuePath?: Path;
      schemaPath?: readonly (string | number)[];
    },
  ) {
    super(message ? `${code}: ${message}` : code);
    this.name = "SchemaError";
    this.code = code;
    this.valuePath = options?.valuePath ?? [];
    this.schemaPath = options?.schemaPath ?? [];
  }
}

export const makeSchemaError = (
  code: SchemaErrorCode,
  message: string,
  options?: {
    valuePath?: Path;
    schemaPath?: readonly (string | number)[];
  },
): SchemaError => new SchemaError(code, message, options);

export const isSchemaError = (value: unknown): value is SchemaError => value instanceof SchemaError;
