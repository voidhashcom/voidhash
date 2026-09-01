import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { causeMessage } from "@voidhash/lib/lang";
import { isSchemaError, validate, validateValue } from "@voidhash/mimic-core";
import type { Path } from "@voidhash/mimic-core";

import type {
  ReconcileMigrationValueOptions,
  ReconcileMigrationValueResult,
  SchemaMigrationIssue,
} from "./types.ts";

const pathToString = (path: Path): string => {
  if (!Arr.isReadonlyArrayNonEmpty(path)) {
    return "root";
  }
  const segments = path.map((segment) =>
    Match.value(segment).pipe(
      Match.when({ kind: "field" }, ({ key }) => key),
      Match.when({ kind: "item" }, ({ id }) => id),
      Match.when({ kind: "node" }, ({ id }) => id),
      Match.exhaustive,
    ),
  );
  return `root.${segments.join(".")}`;
};

const toIssue = (error: unknown): SchemaMigrationIssue => {
  if (isSchemaError(error)) {
    const code: SchemaMigrationIssue["code"] = Match.value(error.code).pipe(
      Match.when("missing_required", () => "required-field-without-default" as const),
      Match.when("tree_invalid_root_type", () => "invalid-tree" as const),
      Match.when("tree_invalid_child_type", () => "invalid-tree" as const),
      Match.when("tree_unknown_variant", () => "invalid-tree" as const),
      Match.when("type_mismatch", () => "incompatible-type" as const),
      Match.when("literal_mismatch", () => "incompatible-type" as const),
      Match.when("union_no_match", () => "incompatible-type" as const),
      Match.when("either_no_match", () => "incompatible-type" as const),
      Match.when("validator_failed", () => "invalid-value" as const),
      Match.when("invalid_schema", () => "invalid-value" as const),
      Match.exhaustive,
    );

    return {
      code,
      path: pathToString(error.valuePath),
      message: error.message,
    };
  }

  return {
    code: "invalid-value",
    path: "root",
    message: causeMessage(error),
  };
};

export const reconcileMigrationValue = (
  options: ReconcileMigrationValueOptions,
): ReconcileMigrationValueResult =>
  Result.try({
    try: (): ReconcileMigrationValueResult => {
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
        value: Option.fromUndefinedOr(validate(options.newSchema, normalized)),
      };
    },
    catch: (error): ReconcileMigrationValueResult => ({
      ok: false,
      error: toIssue(error),
    }),
  }).pipe(Result.match({ onFailure: (result) => result, onSuccess: (result) => result }));
