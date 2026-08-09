import {
  ComponentNode,
  type EditableNodeType,
  PathNode,
  ScreenNode,
  ScrollViewNode,
  ShapeNode,
  type StatefulEditableNodeType,
  TextNode,
  ViewNode,
  isEditableNodeType as isEditableNodeTypeFromCatalog,
  isStatefulNodeType as isStatefulNodeTypeFromCatalog,
} from "@voidhash/mimic-schema";

import { findTypedNode, type DesignerDocumentRoot } from "../utils/node-proxies";

export type { EditableNodeType, StatefulEditableNodeType };

export const NODE_PRIMITIVES = {
  component: ComponentNode,
  path: PathNode,
  screen: ScreenNode,
  scrollView: ScrollViewNode,
  shape: ShapeNode,
  text: TextNode,
  view: ViewNode,
} as const satisfies Record<EditableNodeType, unknown>;

/**
 * Primitives for the editable node types carrying the generic stateful data
 * fields (`style`, `states`, `localVariables`). Generic style/state/variable
 * actions resolve through this map so their proxies expose those fields;
 * component nodes are deliberately absent (props in, actions out).
 */
const STATEFUL_NODE_PRIMITIVES = {
  path: PathNode,
  screen: ScreenNode,
  scrollView: ScrollViewNode,
  shape: ShapeNode,
  text: TextNode,
  view: ViewNode,
} as const satisfies Record<StatefulEditableNodeType, unknown>;

export function isEditableNodeType(type: string): type is EditableNodeType {
  return isEditableNodeTypeFromCatalog(type);
}

export function isStatefulNodeType(type: string): type is StatefulEditableNodeType {
  return isStatefulNodeTypeFromCatalog(type);
}

export function getNodePrimitive<T extends EditableNodeType>(type: T) {
  return NODE_PRIMITIVES[type];
}

/**
 * Resolve the primitive for a stateful editable node type. Use this in
 * generic actions touching `data.localVariables`/`data.states`/`style` so the
 * resulting proxies are correctly typed.
 */
export function getStatefulNodePrimitive<T extends StatefulEditableNodeType>(type: T) {
  return STATEFUL_NODE_PRIMITIVES[type];
}

/**
 * Given a designer document root proxy, resolve a node by ID and type to its
 * correctly-typed proxy (`null` when missing or differently typed).
 */
export function resolveNodeProxy<T extends EditableNodeType>(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: T,
) {
  return findTypedNode(root, nodeId, NODE_PRIMITIVES[nodeType]) ?? null;
}
