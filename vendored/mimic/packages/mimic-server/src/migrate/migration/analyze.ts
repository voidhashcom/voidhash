import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as EffectSchema from "effect/Schema";
import { materializeDefault } from "@voidhash/mimic-core";
import type {
  ArraySchema,
  EitherSchema,
  LiteralSchema,
  ObjectSchema,
  Schema,
  TreeSchema,
  TreeVariantSchema,
  UnionSchema,
} from "@voidhash/mimic-core";

import type { AnalyzeMigrationOptions, SchemaMigrationCompatibilityIssue } from "./types.ts";

/** JSON codec used to render literal values inside diagnostic messages. */
const encodeJson = EffectSchema.encodeSync(EffectSchema.fromJsonString(EffectSchema.Unknown));

const pathToString = (path: readonly string[]): string => {
  if (!Arr.isReadonlyArrayNonEmpty(path)) return "root";
  return `root.${path.join(".")}`;
};

/**
 * Materializes a field default, treating a schema that cannot produce one as
 * "no default" rather than propagating the failure.
 */
const materializeDefaultOption = Option.liftThrowable(materializeDefault);

const isLiteralSchema = (schema: Schema): schema is LiteralSchema => schema.kind === "literal";
const isObjectSchema = (schema: Schema): schema is ObjectSchema => schema.kind === "object";
const isArraySchema = (schema: Schema): schema is ArraySchema => schema.kind === "array";
const isUnionSchema = (schema: Schema): schema is UnionSchema => schema.kind === "union";
const isEitherSchema = (schema: Schema): schema is EitherSchema => schema.kind === "either";
const isTreeSchema = (schema: Schema): schema is TreeSchema => schema.kind === "tree";

const pushIssue = (
  issues: SchemaMigrationCompatibilityIssue[],
  code: SchemaMigrationCompatibilityIssue["code"],
  path: readonly string[],
  message: string,
): void => {
  issues.push({
    code,
    path: pathToString(path),
    message,
  });
};

const analyzeObject = (
  oldSchema: ObjectSchema,
  newSchema: ObjectSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  R.toEntries(newSchema.fields).forEach(([key, newField]) => {
    const oldField = oldSchema.fields[key];
    if (!oldField) {
      const defaultValue = materializeDefaultOption(newField);
      if (newField.required === true && Option.isNone(defaultValue)) {
        pushIssue(
          issues,
          "required-field-without-default",
          [...path, key],
          `Field "${key}" is required in the new schema but has no default`,
        );
      }
      return;
    }
    analyzeSchemaCompatibility(oldField, newField, [...path, key], issues);
  });
};

const analyzeUnion = (
  oldSchema: UnionSchema,
  newSchema: UnionSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  if (oldSchema.discriminator !== newSchema.discriminator) {
    pushIssue(
      issues,
      "incompatible-type",
      [...path, "discriminator"],
      "Union discriminator changed",
    );
    return;
  }

  R.toEntries(oldSchema.variants).forEach(([variantKey, oldVariant]) => {
    const newVariant = newSchema.variants[variantKey];
    if (!newVariant) {
      pushIssue(
        issues,
        "incompatible-type",
        [...path, "variants", variantKey],
        `Union variant "${variantKey}" is missing in the new schema`,
      );
      return;
    }
    analyzeObject(oldVariant, newVariant, [...path, "variants", variantKey], issues);
  });
};

const analyzeEither = (
  oldSchema: EitherSchema,
  newSchema: EitherSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  oldSchema.variants.forEach((oldVariant, index) => {
    const compatible = newSchema.variants.some((candidate) => {
      const nestedIssues: SchemaMigrationCompatibilityIssue[] = [];
      analyzeSchemaCompatibility(
        oldVariant,
        candidate,
        [...path, "variants", String(index)],
        nestedIssues,
      );
      return Arr.isReadonlyArrayNonEmpty(nestedIssues);
    });

    if (!compatible) {
      pushIssue(
        issues,
        "incompatible-type",
        [...path, "variants", String(index)],
        `Either variant at index ${index} has no compatible target variant`,
      );
    }
  });
};

const analyzeTreeVariant = (
  oldVariant: TreeVariantSchema,
  newVariant: TreeVariantSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  analyzeObject(oldVariant.schema, newVariant.schema, [...path, "schema"], issues);
  oldVariant.children.forEach((child) => {
    if (!newVariant.children.includes(child)) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "children"],
        `Tree child variant "${child}" is no longer allowed`,
      );
    }
  });
};

const analyzeTree = (
  oldSchema: TreeSchema,
  newSchema: TreeSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  if (oldSchema.discriminator !== newSchema.discriminator) {
    pushIssue(issues, "invalid-tree", [...path, "discriminator"], "Tree discriminator changed");
    return;
  }

  oldSchema.roots.forEach((root) => {
    if (!newSchema.roots.includes(root)) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "roots"],
        `Tree root variant "${root}" is no longer allowed`,
      );
    }
  });

  R.toEntries(oldSchema.variants).forEach(([variantKey, oldVariant]) => {
    const newVariant = newSchema.variants[variantKey];
    if (!newVariant) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "variants", variantKey],
        `Tree variant "${variantKey}" is missing in the new schema`,
      );
      return;
    }
    analyzeTreeVariant(oldVariant, newVariant, [...path, "variants", variantKey], issues);
  });
};

const analyzeSchemaCompatibility = (
  oldSchema: Schema,
  newSchema: Schema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  if (oldSchema.kind !== newSchema.kind) {
    pushIssue(
      issues,
      "incompatible-type",
      path,
      `Schema kind changed from "${oldSchema.kind}" to "${newSchema.kind}"`,
    );
    return;
  }

  Match.value(oldSchema).pipe(
    Match.when({ kind: "string" }, () => undefined),
    Match.when({ kind: "number" }, () => undefined),
    Match.when({ kind: "boolean" }, () => undefined),
    Match.when({ kind: "literal" }, (oldLiteral) => {
      if (!isLiteralSchema(newSchema)) return;
      if (oldLiteral.value !== newSchema.value) {
        pushIssue(
          issues,
          "incompatible-type",
          path,
          `Literal changed from ${encodeJson(oldLiteral.value)} to ${encodeJson(newSchema.value)}`,
        );
      }
    }),
    Match.when({ kind: "object" }, (oldObject) => {
      if (!isObjectSchema(newSchema)) return;
      analyzeObject(oldObject, newSchema, path, issues);
    }),
    Match.when({ kind: "array" }, (oldArray) => {
      if (!isArraySchema(newSchema)) return;
      analyzeSchemaCompatibility(oldArray.element, newSchema.element, [...path, "element"], issues);
    }),
    Match.when({ kind: "union" }, (oldUnion) => {
      if (!isUnionSchema(newSchema)) return;
      analyzeUnion(oldUnion, newSchema, path, issues);
    }),
    Match.when({ kind: "either" }, (oldEither) => {
      if (!isEitherSchema(newSchema)) return;
      analyzeEither(oldEither, newSchema, path, issues);
    }),
    Match.when({ kind: "tree" }, (oldTree) => {
      if (!isTreeSchema(newSchema)) return;
      analyzeTree(oldTree, newSchema, path, issues);
    }),
    Match.exhaustive,
  );
};

export const analyzeMigration = (
  options: AnalyzeMigrationOptions,
): readonly SchemaMigrationCompatibilityIssue[] => {
  const issues: SchemaMigrationCompatibilityIssue[] = [];
  analyzeSchemaCompatibility(options.oldSchema, options.newSchema, [], issues);
  return issues;
};
