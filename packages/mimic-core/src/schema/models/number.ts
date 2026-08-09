import { cloneValue } from "../../core/types.ts";
import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  expectNumberValue,
  parseNumberValidators,
  serializeRequired,
  validatorFailed,
} from "../shared.ts";
import type { NumberSchema } from "../types.ts";
import type { Mutable } from "../../internal/lang.ts";

export const numberSchemaModel: SchemaModel<NumberSchema> = {
  kind: "number",
  parse: (input, metadata, context, schemaPath) =>
    context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        validators: parseNumberValidators(input["validators"], [...schemaPath, "validators"]),
      },
      input["default"],
      schemaPath,
    ),
  serialize: (schema) => {
    const serialized: Mutable<NumberSchema> = {
      kind: "number",
      ...serializeRequired(schema.required),
    };
    if (schema.default !== undefined) {
      serialized.default = cloneSchemaDefault(schema.default);
    }
    if (schema.validators && schema.validators.length > 0) {
      serialized.validators = schema.validators.map((validator) => ({ ...validator }));
    }
    return serialized;
  },
  validate: (schema, value, _context, valuePath, schemaPath) => {
    const numberValue = expectNumberValue(schema.kind, value, valuePath, schemaPath);

    for (const validator of schema.validators ?? []) {
      switch (validator.kind) {
        case "min":
          if (numberValue.value < validator.value) {
            throw validatorFailed("number smaller than min", valuePath, schemaPath);
          }
          break;
        case "max":
          if (numberValue.value > validator.value) {
            throw validatorFailed("number larger than max", valuePath, schemaPath);
          }
          break;
        case "positive":
          if (numberValue.value <= 0) {
            throw validatorFailed("number is not positive", valuePath, schemaPath);
          }
          break;
        case "negative":
          if (numberValue.value >= 0) {
            throw validatorFailed("number is not negative", valuePath, schemaPath);
          }
          break;
        case "int":
          if (!Number.isInteger(numberValue.value)) {
            throw validatorFailed("number is not an integer", valuePath, schemaPath);
          }
          break;
      }
    }

    return cloneValue(numberValue);
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
