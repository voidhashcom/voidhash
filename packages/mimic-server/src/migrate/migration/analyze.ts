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

const pathToString = (path: readonly string[]): string =>
  path.length === 0 ? "root" : `root.${path.join(".")}`;

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
      let defaultValue;
      try {
        defaultValue = materializeDefault(newField);
      } catch {
        defaultValue = undefined;
      }
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
      const oldLiteral = oldSchema as LiteralSchema;
      const newLiteral = newSchema as LiteralSchema;
      if (oldLiteral.value !== newLiteral.value) {
        pushIssue(
          issues,
          "incompatible-type",
          path,
          `Literal changed from ${JSON.stringify(oldLiteral.value)} to ${JSON.stringify(newLiteral.value)}`,
        );
      }
      return;
    }
    case "object":
      analyzeObject(oldSchema as ObjectSchema, newSchema as ObjectSchema, path, issues);
      return;
    case "array": {
      const oldArray = oldSchema as ArraySchema;
      const newArray = newSchema as ArraySchema;
      analyzeSchemaCompatibility(oldArray.element, newArray.element, [...path, "element"], issues);
      return;
    }
    case "union":
      analyzeUnion(oldSchema as UnionSchema, newSchema as UnionSchema, path, issues);
      return;
    case "either":
      analyzeEither(oldSchema as EitherSchema, newSchema as EitherSchema, path, issues);
      return;
    case "tree":
      analyzeTree(oldSchema as TreeSchema, newSchema as TreeSchema, path, issues);
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
