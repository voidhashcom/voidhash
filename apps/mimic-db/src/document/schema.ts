import {
  parseSchema,
  serializeSchema,
  validate as validateSchemaValue,
  validateValue,
  type SchemaObject,
  type Value,
} from "@voidhash/mimic-core";
import { InvalidSchemaError, InvalidValueError } from "@voidhash/mimic-server/rpc";

export const normalizeSchemaObject = (input: unknown): SchemaObject => {
  try {
    return serializeSchema(parseSchema(input));
  } catch (error) {
    throw new InvalidSchemaError({
      code: "invalid_schema",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export const sanitizeValueForSchema = (schemaObject: SchemaObject, input: unknown): Value => {
  try {
    validateValue(input as Value);
    const schema = parseSchema(schemaObject);
    return validateSchemaValue(schema, input as Value) as Value;
  } catch (error) {
    throw new InvalidValueError({
      code: "invalid_value",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
