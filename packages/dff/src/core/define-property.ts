import type { Schema } from 'effect';

/**
 * Any schema type that can be used in a struct field.
 * This includes both regular Schema types and PropertySignature types (from optionalWith, etc.)
 */
type AnySchemaOrPropertySignature =
  | Schema.Schema.Any
  | Schema.PropertySignature.Any;

/**
 * Configuration for defining a property without a default
 */
interface PropertyConfigNoDefault<
  TSchema extends AnySchemaOrPropertySignature
> {
  /** Effect Schema for the property value */
  schema: TSchema;
}

/**
 * Configuration for defining a property with a default.
 * Uses NoInfer to prevent TypeScript from inferring A from the default function,
 * ensuring literal types from the schema are preserved.
 */
interface PropertyConfigWithDefault<
  TSchema extends AnySchemaOrPropertySignature,
  A
> {
  /** Effect Schema for the property value */
  schema: TSchema;
  /** Default value factory (can be overridden at node level) */
  default: () => NoInfer<A>;
}

/**
 * Infer the type from a schema or property signature.
 * Both Schema and PropertySignature extend Schema.Variance, so Schema.Schema.Type works for both.
 */
type InferSchemaType<T> = T extends { readonly [Schema.TypeId]: unknown }
  ? Schema.Schema.Type<T>
  : unknown;

/**
 * Property definition with schema and optional default.
 * Use the `.default()` builder method to override defaults at node level.
 *
 * @typeParam Name - The property name (literal string type)
 * @typeParam TSchema - The Effect Schema type for this property
 * @typeParam A - The TypeScript type of the property value
 * @typeParam HasDefault - Whether this property has a default value factory
 */
export interface PropertyDef<
  Name extends string = string,
  TSchema extends AnySchemaOrPropertySignature = AnySchemaOrPropertySignature,
  A = unknown,
  HasDefault extends boolean = boolean
> {
  readonly _tag: 'PropertyDef';
  readonly name: Name;
  readonly schema: TSchema;
  readonly getDefault: HasDefault extends true ? () => A : undefined;
  /** Builder method to create a new property def with overridden default */
  default(fn: () => A): PropertyDef<Name, TSchema, A, true>;
}

/**
 * Define a reusable property with schema and optional default value.
 *
 * @example
 * ```ts
 * // Property with default
 * export const paddingLeft = defineProperty('paddingLeft', {
 *   schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
 *   default: () => 0
 * });
 *
 * // Property without default
 * export const customProp = defineProperty('customProp', {
 *   schema: Schema.String
 * });
 *
 * // Override default at node level using builder pattern
 * defineNode('screen', {
 *   properties: [paddingLeft.default(() => 16)]
 * });
 * ```
 */
export function defineProperty<
  Name extends string,
  TSchema extends AnySchemaOrPropertySignature,
  A extends InferSchemaType<TSchema> = InferSchemaType<TSchema>
>(
  name: Name,
  config: PropertyConfigWithDefault<TSchema, A>
): PropertyDef<Name, TSchema, InferSchemaType<TSchema>, true>;

export function defineProperty<
  Name extends string,
  TSchema extends AnySchemaOrPropertySignature
>(
  name: Name,
  config: PropertyConfigNoDefault<TSchema>
): PropertyDef<Name, TSchema, InferSchemaType<TSchema>, false>;

export function defineProperty<
  Name extends string,
  TSchema extends AnySchemaOrPropertySignature,
  A extends InferSchemaType<TSchema> = InferSchemaType<TSchema>
>(
  name: Name,
  config:
    | PropertyConfigNoDefault<TSchema>
    | PropertyConfigWithDefault<TSchema, A>
): PropertyDef<Name, TSchema, InferSchemaType<TSchema>, boolean> {
  type SchemaType = InferSchemaType<TSchema>;
  const hasDefault = 'default' in config && config.default !== undefined;
  return {
    _tag: 'PropertyDef' as const,
    name,
    schema: config.schema,
    getDefault: hasDefault ? config.default : undefined,
    default(
      fn: () => SchemaType
    ): PropertyDef<Name, TSchema, SchemaType, true> {
      return defineProperty(name, { schema: config.schema, default: fn });
    }
  } as PropertyDef<Name, TSchema, SchemaType, boolean>;
}

/**
 * Type guard to check if a value is a PropertyDef
 */
export function isPropertyDef(value: unknown): value is PropertyDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    value._tag === 'PropertyDef'
  );
}

/**
 * Extract the schema type from a PropertyDef
 */
export type PropertyDefSchema<P extends PropertyDef> = P extends PropertyDef<
  string,
  infer TSchema,
  unknown,
  boolean
>
  ? TSchema
  : never;

/**
 * Extract the value type from a PropertyDef by inferring from the schema
 */
export type PropertyDefType<P extends PropertyDef> = P extends PropertyDef<
  string,
  infer TSchema,
  unknown,
  boolean
>
  ? InferSchemaType<TSchema>
  : never;

/**
 * Extract the name from a PropertyDef
 */
export type PropertyDefName<P extends PropertyDef> = P extends PropertyDef<
  infer N,
  AnySchemaOrPropertySignature,
  unknown,
  boolean
>
  ? N
  : never;

/**
 * Check if a PropertyDef has a default value
 */
export type PropertyDefHasDefault<P extends PropertyDef> =
  P extends PropertyDef<string, AnySchemaOrPropertySignature, unknown, infer H>
    ? H
    : false;
