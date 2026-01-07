/**
 * Symbols used to identify schema entity types at runtime.
 * These allow the CLI to reliably detect entity types without duck typing.
 */

export const SCHEMA_KIND = Symbol.for("voidhash.schema.kind");

export const SchemaKind = {
  Perk: "perk",
  Product: "product",
  SchemaConfiguration: "schema-configuration",
} as const;

export type SchemaKindValue = (typeof SchemaKind)[keyof typeof SchemaKind];
