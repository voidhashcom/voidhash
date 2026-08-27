import { isCoreError } from "../core/errors.ts";
import type { Schema } from "./types.ts";
import { getSchemaModel, isSchemaKind } from "./registry.ts";
import {
  expectRecord,
  expectString,
  invalidSchema,
  parseDefaultValue,
  parseOptionalBoolean,
} from "./shared.ts";
import { validate as validateSchema } from "./validate.ts";
import { constant } from "../internal/lang.ts";

export const parseSchema = (input: unknown): Schema => {
  const schema = parseSchemaInternal(input, []);
  return schema;
};

const parseSchemaInternal = (input: unknown, schemaPath: readonly (string | number)[]): Schema => {
  const object = expectRecord(input, schemaPath, "schema must be an object");
  const kind = expectString(object["kind"], [...schemaPath, "kind"], "schema kind is required");
  if (!isSchemaKind(kind)) {
    throw invalidSchema(schemaPath, `unknown schema kind ${String(kind)}`);
  }

  return getSchemaModel(kind).parse(
    object,
    {
      kind,
      required: parseOptionalBoolean(object["required"], [...schemaPath, "required"]),
    },
    parseContext,
    schemaPath,
  );
};

const literalValueKind = (value: string | number | boolean): "string" | "number" | "boolean" => {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
};

function normalizeDefault<TSchema extends Schema>(
  schema: TSchema,
  rawDefault: unknown,
  schemaPath: readonly (string | number)[],
): TSchema {
  if (rawDefault === undefined) {
    return schema;
  }

  const parsedDefault = parseDefaultValue(rawDefault, [...schemaPath, "default"]);

  if (schema.kind === "literal") {
    const literalKind = literalValueKind(schema.value);
    if (parsedDefault.kind !== literalKind || parsedDefault.value !== schema.value) {
      throw invalidSchema([...schemaPath, "default"], "literal default must equal literal value");
    }
  }

  try {
    const normalized = validateSchema(schema, parsedDefault);
    return { ...schema, default: normalized };
  } catch (error) {
    if (isCoreError(error) || error instanceof Error) {
      throw invalidSchema(
        [...schemaPath, "default"],
        `schema default is invalid: ${error.message}`,
      );
    }
    throw error;
  }
}

const parseContext = constant({
  parseSchema: parseSchemaInternal,
  normalizeDefault,
});
