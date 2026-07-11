import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import {
  cloneSchemaDefault,
  expectArrayValue,
  parseArrayValidators,
  serializeRequired,
  validatorFailed,
} from "../shared.ts";
import type { ArraySchema } from "../types.ts";

export const arraySchemaModel: SchemaModel<ArraySchema> = {
  kind: "array",
  parse: (input, metadata, context, schemaPath) =>
    context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        element: context.parseSchema(input["element"], [...schemaPath, "element"]),
        validators: parseArrayValidators(input["validators"], [...schemaPath, "validators"]),
      },
      input["default"],
      schemaPath,
    ) as ArraySchema,
  serialize: (schema, serializeSchema) => ({
    kind: "array",
    element: serializeSchema(schema.element),
    ...serializeRequired(schema.required),
    ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
    ...(schema.validators && schema.validators.length > 0
      ? { validators: schema.validators.map((validator) => ({ ...validator })) }
      : {}),
  }),
  validate: (schema, value, context, valuePath, schemaPath) => {
    const array = expectArrayValue(schema.kind, value, valuePath, schemaPath);
    const items = array.items.map((item) => {
      const next = context.validate(
        schema.element,
        item.value,
        [...valuePath, { kind: "item", id: item.id }],
        [...schemaPath, "element"],
      );

      if (next === undefined) {
        throw makeSchemaError(
          SchemaErrorCodes.TypeMismatch,
          "array item cannot sanitize to undefined",
          {
            valuePath: [...valuePath, { kind: "item", id: item.id }],
            schemaPath,
          },
        );
      }

      return { id: item.id, pos: item.pos, value: next };
    });

    for (const validator of schema.validators ?? []) {
      switch (validator.kind) {
        case "minLength":
          if (items.length < validator.value) {
            throw validatorFailed("array shorter than minLength", valuePath, schemaPath);
          }
          break;
        case "maxLength":
          if (items.length > validator.value) {
            throw validatorFailed("array longer than maxLength", valuePath, schemaPath);
          }
          break;
      }
    }

    return { kind: "array", items };
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
