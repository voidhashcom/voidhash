export const NODE_TYPES = [
  "root",
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
  "component",
  "library",
  "codeComponent",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDITABLE_NODE_TYPES = [
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
  "component",
] as const;

export type EditableNodeType = (typeof EDITABLE_NODE_TYPES)[number];

/**
 * Editable node types carrying the generic stateful data fields
 * (`style`, `states`, `localVariables`). Component nodes are editable but
 * stateless (props in, actions out) — generic style/state/variable actions
 * must be typed over this subset.
 */
export const STATEFUL_NODE_TYPES = [
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
] as const;

export type StatefulEditableNodeType = (typeof STATEFUL_NODE_TYPES)[number];

export const ALLOWED_CHILDREN_BY_NODE_TYPE: Record<NodeType, readonly NodeType[]> = {
  root: ["screen", "library"],
  screen: ["view", "scrollView", "text", "shape", "component"],
  view: ["view", "scrollView", "text", "shape", "component"],
  scrollView: ["view", "scrollView", "text", "shape", "component"],
  text: [],
  shape: ["path"],
  path: [],
  component: ["view", "scrollView", "text", "shape", "component"],
  library: ["codeComponent"],
  codeComponent: [],
};

export function isNodeType(type: string): type is NodeType {
  return NODE_TYPES.includes(type as NodeType);
}

export function isEditableNodeType(type: string): type is EditableNodeType {
  return EDITABLE_NODE_TYPES.includes(type as EditableNodeType);
}

export function isStatefulNodeType(type: string): type is StatefulEditableNodeType {
  return STATEFUL_NODE_TYPES.includes(type as StatefulEditableNodeType);
}

export function canBeChildOf(childType: string | NodeType, parentType: string | NodeType): boolean {
  if (!isNodeType(childType) || !isNodeType(parentType)) {
    return false;
  }
  return ALLOWED_CHILDREN_BY_NODE_TYPE[parentType].includes(childType);
}

export function canHaveChildren(type: string | NodeType | null | undefined): boolean {
  return type != null && isNodeType(type) && ALLOWED_CHILDREN_BY_NODE_TYPE[type].length > 0;
}

/**
 * Node types that can host layout primitives created from context menu
 * (row, column, text). We intentionally exclude shape although it is a
 * container, because it should only contain path nodes. Component nodes
 * qualify at the type level only — actions must additionally gate on the
 * component manifest's `slot` flag.
 */
export function canCreateLayoutChildren(type: string | NodeType | null | undefined): boolean {
  return type === "screen" || type === "view" || type === "scrollView" || type === "component";
}
