import { isCoreError } from "../core/errors.ts";
import type {
  ArrayValue,
  BooleanValue,
  NumberValue,
  ObjectValue,
  Path,
  StringValue,
  TreeValue,
  Value,
} from "../core/types.ts";
import { cloneValue } from "../core/types.ts";
import { validateValue } from "../core/validate.ts";
import { makeSchemaError, SchemaErrorCodes } from "./errors.ts";
import type { ArrayValidator, NumberValidator, Schema, StringValidator } from "./types.ts";

export const invalidSchema = (schemaPath: readonly (string | number)[], message: string) =>
  makeSchemaError(SchemaErrorCodes.InvalidSchema, message, {
    valuePath: [] as Path,
    schemaPath,
  });

export const expectRecord = (
  input: unknown,
  schemaPath: readonly (string | number)[],
  message: string,
): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw invalidSchema(schemaPath, message);
  }
  return input as Record<string, unknown>;
};

export const expectString = (
  input: unknown,
  schemaPath: readonly (string | number)[],
  message: string,
): string => {
  if (typeof input !== "string") {
    throw invalidSchema(schemaPath, message);
  }
  return input;
};

export const expectFiniteNumber = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): number => {
  if (typeof input !== "number" || Number.isNaN(input) || !Number.isFinite(input)) {
    throw invalidSchema(schemaPath, "validator value must be a finite number");
  }
  return input;
};

export const parseOptionalBoolean = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): boolean | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input !== "boolean") {
    throw invalidSchema(schemaPath, "required must be a boolean");
  }
  return input;
};

export const parseOptionalString = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): string | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input !== "string") {
    throw invalidSchema(schemaPath, "value must be a string");
  }
  return input;
};

export const parseStringValidators = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): readonly StringValidator[] | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw invalidSchema(schemaPath, "string validators must be an array");
  }
  return input.map((validator, index) => parseStringValidator(validator, [...schemaPath, index]));
};

export const parseNumberValidators = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): readonly NumberValidator[] | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw invalidSchema(schemaPath, "number validators must be an array");
  }
  return input.map((validator, index) => parseNumberValidator(validator, [...schemaPath, index]));
};

export const parseArrayValidators = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): readonly ArrayValidator[] | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw invalidSchema(schemaPath, "array validators must be an array");
  }
  return input.map((validator, index) => parseArrayValidator(validator, [...schemaPath, index]));
};

const parseStringValidator = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): StringValidator => {
  const object = expectRecord(input, schemaPath, "string validator must be an object");
  const kind = expectString(
    object["kind"],
    [...schemaPath, "kind"],
    "validator kind must be a string",
  );

  switch (kind) {
    case "minLength":
    case "maxLength":
    case "length":
      return { kind, value: expectFiniteNumber(object["value"], [...schemaPath, "value"]) };
    case "regex":
      return {
        kind,
        pattern: expectString(
          object["pattern"],
          [...schemaPath, "pattern"],
          "regex pattern must be a string",
        ),
        flags: parseOptionalString(object["flags"], [...schemaPath, "flags"]),
      };
    case "email":
    case "url":
      return { kind };
    default:
      throw invalidSchema(schemaPath, `unknown string validator ${kind}`);
  }
};

const parseNumberValidator = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): NumberValidator => {
  const object = expectRecord(input, schemaPath, "number validator must be an object");
  const kind = expectString(
    object["kind"],
    [...schemaPath, "kind"],
    "validator kind must be a string",
  );

  switch (kind) {
    case "min":
    case "max":
      return { kind, value: expectFiniteNumber(object["value"], [...schemaPath, "value"]) };
    case "positive":
    case "negative":
    case "int":
      return { kind };
    default:
      throw invalidSchema(schemaPath, `unknown number validator ${kind}`);
  }
};

const parseArrayValidator = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): ArrayValidator => {
  const object = expectRecord(input, schemaPath, "array validator must be an object");
  const kind = expectString(
    object["kind"],
    [...schemaPath, "kind"],
    "validator kind must be a string",
  );

  switch (kind) {
    case "minLength":
    case "maxLength":
      return { kind, value: expectFiniteNumber(object["value"], [...schemaPath, "value"]) };
    default:
      throw invalidSchema(schemaPath, `unknown array validator ${kind}`);
  }
};

export const parseDefaultValue = (
  input: unknown,
  schemaPath: readonly (string | number)[],
): Value => {
  const value = input as Value;

  try {
    validateValue(value);
    return value;
  } catch (error) {
    if (isCoreError(error) || error instanceof Error) {
      throw invalidSchema(schemaPath, `default value is not a valid core value: ${error.message}`);
    }
    throw error;
  }
};

export const expectValueKind = (
  schemaKind: Schema["kind"],
  expected: Value["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): void => {
  if (value.kind !== expected) {
    throw makeSchemaError(
      SchemaErrorCodes.TypeMismatch,
      `expected ${schemaKind}, got ${value.kind}`,
      { valuePath, schemaPath },
    );
  }
};

export const expectStringValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): StringValue => {
  expectValueKind(schemaKind, "string", value, valuePath, schemaPath);
  return value as StringValue;
};

export const expectNumberValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): NumberValue => {
  expectValueKind(schemaKind, "number", value, valuePath, schemaPath);
  return value as NumberValue;
};

export const expectBooleanValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): BooleanValue => {
  expectValueKind(schemaKind, "boolean", value, valuePath, schemaPath);
  return value as BooleanValue;
};

export const expectObjectValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): ObjectValue => {
  expectValueKind(schemaKind, "object", value, valuePath, schemaPath);
  return value as ObjectValue;
};

export const expectArrayValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): ArrayValue => {
  expectValueKind(schemaKind, "array", value, valuePath, schemaPath);
  return value as ArrayValue;
};

export const expectTreeValue = (
  schemaKind: Schema["kind"],
  value: Value,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
): TreeValue => {
  expectValueKind(schemaKind, "tree", value, valuePath, schemaPath);
  return value as TreeValue;
};

export const validatorFailed = (
  message: string,
  valuePath: Path,
  schemaPath: readonly (string | number)[],
) =>
  makeSchemaError(SchemaErrorCodes.ValidatorFailed, message, {
    valuePath,
    schemaPath,
  });

export const cloneSchemaDefault = <T extends Value | undefined>(value: T): T =>
  value === undefined ? value : (cloneValue(value) as T);

export const serializeRequired = (required?: boolean): { required?: true } =>
  required ? { required: true } : {};
