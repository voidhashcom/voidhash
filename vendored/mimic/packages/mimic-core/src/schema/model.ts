import type { Path, Value } from "../core/types.ts";
import type { Schema, SchemaKind, SchemaObject } from "./types.ts";

export interface ParseContext {
  readonly parseSchema: (input: unknown, schemaPath: readonly (string | number)[]) => Schema;
  readonly normalizeDefault: <TSchema extends Schema>(
    schema: TSchema,
    rawDefault: unknown,
    schemaPath: readonly (string | number)[],
  ) => TSchema;
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

/**
 * Per-kind behaviour for one schema node.
 *
 * The members are declared with method syntax on purpose: method parameters are
 * checked bivariantly, so a concrete `SchemaModel<ArraySchema>` is assignable to
 * `SchemaModel<Schema>`. That is what lets {@link getSchemaModel} hand back a
 * model for a runtime kind without a type assertion.
 */
export interface SchemaModel<TSchema extends Schema = Schema> {
  readonly kind: TSchema["kind"];
  parse(
    input: Record<string, unknown>,
    metadata: ParseMetadata<TSchema["kind"]>,
    context: ParseContext,
    schemaPath: readonly (string | number)[],
  ): TSchema;
  serialize(schema: TSchema, serializeSchema: (schema: Schema) => SchemaObject): TSchema;
  validate(
    schema: TSchema,
    value: Value,
    context: ValidationContext,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ): Value;
  materializeDefault(
    schema: TSchema,
    context: DefaultContext,
    valuePath: Path,
    schemaPath: readonly (string | number)[],
  ): Value | undefined;
}
