import { cloneValue } from "../../core/types.ts";
import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  invalidSchema,
  serializeRequired,
  expectBooleanValue,
  expectNumberValue,
  expectStringValue,
} from "../shared.ts";
import type { LiteralSchema } from "../types.ts";

export const literalSchemaModel: SchemaModel<LiteralSchema> = {
  kind: "literal",
  parse: (input, metadata, context, schemaPath) => {
    const value = input["value"];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw invalidSchema(
        [...schemaPath, "value"],
        "literal value must be string, number, or boolean",
      );
    }

    return context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        value,
      },
      input["default"],
      schemaPath,
    ) as LiteralSchema;
  },
  serialize: (schema) => ({
    kind: "literal",
    value: schema.value,
    ...serializeRequired(schema.required),
    ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
  }),
  validate: (schema, value, _context, valuePath, schemaPath) => {
    const expectedKind =
      typeof schema.value === "string"
        ? "string"
        : typeof schema.value === "number"
          ? "number"
          : "boolean";
    const literalValue =
      expectedKind === "string"
        ? expectStringValue(schema.kind, value, valuePath, schemaPath)
        : expectedKind === "number"
          ? expectNumberValue(schema.kind, value, valuePath, schemaPath)
          : expectBooleanValue(schema.kind, value, valuePath, schemaPath);

    if (literalValue.value !== schema.value) {
      throw makeSchemaError(
        SchemaErrorCodes.LiteralMismatch,
        "literal value does not match schema",
        { valuePath, schemaPath },
      );
    }

    return cloneValue(literalValue);
  },
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
