import { cloneValue } from "../../core/types.ts";
import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  expectStringValue,
  parseStringValidators,
  serializeRequired,
  validatorFailed,
} from "../shared.ts";
import type { StringSchema } from "../types.ts";

export const stringSchemaModel: SchemaModel<StringSchema> = {
  kind: "string",
  parse: (input, metadata, context, schemaPath) =>
    context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        validators: parseStringValidators(input["validators"], [...schemaPath, "validators"]),
      },
      input["default"],
      schemaPath,
    ) as StringSchema,
  serialize: (schema) => ({
    kind: "string",
    ...serializeRequired(schema.required),
    ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
    ...(schema.validators && schema.validators.length > 0
      ? { validators: schema.validators.map((validator) => ({ ...validator })) }
      : {}),
  }),
  validate: (schema, value, _context, valuePath, schemaPath) => {
    const stringValue = expectStringValue(schema.kind, value, valuePath, schemaPath);

    for (const validator of schema.validators ?? []) {
      switch (validator.kind) {
        case "minLength":
          if (stringValue.value.length < validator.value) {
            throw validatorFailed("string shorter than minLength", valuePath, schemaPath);
          }
          break;
        case "maxLength":
          if (stringValue.value.length > validator.value) {
            throw validatorFailed("string longer than maxLength", valuePath, schemaPath);
          }
          break;
        case "length":
          if (stringValue.value.length !== validator.value) {
            throw validatorFailed("string length mismatch", valuePath, schemaPath);
          }
          break;
        case "regex":
          if (!new RegExp(validator.pattern, validator.flags).test(stringValue.value)) {
            throw validatorFailed("string does not match regex", valuePath, schemaPath);
          }
          break;
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue.value)) {
            throw validatorFailed("invalid email", valuePath, schemaPath);
          }
          break;
        case "url":
          try {
            new URL(stringValue.value);
          } catch {
            throw validatorFailed("invalid url", valuePath, schemaPath);
          }
          break;
      }
    }

    return cloneValue(stringValue);
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
