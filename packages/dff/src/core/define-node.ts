import { Schema } from 'effect';
import type {
  PropertyDef,
  PropertyDefHasDefault,
  PropertyDefName,
  PropertyDefSchema,
  PropertyDefType
} from './define-property';

/**
 * Parent reference schema - used for all non-root nodes
 */
export const ParentRefSchema = Schema.Struct({
  id: Schema.String,
  /** Fractional index for ordering */
  index: Schema.String
});

export type ParentRef = Schema.Schema.Type<typeof ParentRefSchema>;

// ============================================================================
// Type-level utilities for building node data types from properties
// ============================================================================

/**
 * Any schema type that can be used in a struct field
 */
type AnySchemaOrPropertySignature =
  | Schema.Schema.Any
  | Schema.PropertySignature.Any;

/**
 * Convert a tuple/array of PropertyDefs into a record type mapping names to schema types
 */
type PropertiesToSchemaFields<Props extends readonly PropertyDef[]> = {
  [K in Props[number] as PropertyDefName<K>]: PropertyDefSchema<K>;
};

/**
 * The base fields every node has
 */
type BaseNodeFields<Type extends string> = {
  type: Schema.Literal<[Type]>;
  id: typeof Schema.String;
  name: typeof Schema.String;
  parent: typeof ParentRefSchema;
};

/**
 * Combine base fields with property fields to get the full schema fields type
 */
type NodeSchemaFields<
  Type extends string,
  Props extends readonly PropertyDef[]
> = BaseNodeFields<Type> & PropertiesToSchemaFields<Props>;

/**
 * The full node schema type
 */
type NodeSchema<
  Type extends string,
  Props extends readonly PropertyDef[]
> = Schema.Struct<NodeSchemaFields<Type, Props>>;

/**
 * Extract the data type from a node schema
 */
type NodeDataFromSchema<
  Type extends string,
  Props extends readonly PropertyDef[]
> = Schema.Schema.Type<NodeSchema<Type, Props>>;

/**
 * Type for getDefaults return value - includes type, name, and property values.
 * Only properties with defaults are included (as required fields).
 */
type NodeDefaultsType<
  Type extends string,
  Props extends readonly PropertyDef[]
> = {
  type: Type;
  name: string;
} & {
  [K in Props[number] as PropertyDefHasDefault<K> extends true
    ? PropertyDefName<K>
    : never]: PropertyDefType<K>;
};

// ============================================================================
// Node Definition Types
// ============================================================================

/**
 * Configuration for defining a node
 */
interface NodeConfig<Props extends readonly PropertyDef[]> {
  /** Properties that make up this node */
  properties: Props;
  /** Allowed child node types (references to other NodeDefs) */
  children?: readonly NodeDef[];
  /** Whether this node can be a root node in a canvas */
  root?: boolean;
  /** Default name for new instances of this node */
  defaultName?: string;
}

/**
 * Node definition with schema, properties, and metadata.
 *
 * @typeParam Type - The node type string literal
 * @typeParam Props - The tuple of property definitions
 * @typeParam TData - The inferred data type for this node
 * @typeParam TSchema - The schema type for this node
 */
export interface NodeDef<
  Type extends string = string,
  Props extends readonly PropertyDef[] = readonly PropertyDef[],
  TData = unknown,
  TSchema extends Schema.Schema.Any = Schema.Schema.Any
> {
  readonly _tag: 'NodeDef';
  readonly type: Type;
  readonly properties: Props;
  readonly children: readonly NodeDef[];
  readonly isRoot: boolean;
  readonly defaultName: string;
  /** The composed Effect Schema for this node */
  readonly schema: TSchema;
  /** Get default values for creating a new node (without id/parent) */
  getDefaults(): NodeDefaultsType<Type, Props>;
  /** Phantom type for the node data */
  readonly _data: TData;
}

/**
 * Build an Effect Schema struct fields object from property definitions
 */
function buildSchemaFields(
  properties: readonly PropertyDef[]
): Schema.Struct.Fields {
  const fields: Record<string, AnySchemaOrPropertySignature> = {};
  for (const prop of properties) {
    fields[prop.name] = prop.schema;
  }
  return fields as Schema.Struct.Fields;
}

/**
 * Build default values from property definitions
 */
function buildDefaults<
  Type extends string,
  Props extends readonly PropertyDef[]
>(
  type: Type,
  defaultName: string,
  properties: Props
): NodeDefaultsType<Type, Props> {
  const defaults: Record<string, unknown> = {
    type,
    name: defaultName
  };

  for (const prop of properties) {
    if (prop.getDefault) {
      defaults[prop.name] = prop.getDefault();
    }
  }

  return defaults as NodeDefaultsType<Type, Props>;
}

/**
 * Define a node type with its properties and configuration.
 * The data type is automatically inferred from the properties.
 *
 * @example
 * ```ts
 * export const textNode = defineNode('text', {
 *   properties: [fontSize, color, fontWeight, textAlign],
 *   children: [],
 *   defaultName: 'Text'
 * });
 *
 * // Type is automatically inferred:
 * type TextNodeData = NodeDefData<typeof textNode>;
 * // { type: 'text', id: string, name: string, parent: ParentRef, fontSize: number, ... }
 * ```
 */
export function defineNode<
  Type extends string,
  const Props extends readonly PropertyDef[]
>(
  type: Type,
  config: NodeConfig<Props>
): NodeDef<
  Type,
  Props,
  NodeDataFromSchema<Type, Props>,
  NodeSchema<Type, Props>
> {
  const {
    properties,
    children = [],
    root = false,
    defaultName = type
  } = config;

  // Build the schema fields from properties
  const propertyFields = buildSchemaFields(properties);

  // Create the full node schema with base fields
  const schema = Schema.Struct({
    type: Schema.Literal(type),
    id: Schema.String,
    name: Schema.String,
    parent: ParentRefSchema,
    ...propertyFields
  });

  return {
    _tag: 'NodeDef' as const,
    type,
    properties,
    children,
    isRoot: root,
    defaultName,
    schema: schema as unknown as NodeSchema<Type, Props>,
    getDefaults() {
      return buildDefaults(type, defaultName, properties);
    },
    _data: undefined as unknown as NodeDataFromSchema<Type, Props>
  };
}

/**
 * Type guard to check if a value is a NodeDef
 */
export function isNodeDef(value: unknown): value is NodeDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    value._tag === 'NodeDef'
  );
}

/**
 * Extract the data type from a NodeDef.
 * This gives you the full typed object shape for the node.
 *
 * @example
 * ```ts
 * type ColumnNodeData = NodeDefData<typeof columnNode>;
 * // { type: 'column', id: string, name: string, parent: ParentRef, gap: number, ... }
 * ```
 */
export type NodeDefData<N extends NodeDef> = N extends NodeDef<
  string,
  readonly PropertyDef[],
  infer TData
>
  ? TData
  : never;

/**
 * Extract the type literal from a NodeDef
 */
export type NodeDefType<N extends NodeDef> = N extends NodeDef<infer Type>
  ? Type
  : never;
