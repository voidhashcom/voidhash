import { Effect, Schema as EffectSchema } from "effect";
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
  Value,
} from "@voidhash/mimic-core";

import type { AnalyzeMigrationOptions, SchemaMigrationCompatibilityIssue } from "./types.ts";

/** JSON codec used to render literal values inside diagnostic messages. */
const encodeJson = EffectSchema.encodeSync(EffectSchema.fromJsonString(EffectSchema.Unknown));

const pathToString = (path: readonly string[]): string => {
  if (path.length === 0) return "root";
  return `root.${path.join(".")}`;
};

/**
 * Materializes a field default, treating a schema that cannot produce one as
 * "no default" rather than propagating the failure.
 */
const materializeDefaultOrUndefined = (schema: Schema): Value | undefined =>
  Effect.runSync(
    Effect.try(() => materializeDefault(schema)).pipe(Effect.orElseSucceed(() => undefined)),
  );

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
  for (const [key, newField] of Object.entries(newSchema.fields)) {
    const oldField = oldSchema.fields[key];
    if (!oldField) {
      const defaultValue = materializeDefaultOrUndefined(newField);
      if (newField.required === true && defaultValue === undefined) {
        pushIssue(
          issues,
          "required-field-without-default",
          [...path, key],
          `Field "${key}" is required in the new schema but has no default`,
        );
      }
      continue;
    }
    analyzeSchemaCompatibility(oldField, newField, [...path, key], issues);
  }
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

  for (const [variantKey, oldVariant] of Object.entries(oldSchema.variants)) {
    const newVariant = newSchema.variants[variantKey];
    if (!newVariant) {
      pushIssue(
        issues,
        "incompatible-type",
        [...path, "variants", variantKey],
        `Union variant "${variantKey}" is missing in the new schema`,
      );
      continue;
    }
    analyzeObject(oldVariant, newVariant, [...path, "variants", variantKey], issues);
  }
};

const analyzeEither = (
  oldSchema: EitherSchema,
  newSchema: EitherSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  for (const [index, oldVariant] of oldSchema.variants.entries()) {
    const compatible = newSchema.variants.some((candidate) => {
      const nestedIssues: SchemaMigrationCompatibilityIssue[] = [];
      analyzeSchemaCompatibility(
        oldVariant,
        candidate,
        [...path, "variants", String(index)],
        nestedIssues,
      );
      return nestedIssues.length === 0;
    });

    if (!compatible) {
      pushIssue(
        issues,
        "incompatible-type",
        [...path, "variants", String(index)],
        `Either variant at index ${index} has no compatible target variant`,
      );
    }
  }
};

const analyzeTreeVariant = (
  oldVariant: TreeVariantSchema,
  newVariant: TreeVariantSchema,
  path: readonly string[],
  issues: SchemaMigrationCompatibilityIssue[],
): void => {
  analyzeObject(oldVariant.schema, newVariant.schema, [...path, "schema"], issues);
  for (const child of oldVariant.children) {
    if (!newVariant.children.includes(child)) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "children"],
        `Tree child variant "${child}" is no longer allowed`,
      );
    }
  }
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

  for (const root of oldSchema.roots) {
    if (!newSchema.roots.includes(root)) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "roots"],
        `Tree root variant "${root}" is no longer allowed`,
      );
    }
  }

  for (const [variantKey, oldVariant] of Object.entries(oldSchema.variants)) {
    const newVariant = newSchema.variants[variantKey];
    if (!newVariant) {
      pushIssue(
        issues,
        "invalid-tree",
        [...path, "variants", variantKey],
        `Tree variant "${variantKey}" is missing in the new schema`,
      );
      continue;
    }
    analyzeTreeVariant(oldVariant, newVariant, [...path, "variants", variantKey], issues);
  }
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

  switch (oldSchema.kind) {
    case "string":
    case "number":
    case "boolean":
      return;
    case "literal": {
      if (!isLiteralSchema(newSchema)) return;
      if (oldSchema.value !== newSchema.value) {
        pushIssue(
          issues,
          "incompatible-type",
          path,
          `Literal changed from ${encodeJson(oldSchema.value)} to ${encodeJson(newSchema.value)}`,
        );
      }
      return;
    }
    case "object":
      if (!isObjectSchema(newSchema)) return;
      analyzeObject(oldSchema, newSchema, path, issues);
      return;
    case "array": {
      if (!isArraySchema(newSchema)) return;
      analyzeSchemaCompatibility(oldSchema.element, newSchema.element, [...path, "element"], issues);
      return;
    }
    case "union":
      if (!isUnionSchema(newSchema)) return;
      analyzeUnion(oldSchema, newSchema, path, issues);
      return;
    case "either":
      if (!isEitherSchema(newSchema)) return;
      analyzeEither(oldSchema, newSchema, path, issues);
      return;
    case "tree":
      if (!isTreeSchema(newSchema)) return;
      analyzeTree(oldSchema, newSchema, path, issues);
      return;
  }
};

export const analyzeMigration = (
  options: AnalyzeMigrationOptions,
): readonly SchemaMigrationCompatibilityIssue[] => {
  const issues: SchemaMigrationCompatibilityIssue[] = [];
  analyzeSchemaCompatibility(options.oldSchema, options.newSchema, [], issues);
  return issues;
};
