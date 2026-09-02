import type { BooleanValue, NumberValue, Path, StringValue, Value } from "../../core/types.ts";
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
import type { Mutable } from "../../internal/lang.ts";

type LiteralKind = "string" | "number" | "boolean";

const literalValueKind = (value: string | number | boolean): LiteralKind => {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
};

const expectLiteralValue = (
  expectedKind: LiteralKind,
  schemaKind: LiteralSchema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): StringValue | NumberValue | BooleanValue => {
  if (expectedKind === "string") {
    return expectStringValue(schemaKind, value, valuePath, schemaPath);
  }
  if (expectedKind === "number") {
    return expectNumberValue(schemaKind, value, valuePath, schemaPath);
  }
  return expectBooleanValue(schemaKind, value, valuePath, schemaPath);
};

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
    );
  },
  serialize: (schema) => {
    const serialized: Mutable<LiteralSchema> = {
      kind: "literal",
      value: schema.value,
      ...serializeRequired(schema.required),
    };
    if (schema.default !== undefined) {
      serialized.default = cloneSchemaDefault(schema.default);
    }
    return serialized;
  },
  validate: (schema, value, _context, valuePath, schemaPath) => {
    const expectedKind = literalValueKind(schema.value);
    const literalValue = expectLiteralValue(
      expectedKind,
      schema.kind,
      value,
      valuePath,
      schemaPath,
    );

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
