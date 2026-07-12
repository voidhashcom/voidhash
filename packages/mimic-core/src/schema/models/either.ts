import { makeSchemaError, SchemaErrorCodes, type SchemaError } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import { cloneSchemaDefault, serializeRequired } from "../shared.ts";
import type { EitherSchema } from "../types.ts";

export const eitherSchemaModel: SchemaModel<EitherSchema> = {
  kind: "either",
  parse: (input, metadata, context, schemaPath) => {
    if (!Array.isArray(input["variants"])) {
      throw makeSchemaError(SchemaErrorCodes.InvalidSchema, "either variants must be an array", {
        schemaPath: [...schemaPath, "variants"],
      });
    }

    return context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        variants: input["variants"].map((variant, index) =>
          context.parseSchema(variant, [...schemaPath, "variants", index]),
        ),
      },
      input["default"],
      schemaPath,
    ) as EitherSchema;
  },
  serialize: (schema, serializeSchema) => ({
    kind: "either",
    variants: schema.variants.map((variant) => serializeSchema(variant)),
    ...serializeRequired(schema.required),
    ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
  }),
  validate: (schema, value, context, valuePath, schemaPath) => {
    const failures: SchemaError[] = [];

    for (let index = 0; index < schema.variants.length; index += 1) {
      try {
        const next = context.validate(schema.variants[index]!, value, valuePath, [
          ...schemaPath,
          "variants",
          index,
        ]);
        if (next !== undefined) {
          return next;
        }
      } catch (error) {
        if (error instanceof Error) {
          failures.push(error as SchemaError);
        }
      }
    }

    throw makeSchemaError(
      SchemaErrorCodes.EitherNoMatch,
      failures[0]?.message ?? "no either variant matched",
      { valuePath, schemaPath },
    );
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
