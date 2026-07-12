import { validateValue } from "../core/validate.ts";
import { type Path, type Value } from "../core/types.ts";
import { materializeDefaultAt } from "./defaults.ts";
import { getSchemaModel } from "./registry.ts";
import type { Schema } from "./types.ts";

export const validate = (schema: Schema, value?: Value): Value | undefined => {
  if (value !== undefined) {
    validateValue(value);
  }
  return validateInternal(schema, value, [], []);
};

const validateInternal = (
  schema: Schema,
  value: Value | undefined,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): Value | undefined => {
  if (value === undefined) {
    return materializeDefaultAt(schema, valuePath, schemaPath);
  }

  return getSchemaModel(schema.kind).validate(
    schema,
    value,
    validationContext,
    valuePath,
    schemaPath,
  );
};

const validationContext = {
  validate: validateInternal,
  materializeDefault: materializeDefaultAt,
} as const;
