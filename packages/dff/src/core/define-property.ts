import type { Schema } from 'effect';

/**
 * Any schema type that can be used in a struct field.
 * This includes both regular Schema types and PropertySignature types (from optionalWith, etc.)
 */
type AnySchemaOrPropertySignature =
  | Schema.Schema.Any
  | Schema.PropertySignature.Any;

/**
 * Configuration for defining a property
 */
interface PropertyConfig<TSchema extends AnySchemaOrPropertySignature, A> {
  /** Effect Schema for the property value */
  schema: TSchema;
  /** Default value factory (can be overridden at node level) */
  default?: () => A;
}

/**
 * Infer the type from a schema or property signature.
 * For PropertySignature, we extract the TypeA (second type parameter).
 */
type InferSchemaType<T> = T extends Schema.Schema.Any
  ? Schema.Schema.Type<T>
  : T extends {
        readonly Type: infer TypeA;
      }
    ? TypeA
    : unknown;

/**
 * Property definition with schema and optional default.
 * Use the `.default()` builder method to override defaults at node level.
 *
 * @typeParam Name - The property name (literal string type)
 * @typeParam TSchema - The Effect Schema type for this property
 * @typeParam A - The TypeScript type of the property value
 */
export interface PropertyDef<
  Name extends string = string,
  TSchema extends AnySchemaOrPropertySignature = AnySchemaOrPropertySignature,
  A = unknown
> {
  readonly _tag: 'PropertyDef';
  readonly name: Name;
  readonly schema: TSchema;
  readonly getDefault: (() => A) | undefined;
  /** Builder method to create a new property def with overridden default */
  default(fn: () => A): PropertyDef<Name, TSchema, A>;
}

/**
 * Define a reusable property with schema and optional default value.
 *
 * @example
 * ```ts
 * // Simple property with default
 * export const paddingLeft = defineProperty('paddingLeft', {
 *   schema: Schema.optionalWith(Schema.Number, { default: () => 0 })
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
  A = InferSchemaType<TSchema>
>(
  name: Name,
  config: PropertyConfig<TSchema, A>
): PropertyDef<Name, TSchema, A> {
  return {
    _tag: 'PropertyDef' as const,
    name,
    schema: config.schema,
    getDefault: config.default,
    default(fn: () => A): PropertyDef<Name, TSchema, A> {
      return defineProperty(name, { schema: config.schema, default: fn });
    }
  };
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
  unknown
>
  ? TSchema
  : never;

/**
 * Extract the value type from a PropertyDef
 */
export type PropertyDefType<P extends PropertyDef> = P extends PropertyDef<
  string,
  AnySchemaOrPropertySignature,
  infer A
>
  ? A
  : never;

/**
 * Extract the name from a PropertyDef
 */
export type PropertyDefName<P extends PropertyDef> = P extends PropertyDef<
  infer N,
  AnySchemaOrPropertySignature,
  unknown
>
  ? N
  : never;
