import { isSchemaError, validate, validateValue } from "@voidhash/mimic-core";

import type {
  ReconcileMigrationValueOptions,
  ReconcileMigrationValueResult,
  SchemaMigrationIssue,
} from "./types.ts";

const pathToString = (
  path: readonly {
    readonly kind: "field" | "item" | "node";
    readonly key?: string;
    readonly id?: string;
  }[],
): string => {
  if (path.length === 0) {
    return "root";
  }
  const segments = path.map((segment) => {
    switch (segment.kind) {
      case "field":
        return segment.key ?? "";
      case "item":
      case "node":
        return segment.id ?? "";
    }
  });
  return `root.${segments.join(".")}`;
};

const toIssue = (error: unknown): SchemaMigrationIssue => {
  if (isSchemaError(error)) {
    let code: SchemaMigrationIssue["code"] = "invalid-value";
    switch (error.code) {
      case "missing_required":
        code = "required-field-without-default";
        break;
      case "tree_invalid_root_type":
      case "tree_invalid_child_type":
      case "tree_unknown_variant":
        code = "invalid-tree";
        break;
      case "type_mismatch":
      case "literal_mismatch":
      case "union_no_match":
      case "either_no_match":
        code = "incompatible-type";
        break;
      case "validator_failed":
        code = "invalid-value";
        break;
    }

    return {
      code,
      path: pathToString(error.valuePath as never),
      message: error.message,
    };
  }

  return {
    code: "invalid-value",
    path: "root",
    message: error instanceof Error ? error.message : String(error),
  };
};

export const reconcileMigrationValue = (
  options: ReconcileMigrationValueOptions,
): ReconcileMigrationValueResult => {
  try {
    validateValue(options.value);
    const normalized = validate(options.oldSchema, options.value);
    if (normalized === undefined) {
      return {
        ok: false,
        error: {
          code: "missing-value",
          path: "root",
          message: "Old schema sanitized the input value to undefined",
        },
      };
    }

    return {
      ok: true,
      value: validate(options.newSchema, normalized),
    };
  } catch (error) {
    return {
      ok: false,
      error: toIssue(error),
    };
  }
};
