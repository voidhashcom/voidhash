import { Schema } from 'effect';
import { defineCanvas } from '../core/define-canvas';
import { defineNode, type NodeDefData } from '../core/define-node';
import {
  alignItems,
  backgroundColor,
  backgroundColorNullable,
  color,
  fontSize,
  fontWeight,
  gap,
  height,
  justifyContent,
  letterSpacing,
  lineHeight,
  paddingProperties,
  safeAreaProperties,
  text,
  textAlign,
  width,
  x,
  y
} from './properties';

export type { ParentRef } from '../core/define-node';
// Re-export ParentRef from core
export { ParentRefSchema } from '../core/define-node';

// ============================================================================
// Node Definitions (using new abstraction)
// ============================================================================

/**
 * Screen node - root container for a design screen
 */
export const screenNode = defineNode('screen', {
  properties: [
    x,
    y,
    width,
    height,
    backgroundColor,
    ...paddingProperties,
    ...safeAreaProperties
  ],
  root: true,
  defaultName: 'Screen'
});

/**
 * Text node - displays text content
 */
export const textNode = defineNode('text', {
  properties: [
    x,
    y,
    text,
    fontSize,
    color,
    fontWeight,
    textAlign,
    lineHeight,
    letterSpacing
  ],
  children: [],
  defaultName: 'Text'
});

/**
 * Column node - vertical flex container
 */
export const columnNode = defineNode('column', {
  properties: [
    gap,
    ...paddingProperties,
    justifyContent,
    alignItems,
    backgroundColorNullable
  ],
  defaultName: 'Column'
});

/**
 * Row node - horizontal flex container
 */
export const rowNode = defineNode('row', {
  properties: [
    gap,
    ...paddingProperties,
    justifyContent,
    alignItems,
    backgroundColorNullable
  ],
  defaultName: 'Row'
});

// ============================================================================
// Design Canvas Definition
// ============================================================================

/**
 * Design canvas - for UI design with screens, text, columns, rows
 */
export const designCanvas = defineCanvas('design', {
  nodes: [screenNode, textNode, columnNode, rowNode]
});

// ============================================================================
// Derived Types (auto-generated from node definitions)
// ============================================================================

/** Screen node data type - inferred from screenNode definition */
export type ScreenNodeData = NodeDefData<typeof screenNode>;

/** Text node data type - inferred from textNode definition */
export type TextNodeData = NodeDefData<typeof textNode>;

/** Column node data type - inferred from columnNode definition */
export type ColumnNodeData = NodeDefData<typeof columnNode>;

/** Row node data type - inferred from rowNode definition */
export type RowNodeData = NodeDefData<typeof rowNode>;

// ============================================================================
// Root Node (special case - no parent reference)
// ============================================================================

/** Root node schema */
export const RootNodeSchema = Schema.Struct({
  type: Schema.Literal('root'),
  id: Schema.String
});

/** Root node data type */
export type RootNodeData = Schema.Schema.Type<typeof RootNodeSchema>;

// ============================================================================
// Schemas (for encoding/decoding)
// ============================================================================

/** Screen node schema - extracted from screenNode */
export const ScreenNodeSchema = screenNode.schema;

/** Text node schema - extracted from textNode */
export const TextNodeSchema = textNode.schema;

/** Column node schema - extracted from columnNode */
export const ColumnNodeSchema = columnNode.schema;

/** Row node schema - extracted from rowNode */
export const RowNodeSchema = rowNode.schema;

/** Union schema for all node types */
export const NodeSchema = Schema.Union(
  RootNodeSchema,
  ScreenNodeSchema,
  TextNodeSchema,
  ColumnNodeSchema,
  RowNodeSchema
);

/** Union type for all node data */
export type NodeData =
  | RootNodeData
  | ScreenNodeData
  | TextNodeData
  | ColumnNodeData
  | RowNodeData;

/** All node types except the root node */
export type NodeDataWithoutRoot = Exclude<NodeData, RootNodeData>;

/** Check if a node is the root node */
export function isRootNode(node: NodeData): node is RootNodeData {
  return node.type === 'root';
}

/** Check if a node has a parent (all nodes except root) */
export function hasParent(node: NodeData): node is NodeDataWithoutRoot {
  return !isRootNode(node);
}

// ============================================================================
// Legacy Property Types (for backwards compatibility)
// ============================================================================

// import {
//   type AlignItems,
//   AlignItemsSchema,
//   DEFAULT_PADDING,
//   DEFAULT_SAFE_AREA,
//   type FontWeight,
//   FontWeightSchema,
//   type JustifyContent,
//   JustifyContentSchema,
//   type Padding,
//   PaddingSchema,
//   type SafeArea,
//   SafeAreaSchema,
//   type TextAlign,
//   TextAlignSchema
// } from './properties';

// // Root Node (special case - no properties, just id)
// export const RootNodeSchema = Schema.Struct({
//   type: Schema.Literal('root'),
//   id: Schema.String
// });

// export interface RootNodeData {
//   type: 'root';
//   id: string;
// }

// // Screen Node (legacy with composed objects)
// export const ScreenNodeSchema = Schema.Struct({
//   type: Schema.Literal('screen'),
//   id: Schema.String,
//   name: Schema.String,
//   parent: ParentRefSchema,
//   x: Schema.Number,
//   y: Schema.Number,
//   width: Schema.Number,
//   height: Schema.Number,
//   backgroundColor: Schema.optionalWith(Schema.String, {
//     default: () => '#ffffff'
//   }),
//   padding: Schema.optionalWith(PaddingSchema, {
//     default: () => DEFAULT_PADDING
//   }),
//   safeArea: Schema.optionalWith(SafeAreaSchema, {
//     default: () => DEFAULT_SAFE_AREA
//   })
// });

// export interface ScreenNodeData {
//   type: 'screen';
//   id: string;
//   name: string;
//   parent: { id: string; index: string };
//   x: number;
//   y: number;
//   width: number;
//   height: number;
//   backgroundColor: string;
//   padding: Padding;
//   safeArea: SafeArea;
// }

// // Text Node (legacy)
// export const TextNodeSchema = Schema.Struct({
//   type: Schema.Literal('text'),
//   id: Schema.String,
//   name: Schema.String,
//   parent: ParentRefSchema,
//   x: Schema.Number,
//   y: Schema.Number,
//   text: Schema.String,
//   fontSize: Schema.optionalWith(Schema.Number, { default: () => 16 }),
//   color: Schema.optionalWith(Schema.String, { default: () => '#000000' }),
//   fontWeight: Schema.optionalWith(FontWeightSchema, {
//     default: () => '400' as const
//   }),
//   textAlign: Schema.optionalWith(TextAlignSchema, {
//     default: () => 'left' as const
//   }),
//   lineHeight: Schema.optionalWith(Schema.Number, { default: () => 1.5 }),
//   letterSpacing: Schema.optionalWith(Schema.Number, { default: () => 0 })
// });

// export interface TextNodeData {
//   type: 'text';
//   id: string;
//   name: string;
//   parent: { id: string; index: string };
//   x: number;
//   y: number;
//   text: string;
//   fontSize: number;
//   color: string;
//   fontWeight: FontWeight;
//   textAlign: TextAlign;
//   lineHeight: number;
//   letterSpacing: number;
// }

// // Column Node (legacy with composed objects)
// export const ColumnNodeSchema = Schema.Struct({
//   type: Schema.Literal('column'),
//   id: Schema.String,
//   name: Schema.String,
//   parent: ParentRefSchema,
//   gap: Schema.optionalWith(Schema.Number, { default: () => 0 }),
//   padding: Schema.optionalWith(PaddingSchema, {
//     default: () => DEFAULT_PADDING
//   }),
//   justifyContent: Schema.optionalWith(JustifyContentSchema, {
//     default: () => 'flex-start' as const
//   }),
//   alignItems: Schema.optionalWith(AlignItemsSchema, {
//     default: () => 'stretch' as const
//   }),
//   backgroundColor: Schema.optionalWith(Schema.NullOr(Schema.String), {
//     default: () => null
//   })
// });

// export interface ColumnNodeData {
//   type: 'column';
//   id: string;
//   name: string;
//   parent: { id: string; index: string };
//   gap: number;
//   padding: Padding;
//   justifyContent: JustifyContent;
//   alignItems: AlignItems;
//   backgroundColor: string | null;
// }

// // Row Node (legacy with composed objects)
// export const RowNodeSchema = Schema.Struct({
//   type: Schema.Literal('row'),
//   id: Schema.String,
//   name: Schema.String,
//   parent: ParentRefSchema,
//   gap: Schema.optionalWith(Schema.Number, { default: () => 0 }),
//   padding: Schema.optionalWith(PaddingSchema, {
//     default: () => DEFAULT_PADDING
//   }),
//   justifyContent: Schema.optionalWith(JustifyContentSchema, {
//     default: () => 'flex-start' as const
//   }),
//   alignItems: Schema.optionalWith(AlignItemsSchema, {
//     default: () => 'stretch' as const
//   }),
//   backgroundColor: Schema.optionalWith(Schema.NullOr(Schema.String), {
//     default: () => null
//   })
// });

// export interface RowNodeData {
//   type: 'row';
//   id: string;
//   name: string;
//   parent: { id: string; index: string };
//   gap: number;
//   padding: Padding;
//   justifyContent: JustifyContent;
//   alignItems: AlignItems;
//   backgroundColor: string | null;
// }

// // ============================================================================
// // Union Schema (legacy)
// // ============================================================================

// export const NodeSchema = Schema.Union(
//   RootNodeSchema,
//   ScreenNodeSchema,
//   TextNodeSchema,
//   ColumnNodeSchema,
//   RowNodeSchema
// );

// export type NodeData =
//   | RootNodeData
//   | ScreenNodeData
//   | TextNodeData
//   | ColumnNodeData
//   | RowNodeData;

// /** All node types except the root node */
// export type NodeDataWithoutRoot = Exclude<NodeData, RootNodeData>;

// /** Check if a node is the root node */
// export function isRootNode(node: NodeData): node is RootNodeData {
//   return node.type === 'root';
// }

// /** Check if a node has a parent (all nodes except root) */
// export function hasParent(node: NodeData): node is NodeDataWithoutRoot {
//   return !isRootNode(node);
// }
