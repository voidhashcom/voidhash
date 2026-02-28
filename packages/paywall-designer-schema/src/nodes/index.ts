import type { FlexNodeData } from "./flex-node";
import type { PathNodeData } from "./path-node";
import type { RootNodeData } from "./root-node";
import type { ScreenNodeData } from "./screen-node";
import type { ShapeNodeData } from "./shape-node";
import type { TextNodeData } from "./text-node";

export { linkedVariables, localVariables, type Variable } from "./base";
export {
	FlexNode,
	type FlexNodeData,
	type FlexNodeStateSnapshot,
} from "./flex-node";
export {
	ALLOWED_CHILDREN_BY_NODE_TYPE,
	canBeChildOf,
	canCreateLayoutChildren,
	canHaveChildren,
	EDITABLE_NODE_TYPES,
	isEditableNodeType,
	isNodeType,
	NODE_TYPES,
	type EditableNodeType,
	type NodeType,
} from "./node-catalog";
export {
	PathNode,
	type PathNodeData,
	type PathNodeUpdateValue,
} from "./path-node";
export { RootNode, type RootNodeData } from "./root-node";
export { ScreenNode, type ScreenNodeData } from "./screen-node";
export {
	ShapeNode,
	type ShapeNodeData,
	type ShapeNodeUpdateValue,
} from "./shape-node";
export { TextNode, type TextNodeData } from "./text-node";

export type AnyNodeData =
	| ScreenNodeData
	| FlexNodeData
	| TextNodeData
	| ShapeNodeData
	| PathNodeData
	| RootNodeData;
