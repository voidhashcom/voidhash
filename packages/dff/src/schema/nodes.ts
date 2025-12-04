import { Schema } from 'effect';
import { defineCanvas } from '../core/define-canvas';
import { defineNode, type NodeDefData } from '../core/define-node';
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  borderColor,
  borderRadius,
  borderStyle,
  borderWidth,
  color,
  display,
  flex,
  flexBasis,
  flexDirection,
  flexGrow,
  flexShrink,
  fontSize,
  fontWeight,
  gap,
  height,
  justifyContent,
  letterSpacing,
  lineHeight,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  maxHeight,
  maxWidth,
  minHeight,
  minWidth,
  opacity,
  overflow,
  paddingBottom,
  paddingLeft,
  paddingRight,
  paddingTop,
  safeAreaBottom,
  safeAreaTop,
  shadowBlurRadius,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  text,
  textAlign,
  width,
  x,
  y,
  zIndex
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
    gap,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    justifyContent,
    alignItems,
    backgroundEnabled.default(() => true),
    backgroundColor.default(() => '#ffffff'),
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    borderWidth,
    borderColor,
    borderStyle,
    borderRadius,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    flexDirection,
    alignSelf,
    opacity,
    overflow,
    zIndex,
    display,
    shadowEnabled,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
    shadowBlurRadius,
    shadowOpacity,
    safeAreaTop,
    safeAreaBottom
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
    letterSpacing,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    borderWidth,
    borderColor,
    borderStyle,
    borderRadius,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf,
    opacity,
    overflow,
    zIndex,
    display,
    shadowEnabled,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
    shadowBlurRadius,
    shadowOpacity
  ],
  children: [],
  defaultName: 'Text'
});

/**
 * Flex node - vertical flex container
 */
export const flexNode = defineNode('flex', {
  properties: [
    gap,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    justifyContent,
    alignItems,
    backgroundEnabled,
    backgroundColor,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    borderWidth,
    borderColor,
    borderStyle,
    borderRadius,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    flex,
    flexDirection,
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf,
    opacity,
    overflow,
    zIndex,
    display,
    shadowEnabled,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
    shadowBlurRadius,
    shadowOpacity,
    safeAreaTop,
    safeAreaBottom
  ],
  defaultName: 'Column'
});

// ============================================================================
// Design Canvas Definition
// ============================================================================

/**
 * Design canvas - for UI design with screens, text, columns, rows
 */
export const designCanvas = defineCanvas('design', {
  nodes: [screenNode, textNode, flexNode]
});

// ============================================================================
// Derived Types (auto-generated from node definitions)
// ============================================================================

export type ScreenNodeData = NodeDefData<typeof screenNode>;
export type TextNodeData = NodeDefData<typeof textNode>;
export type FlexNodeData = NodeDefData<typeof flexNode>;

// ============================================================================
// Root Node (special case - no parent reference)
// ============================================================================

export const RootNodeSchema = Schema.Struct({
  type: Schema.Literal('root'),
  id: Schema.String
});

export type RootNodeData = Schema.Schema.Type<typeof RootNodeSchema>;

// ============================================================================
// Schemas (for encoding/decoding)
// ============================================================================

/** Union schema for all node types */
export const NodeSchema = Schema.Union(
  RootNodeSchema,
  screenNode.schema,
  textNode.schema,
  flexNode.schema
);

/** Union type for all node data */
export type NodeData =
  | RootNodeData
  | ScreenNodeData
  | TextNodeData
  | FlexNodeData;

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
