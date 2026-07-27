import type { CodeComponentNodeData } from "./code-component-node.ts";
import type { ComponentNodeData } from "./component-node.ts";
import type { LibraryNodeData } from "./library-node.ts";
import type { PathNodeData } from "./path-node.ts";
import type { RootNodeData } from "./root-node.ts";
import type { ScreenNodeData } from "./screen-node.ts";
import type { ScrollViewNodeData } from "./scrollview-node.ts";
import type { ShapeNodeData } from "./shape-node.ts";
import type { TextNodeData } from "./text-node.ts";
import type { ViewNodeData } from "./view-node.ts";

export { linkedVariables, localVariables, type Variable } from "./base.ts";
export { CodeComponentNode, type CodeComponentNodeData } from "./code-component-node.ts";
export { ComponentNode, type ComponentNodeData } from "./component-node.ts";
export { LibraryNode, type LibraryNodeData } from "./library-node.ts";
export { pathNodeStyleSchema } from "./path-node.ts";
export { screenNodeStyleSchema } from "./screen-node.ts";
export { shapeNodeStyleSchema } from "./shape-node.ts";
export { textNodeStyleSchema } from "./text-node.ts";
export { viewNodeStyleSchema } from "./view-node.ts";
export { ViewNode, type ViewNodeData, type ViewNodeStateSnapshot } from "./view-node.ts";
export {
  ALLOWED_CHILDREN_BY_NODE_TYPE,
  canBeChildOf,
  canCreateLayoutChildren,
  canHaveChildren,
  EDITABLE_NODE_TYPES,
  isEditableNodeType,
  isNodeType,
  isStatefulNodeType,
  NODE_TYPES,
  STATEFUL_NODE_TYPES,
  type EditableNodeType,
  type NodeType,
  type StatefulEditableNodeType,
} from "./node-catalog.ts";
export { PathNode, type PathNodeData, type PathNodeUpdateValue } from "./path-node.ts";
export { RootNode, type RootNodeData } from "./root-node.ts";
export { ScreenNode, type ScreenNodeData } from "./screen-node.ts";
export { scrollViewNodeStyleSchema } from "./scrollview-node.ts";
export {
  ScrollViewNode,
  type ScrollViewNodeData,
  type ScrollViewNodeStateSnapshot,
  type ScrollViewNodeUpdateValue,
} from "./scrollview-node.ts";
export { ShapeNode, type ShapeNodeData, type ShapeNodeUpdateValue } from "./shape-node.ts";
export { TextNode, type TextNodeData } from "./text-node.ts";

export type AnyNodeData =
  | ScreenNodeData
  | ViewNodeData
  | ScrollViewNodeData
  | TextNodeData
  | ShapeNodeData
  | PathNodeData
  | ComponentNodeData
  | RootNodeData
  | LibraryNodeData
  | CodeComponentNodeData;
