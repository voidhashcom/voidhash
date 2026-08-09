import type { Schema, SchemaKind } from "./types.ts";
import type { SchemaModel } from "./model.ts";
import { arraySchemaModel } from "./models/array.ts";
import { booleanSchemaModel } from "./models/boolean.ts";
import { eitherSchemaModel } from "./models/either.ts";
import { literalSchemaModel } from "./models/literal.ts";
import { numberSchemaModel } from "./models/number.ts";
import { objectSchemaModel } from "./models/object.ts";
import { stringSchemaModel } from "./models/string.ts";
import { treeSchemaModel } from "./models/tree.ts";
import { unionSchemaModel } from "./models/union.ts";

type SchemaModels = {
  [K in SchemaKind]: SchemaModel<Extract<Schema, { kind: K }>>;
};

export const schemaModels: SchemaModels = {
  string: stringSchemaModel,
  number: numberSchemaModel,
  boolean: booleanSchemaModel,
  literal: literalSchemaModel,
  object: objectSchemaModel,
  array: arraySchemaModel,
  union: unionSchemaModel,
  either: eitherSchemaModel,
  tree: treeSchemaModel,
};

export const isSchemaKind = (value: string): value is SchemaKind =>
  Object.hasOwn(schemaModels, value);

/**
 * Looks up the model for a runtime schema kind.
 *
 * The result is widened to `SchemaModel<Schema>` so callers can pass the union
 * they hold; that widening is sound to write because {@link SchemaModel}
 * declares its members with method syntax (bivariant parameters).
 */
export const getSchemaModel = (kind: SchemaKind): SchemaModel<Schema> => schemaModels[kind];
