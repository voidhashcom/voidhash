import type { Path, Value } from "../core/types.ts";
import type { Schema, SchemaKind, SchemaObject } from "./types.ts";

export interface ParseContext {
  readonly parseSchema: (input: unknown, schemaPath: readonly (string | number)[]) => Schema;
  readonly normalizeDefault: (
    schema: Schema,
    rawDefault: unknown,
    schemaPath: readonly (string | number)[],
  ) => Schema;
}

export interface DefaultContext {
  readonly materializeDefault: (
    schema: Schema,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ) => Value | undefined;
}

export interface ValidationContext extends DefaultContext {
  readonly validate: (
    schema: Schema,
    value: Value | undefined,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ) => Value | undefined;
}

export interface ParseMetadata<K extends SchemaKind = SchemaKind> {
  readonly kind: K;
  readonly required?: boolean;
}

export interface SchemaModel<TSchema extends Schema = Schema> {
  readonly kind: TSchema["kind"];
  readonly parse: (
    input: Record<string, unknown>,
    metadata: ParseMetadata<TSchema["kind"]>,
    context: ParseContext,
    schemaPath: readonly (string | number)[],
  ) => TSchema;
  readonly serialize: (
    schema: TSchema,
    serializeSchema: (schema: Schema) => SchemaObject,
  ) => SchemaObject;
  readonly validate: (
    schema: TSchema,
    value: Value,
    context: ValidationContext,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ) => Value;
  readonly materializeDefault: (
    schema: TSchema,
    context: DefaultContext,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ) => Value | undefined;
}
