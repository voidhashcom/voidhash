export const NODE_TYPES = [
  "root",
  "screen",
  "flex",
  "text",
  "shape",
  "path",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDITABLE_NODE_TYPES = [
  "screen",
  "flex",
  "text",
  "shape",
  "path",
] as const;

export type EditableNodeType = (typeof EDITABLE_NODE_TYPES)[number];

export const ALLOWED_CHILDREN_BY_NODE_TYPE: Record<NodeType, readonly NodeType[]> = {
  root: ["screen"],
  screen: ["flex", "text", "shape"],
  flex: ["flex", "text", "shape"],
  text: [],
  shape: ["path"],
  path: [],
};

export function isNodeType(type: string): type is NodeType {
  return NODE_TYPES.includes(type as NodeType);
}

export function isEditableNodeType(type: string): type is EditableNodeType {
  return EDITABLE_NODE_TYPES.includes(type as EditableNodeType);
}

export function canBeChildOf(
  childType: string | NodeType,
  parentType: string | NodeType,
): boolean {
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
 * container, because it should only contain path nodes.
 */
export function canCreateLayoutChildren(type: string | NodeType | null | undefined): boolean {
  return type === "screen" || type === "flex";
}
