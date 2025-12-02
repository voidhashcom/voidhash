// Node definitions (new abstraction)
export {
  // Derived types (auto-generated from definitions)
  type ColumnNodeData,
  // Schemas
  ColumnNodeSchema,
  columnNode,
  designCanvas,
  // Type guards
  hasParent,
  isRootNode,
  type NodeData,
  type NodeDataWithoutRoot,
  NodeSchema,
  type ParentRef,
  ParentRefSchema,
  type RootNodeData,
  RootNodeSchema,
  type RowNodeData,
  RowNodeSchema,
  rowNode,
  type ScreenNodeData,
  ScreenNodeSchema,
  screenNode,
  type TextNodeData,
  TextNodeSchema,
  textNode
} from './nodes';
// Property definitions (new abstraction)
// Legacy property schemas and types (for backwards compatibility)
export {
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
  paddingBottom,
  paddingLeft,
  paddingProperties,
  paddingRight,
  paddingTop,
  safeAreaBottom,
  safeAreaProperties,
  safeAreaTop,
  text,
  textAlign,
  width,
  x,
  y
} from './properties';
