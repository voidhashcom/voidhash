import {
  HiddenTreeRootId,
  type ArrayItem,
  type TreeNode,
  type TreeValue,
  type Value,
} from "./types.ts";
import { ErrorCodes, makeCoreError } from "./errors.ts";
import { cloneValue } from "./types.ts";

export const compareArrayItems = (a: ArrayItem, b: ArrayItem): number => {
  if (a.pos < b.pos) return -1;
  if (a.pos > b.pos) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
};

export const compareTreeSiblings = (a: TreeNode, b: TreeNode): number => {
  if (a.pos < b.pos) return -1;
  if (a.pos > b.pos) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
};

export const compareTreeNodes = (a: TreeNode, b: TreeNode): number => {
  if (a.parent < b.parent) return -1;
  if (a.parent > b.parent) return 1;
  return compareTreeSiblings(a, b);
};

export const orderedArrayItems = (value: Value): ArrayItem[] => {
  if (value.kind !== "array") {
    throw makeCoreError(ErrorCodes.TypeMismatch, "ordered array items require array value");
  }
  return value.items
    .map((item) => ({
      id: item.id,
      pos: item.pos,
      value: cloneValue(item.value),
    }))
    .sort(compareArrayItems);
};

export const orderedTreeNodes = (value: Value): TreeNode[] => {
  if (value.kind !== "tree") {
    throw makeCoreError(ErrorCodes.TypeMismatch, "ordered tree nodes require tree value");
  }
  return value.nodes
    .map((node) => ({
      id: node.id,
      parent: node.parent,
      pos: node.pos,
      value: cloneValue(node.value) as TreeNode["value"],
    }))
    .sort(compareTreeNodes);
};

export const orderedTreeChildren = (value: Value, parentId: string): TreeNode[] => {
  if (value.kind !== "tree") {
    throw makeCoreError(ErrorCodes.TypeMismatch, "ordered tree children require tree value");
  }
  if (
    parentId !== HiddenTreeRootId &&
    value.nodes.findIndex((node) => node.id === parentId) === -1
  ) {
    throw makeCoreError(ErrorCodes.MissingTreeNode, "tree parent does not exist");
  }

  return value.nodes
    .filter((node) => node.parent === parentId)
    .map((node) => ({
      id: node.id,
      parent: node.parent,
      pos: node.pos,
      value: cloneValue(node.value) as TreeNode["value"],
    }))
    .sort(compareTreeSiblings);
};

export const normalize = (value: Value): Value => {
  const next = cloneValue(value);
  normalizeInPlace(next);
  return next;
};

const normalizeInPlace = (value: Value): void => {
  switch (value.kind) {
    case "string":
    case "number":
    case "boolean":
      return;
    case "object":
      for (const [key, field] of Object.entries(value.fields)) {
        normalizeInPlace(field);
        (value.fields as Record<string, Value>)[key] = field;
      }
      return;
    case "array":
      for (const item of value.items) {
        normalizeInPlace(item.value);
      }
      (value.items as ArrayItem[]).sort(compareArrayItems);
      return;
    case "tree":
      for (const node of value.nodes) {
        normalizeInPlace(node.value);
      }
      (value.nodes as TreeNode[]).sort(compareTreeNodes);
      return;
  }
};

export const asTreeValue = (value: Value): TreeValue => {
  if (value.kind !== "tree") {
    throw makeCoreError(ErrorCodes.TypeMismatch, "tree value required");
  }
  return value;
};
