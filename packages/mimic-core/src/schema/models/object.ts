import { objectValue, type Value } from "../../core/types.ts";
import { isSchemaError, makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  expectRecord,
  expectObjectValue,
  serializeRequired,
} from "../shared.ts";
import type { ObjectSchema, Schema, SchemaObject } from "../types.ts";

export const objectSchemaModel: SchemaModel<ObjectSchema> = {
  kind: "object",
  parse: (input, metadata, context, schemaPath) => {
    const fieldsObject = expectRecord(
      input["fields"],
      [...schemaPath, "fields"],
      "object schema fields must be an object",
    );
    const fields: Record<string, Schema> = {};

    for (const [key, fieldSchema] of Object.entries(fieldsObject)) {
      fields[key] = context.parseSchema(fieldSchema, [...schemaPath, "fields", key]);
    }

    return context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        fields,
      },
      input["default"],
      schemaPath,
    ) as ObjectSchema;
  },
  serialize: (schema, serializeSchema) => {
    const fields: Record<string, SchemaObject> = {};
    for (const [key, field] of Object.entries(schema.fields)) {
      fields[key] = serializeSchema(field);
    }

    return {
      kind: "object",
      fields,
      ...serializeRequired(schema.required),
      ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
    };
  },
  validate: (schema, value, context, valuePath, schemaPath) => {
    const object = expectObjectValue(schema.kind, value, valuePath, schemaPath);
    const fields: Record<string, Value> = {};

    for (const [key, fieldSchema] of Object.entries(schema.fields)) {
      const next = context.validate(
        fieldSchema,
        object.fields[key],
        [...valuePath, { kind: "field", key }],
        [...schemaPath, "fields", key],
      );
      if (next !== undefined) {
        fields[key] = next;
      }
    }

    return objectValue(fields);
  },
  materializeDefault: (schema, context, valuePath, schemaPath) => {
    const fields: Record<string, Value> = {};
    let hasAnyField = false;

    for (const [key, fieldSchema] of Object.entries(schema.fields)) {
      let child: Value | undefined;
      try {
        child = context.materializeDefault(
          fieldSchema,
          [...valuePath, { kind: "field", key }],
          [...schemaPath, "fields", key],
        );
      } catch (error) {
        // An optional object whose fields cannot self-construct (a required
        // descendant without a default) materializes as absent — absence is
        // the documented encoding for "no value" (e.g. an optional cursor
        // struct with required x/y). A required object must self-construct,
        // so the failure propagates.
        if (
          !schema.required &&
          isSchemaError(error) &&
          error.code === SchemaErrorCodes.MissingRequired
        ) {
          return undefined;
        }
        throw error;
      }
      if (child !== undefined) {
        fields[key] = child;
        hasAnyField = true;
      }
    }

    if (hasAnyField) {
      return objectValue(fields);
    }
    if (schema.required) {
      throw makeSchemaError(
        SchemaErrorCodes.MissingRequired,
        "required object has no defaultable fields",
        { valuePath, schemaPath },
      );
    }
    return undefined;
  },
};
