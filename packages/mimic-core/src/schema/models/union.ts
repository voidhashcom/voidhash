import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  expectObjectValue,
  expectRecord,
  expectString,
  serializeRequired,
} from "../shared.ts";
import type { ObjectSchema, UnionSchema } from "../types.ts";

export const unionSchemaModel: SchemaModel<UnionSchema> = {
  kind: "union",
  parse: (input, metadata, context, schemaPath) => {
    const discriminator = expectString(
      input["discriminator"],
      [...schemaPath, "discriminator"],
      "union discriminator must be a string",
    );
    const variantsObject = expectRecord(
      input["variants"],
      [...schemaPath, "variants"],
      "union variants must be an object",
    );
    const variants: Record<string, ObjectSchema> = {};

    for (const [key, variant] of Object.entries(variantsObject)) {
      const parsed = context.parseSchema(variant, [...schemaPath, "variants", key]);
      if (parsed.kind !== "object") {
        throw makeSchemaError(
          SchemaErrorCodes.InvalidSchema,
          "union variants must be object schemas",
          { schemaPath: [...schemaPath, "variants", key] },
        );
      }
      const discriminatorField = parsed.fields[discriminator];
      if (discriminatorField?.kind !== "literal" || discriminatorField.value !== key) {
        throw makeSchemaError(
          SchemaErrorCodes.InvalidSchema,
          "union discriminator field must be a matching literal",
          { schemaPath: [...schemaPath, "variants", key, "fields", discriminator] },
        );
      }
      variants[key] = parsed;
    }

    return context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        discriminator,
        variants,
      },
      input["default"],
      schemaPath,
    ) as UnionSchema;
  },
  serialize: (schema, serializeSchema) => {
    const variants: Record<string, ObjectSchema> = {};
    for (const [key, variant] of Object.entries(schema.variants)) {
      variants[key] = serializeSchema(variant) as ObjectSchema;
    }

    return {
      kind: "union",
      discriminator: schema.discriminator,
      variants,
      ...serializeRequired(schema.required),
      ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
    };
  },
  validate: (schema, value, context, valuePath, schemaPath) => {
    const object = expectObjectValue(schema.kind, value, valuePath, schemaPath);
    const discriminatorValue = object.fields[schema.discriminator];

    if (discriminatorValue === undefined || discriminatorValue.kind !== "string") {
      throw makeSchemaError(
        SchemaErrorCodes.UnionNoMatch,
        "union discriminator is missing or invalid",
        {
          valuePath: [...valuePath, { kind: "field", key: schema.discriminator }],
          schemaPath: [...schemaPath, "discriminator"],
        },
      );
    }

    const variant = schema.variants[discriminatorValue.value];
    if (!variant) {
      throw makeSchemaError(
        SchemaErrorCodes.UnionNoMatch,
        `unknown union discriminator ${discriminatorValue.value}`,
        {
          valuePath: [...valuePath, { kind: "field", key: schema.discriminator }],
          schemaPath: [...schemaPath, "variants"],
        },
      );
    }

    return context.validate(variant, object, valuePath, [
      ...schemaPath,
      "variants",
      discriminatorValue.value,
    ])!;
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
