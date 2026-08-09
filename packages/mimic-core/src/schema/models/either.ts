import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import { cloneSchemaDefault, serializeRequired } from "../shared.ts";
import type { EitherSchema } from "../types.ts";
import type { Mutable } from "../../internal/lang.ts";

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
    );
  },
  serialize: (schema, serializeSchema) => {
    const serialized: Mutable<EitherSchema> = {
      kind: "either",
      variants: schema.variants.map((variant) => serializeSchema(variant)),
      ...serializeRequired(schema.required),
    };
    if (schema.default !== undefined) {
      serialized.default = cloneSchemaDefault(schema.default);
    }
    return serialized;
  },
  validate: (schema, value, context, valuePath, schemaPath) => {
    const failures: Error[] = [];

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
          failures.push(error);
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
