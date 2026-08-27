import { cloneValue } from "../../core/types.ts";
import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import { cloneSchemaDefault, expectBooleanValue, serializeRequired } from "../shared.ts";
import type { BooleanSchema } from "../types.ts";
import type { Mutable } from "../../internal/lang.ts";

export const booleanSchemaModel: SchemaModel<BooleanSchema> = {
  kind: "boolean",
  parse: (input, metadata, context, schemaPath) =>
    context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
      },
      input["default"],
      schemaPath,
    ),
  serialize: (schema) => {
    const serialized: Mutable<BooleanSchema> = {
      kind: "boolean",
      ...serializeRequired(schema.required),
    };
    if (schema.default !== undefined) {
      serialized.default = cloneSchemaDefault(schema.default);
    }
    return serialized;
  },
  validate: (_schema, value, _context, valuePath, schemaPath) =>
    cloneValue(expectBooleanValue("boolean", value, valuePath, schemaPath)),
  materializeDefault: (schema, _context, valuePath, schemaPath) => {
    if (schema.required) {
      throw makeSchemaError(SchemaErrorCodes.MissingRequired, "required value has no default", {
        valuePath,
        schemaPath,
      });
    }
    return undefined;
  },
};
