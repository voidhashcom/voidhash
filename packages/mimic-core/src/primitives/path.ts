import {
  HiddenTreeRootId,
  type ArrayItem,
  type ArrayValue,
  type ObjectValue,
  type Path,
  type TreeNode,
  type TreeValue,
  type Value,
} from "../core/types.ts";
import { PrimitiveError } from "./shared.ts";

export const getValueAtPath = (root: Value, path: Path): Value | undefined => {
  let current: Value | undefined = root;
  for (const segment of path) {
    if (current === undefined) {
      return undefined;
    }
    switch (segment.kind) {
      case "field":
        if (current.kind !== "object") {
          return undefined;
        }
        current = current.fields[segment.key];
        break;
      case "item":
        if (current.kind !== "array") {
          return undefined;
        }
        current = current.items.find((item) => item.id === segment.id)?.value;
        break;
      case "node":
        if (current.kind !== "tree") {
          return undefined;
        }
        current = current.nodes.find((node) => node.id === segment.id)?.value;
        break;
    }
  }
  return current;
};

export const getObjectAtPath = (root: Value, path: Path): ObjectValue | undefined => {
  const value = getValueAtPath(root, path);
  return value?.kind === "object" ? value : undefined;
};

export const getArrayAtPath = (root: Value, path: Path): ArrayValue | undefined => {
  const value = getValueAtPath(root, path);
  return value?.kind === "array" ? value : undefined;
};

export const getTreeAtPath = (root: Value, path: Path): TreeValue | undefined => {
  const value = getValueAtPath(root, path);
  return value?.kind === "tree" ? value : undefined;
};

export const getOrderedArrayItems = (value: ArrayValue | undefined): readonly ArrayItem[] =>
  value ? [...value.items].sort((left, right) => left.pos.localeCompare(right.pos)) : [];

export const getArrayItemById = (
  value: ArrayValue | undefined,
  id: string,
): ArrayItem | undefined => value?.items.find((item) => item.id === id);

export const getArrayItemByIndex = (
  value: ArrayValue | undefined,
  index: number,
): ArrayItem | undefined => {
  const ordered = getOrderedArrayItems(value);
  const normalized = normalizeIndex(index, ordered.length);
  return normalized === undefined ? undefined : ordered[normalized];
};

export const getTreeNodeById = (tree: TreeValue | undefined, id: string): TreeNode | undefined =>
  tree?.nodes.find((node) => node.id === id);

export const getOrderedTreeChildren = (
  tree: TreeValue | undefined,
  parent: string,
): readonly TreeNode[] =>
  tree
    ? tree.nodes
        .filter((node) => node.parent === parent)
        .sort((left, right) => left.pos.localeCompare(right.pos))
    : [];

export const getTreeChildByIndex = (
  tree: TreeValue | undefined,
  parent: string,
  index: number,
): TreeNode | undefined => {
  const ordered = getOrderedTreeChildren(tree, parent);
  const normalized = normalizeIndex(index, ordered.length);
  return normalized === undefined ? undefined : ordered[normalized];
};

export const normalizeIndex = (index: number, length: number): number | undefined => {
  const normalized = index < 0 ? length + index : index;
  if (normalized < 0 || normalized >= length) {
    return undefined;
  }
  return normalized;
};

export const getNeighborPositionsForInsert = (
  positions: readonly string[],
  index: number,
): { lower?: string; upper?: string } => {
  if (index < 0 || index > positions.length) {
    throw new PrimitiveError(`Index ${index} is out of range`);
  }
  return {
    lower: index === 0 ? undefined : positions[index - 1],
    upper: index === positions.length ? undefined : positions[index],
  };
};

export const ensureTreeParent = (tree: TreeValue | undefined, parent: string): void => {
  if (parent === HiddenTreeRootId) {
    return;
  }
  if (!tree || !tree.nodes.some((node) => node.id === parent)) {
    throw new PrimitiveError(`Tree parent "${parent}" does not exist`);
  }
};

export const isTreeDescendant = (
  tree: TreeValue | undefined,
  candidateParent: string,
  nodeId: string,
): boolean => {
  if (!tree || candidateParent === HiddenTreeRootId) {
    return false;
  }
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  let current = candidateParent;
  while (true) {
    const node = byId.get(current);
    if (!node) {
      return false;
    }
    if (node.parent === nodeId) {
      return true;
    }
    if (node.parent === HiddenTreeRootId) {
      return false;
    }
    current = node.parent;
  }
};

export const treeNodePath = (treePath: Path, nodeId: string): Path => [
  ...treePath,
  { kind: "node", id: nodeId },
];
