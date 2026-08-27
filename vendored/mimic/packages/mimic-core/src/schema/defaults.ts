import { type Path, cloneValue, type Value } from "../core/types.ts";
import { getSchemaModel } from "./registry.ts";
import type { Schema } from "./types.ts";
import { constant } from "../internal/lang.ts";

export const materializeDefault = (schema: Schema): Value | undefined =>
  materializeDefaultInternal(schema, [], []);

export const materializeDefaultAt = (
  schema: Schema,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): Value | undefined => materializeDefaultInternal(schema, valuePath, schemaPath);

const materializeDefaultInternal = (
  schema: Schema,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): Value | undefined => {
  if ("default" in schema && schema.default !== undefined) {
    return cloneValue(schema.default);
  }
  return getSchemaModel(schema.kind).materializeDefault(
    schema,
    defaultContext,
    valuePath,
    schemaPath,
  );
};

const defaultContext = constant({
  materializeDefault: materializeDefaultInternal,
});
