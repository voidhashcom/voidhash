import { HiddenTreeRootId } from "../../core/types.ts";
import type { ObjectValue } from "../../core/types.ts";
import { makeSchemaError, SchemaErrorCodes } from "../errors.ts";
import type { SchemaModel } from "../model.ts";
import { cloneSchemaDefault, expectRecord, expectString, serializeRequired } from "../shared.ts";
import type { ObjectSchema, TreeSchema, TreeVariantSchema } from "../types.ts";

export const treeSchemaModel: SchemaModel<TreeSchema> = {
  kind: "tree",
  parse: (input, metadata, context, schemaPath) => {
    const discriminator = expectString(
      input["discriminator"],
      [...schemaPath, "discriminator"],
      "tree discriminator must be a string",
    );
    const roots = input["roots"];
    if (!Array.isArray(roots) || !roots.every((item) => typeof item === "string")) {
      throw makeSchemaError(SchemaErrorCodes.InvalidSchema, "tree roots must be a string array", {
        schemaPath: [...schemaPath, "roots"],
      });
    }

    const variantsObject = expectRecord(
      input["variants"],
      [...schemaPath, "variants"],
      "tree variants must be an object",
    );
    const variants: Record<string, TreeVariantSchema> = {};

    for (const [key, variant] of Object.entries(variantsObject)) {
      const variantObject = expectRecord(
        variant,
        [...schemaPath, "variants", key],
        "tree variant must be an object",
      );
      const parsedSchema = context.parseSchema(variantObject["schema"], [
        ...schemaPath,
        "variants",
        key,
        "schema",
      ]);
      if (parsedSchema.kind !== "object") {
        throw makeSchemaError(
          SchemaErrorCodes.InvalidSchema,
          "tree variant schema must be an object schema",
          { schemaPath: [...schemaPath, "variants", key, "schema"] },
        );
      }
      const discriminatorField = parsedSchema.fields[discriminator];
      if (discriminatorField?.kind !== "literal" || discriminatorField.value !== key) {
        throw makeSchemaError(
          SchemaErrorCodes.InvalidSchema,
          "tree discriminator field must be a matching literal",
          {
            schemaPath: [...schemaPath, "variants", key, "schema", "fields", discriminator],
          },
        );
      }

      const children = variantObject["children"];
      if (!Array.isArray(children) || !children.every((item) => typeof item === "string")) {
        throw makeSchemaError(
          SchemaErrorCodes.InvalidSchema,
          "tree variant children must be a string array",
          { schemaPath: [...schemaPath, "variants", key, "children"] },
        );
      }

      variants[key] = {
        schema: parsedSchema,
        children: [...children],
      };
    }

    for (const root of roots) {
      if (!Object.hasOwn(variants, root)) {
        throw makeSchemaError(SchemaErrorCodes.InvalidSchema, `unknown tree root variant ${root}`, {
          schemaPath: [...schemaPath, "roots"],
        });
      }
    }

    for (const [key, variant] of Object.entries(variants)) {
      for (const child of variant.children) {
        if (!Object.hasOwn(variants, child)) {
          throw makeSchemaError(
            SchemaErrorCodes.InvalidSchema,
            `unknown tree child variant ${child}`,
            { schemaPath: [...schemaPath, "variants", key, "children"] },
          );
        }
      }
    }

    return context.normalizeDefault(
      {
        kind: metadata.kind,
        required: metadata.required,
        discriminator,
        roots: [...roots],
        variants,
      },
      input["default"],
      schemaPath,
    ) as TreeSchema;
  },
  serialize: (schema, serializeSchema) => {
    const variants: Record<string, TreeVariantSchema> = {};
    for (const [key, variant] of Object.entries(schema.variants)) {
      variants[key] = {
        schema: serializeSchema(variant.schema) as ObjectSchema,
        children: [...variant.children],
      };
    }

    return {
      kind: "tree",
      discriminator: schema.discriminator,
      roots: [...schema.roots],
      variants,
      ...serializeRequired(schema.required),
      ...(schema.default !== undefined ? { default: cloneSchemaDefault(schema.default) } : {}),
    };
  },
  validate: (schema, value, context, valuePath, schemaPath) => {
    const tree = (() => {
      if (value.kind !== "tree") {
        throw makeSchemaError(
          SchemaErrorCodes.TypeMismatch,
          `expected ${schema.kind}, got ${value.kind}`,
          { valuePath, schemaPath },
        );
      }
      return value;
    })();

    const nodeVariants = new Map<string, string>();
    const nextNodes = tree.nodes.map((node) => {
      const discriminator = node.value.fields[schema.discriminator];
      if (discriminator === undefined || discriminator.kind !== "string") {
        throw makeSchemaError(
          SchemaErrorCodes.TreeUnknownVariant,
          "tree node discriminator is missing or invalid",
          {
            valuePath: [
              ...valuePath,
              { kind: "node", id: node.id },
              { kind: "field", key: schema.discriminator },
            ],
            schemaPath: [...schemaPath, "discriminator"],
          },
        );
      }

      const variant = schema.variants[discriminator.value];
      if (!variant) {
        throw makeSchemaError(
          SchemaErrorCodes.TreeUnknownVariant,
          `unknown tree variant ${discriminator.value}`,
          {
            valuePath: [
              ...valuePath,
              { kind: "node", id: node.id },
              { kind: "field", key: schema.discriminator },
            ],
            schemaPath: [...schemaPath, "variants"],
          },
        );
      }

      const sanitizedValue = context.validate(
        variant.schema,
        node.value,
        [...valuePath, { kind: "node", id: node.id }],
        [...schemaPath, "variants", discriminator.value, "schema"],
      );
      nodeVariants.set(node.id, discriminator.value);

      return {
        id: node.id,
        parent: node.parent,
        pos: node.pos,
        value: sanitizedValue as ObjectValue,
      };
    });

    for (const node of nextNodes) {
      const nodeVariant = nodeVariants.get(node.id)!;
      if (node.parent === HiddenTreeRootId) {
        if (!schema.roots.includes(nodeVariant)) {
          throw makeSchemaError(
            SchemaErrorCodes.TreeInvalidRootType,
            `tree root type ${nodeVariant} is not allowed`,
            {
              valuePath: [...valuePath, { kind: "node", id: node.id }],
              schemaPath: [...schemaPath, "roots"],
            },
          );
        }
        continue;
      }

      const parentVariant = nodeVariants.get(node.parent);
      if (!parentVariant) {
        throw makeSchemaError(
          SchemaErrorCodes.TreeUnknownVariant,
          "tree parent variant is missing",
          {
            valuePath: [...valuePath, { kind: "node", id: node.id }],
            schemaPath,
          },
        );
      }

      const allowedChildren = schema.variants[parentVariant]!.children;
      if (!allowedChildren.includes(nodeVariant)) {
        throw makeSchemaError(
          SchemaErrorCodes.TreeInvalidChildType,
          `tree child type ${nodeVariant} is not allowed under ${parentVariant}`,
          {
            valuePath: [...valuePath, { kind: "node", id: node.id }],
            schemaPath: [...schemaPath, "variants", parentVariant, "children"],
          },
        );
      }
    }

    return { kind: "tree", nodes: nextNodes };
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
