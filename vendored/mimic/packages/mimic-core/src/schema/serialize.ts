import { getSchemaModel } from "./registry.ts";
import type { Schema, SchemaObject } from "./types.ts";

export const serializeSchema = (schema: Schema): SchemaObject => serializeSchemaInternal(schema);

const serializeSchemaInternal = (schema: Schema): SchemaObject =>
  getSchemaModel(schema.kind).serialize(schema, serializeSchemaInternal);
