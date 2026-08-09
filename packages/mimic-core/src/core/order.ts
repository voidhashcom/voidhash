import {
  HiddenTreeRootId,
  type ArrayItem,
  type ObjectValue,
  type TreeNode,
  type TreeValue,
  type Value,
} from "./types.ts";
import { ErrorCodes, makeCoreError } from "./errors.ts";
import { cloneObjectValue, cloneValue } from "./types.ts";

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
      value: cloneObjectValue(node.value),
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
      value: cloneObjectValue(node.value),
    }))
    .sort(compareTreeSiblings);
};

export const normalize = (value: Value): Value => normalizeValue(value);

const normalizeObjectValue = (value: ObjectValue): ObjectValue => {
  const fields: Record<string, Value> = {};
  for (const [key, field] of Object.entries(value.fields)) {
    fields[key] = normalizeValue(field);
  }
  return { kind: "object", fields };
};

const normalizeValue = (value: Value): Value => {
  switch (value.kind) {
    case "string":
    case "number":
    case "boolean":
      return { ...value };
    case "object":
      return normalizeObjectValue(value);
    case "array":
      return {
        kind: "array",
        items: value.items
          .map((item) => ({
            id: item.id,
            pos: item.pos,
            value: normalizeValue(item.value),
          }))
          .sort(compareArrayItems),
      };
    case "tree":
      return {
        kind: "tree",
        nodes: value.nodes
          .map((node) => ({
            id: node.id,
            parent: node.parent,
            pos: node.pos,
            value: normalizeObjectValue(node.value),
          }))
          .sort(compareTreeNodes),
      };
  }
};

export const asTreeValue = (value: Value): TreeValue => {
  if (value.kind !== "tree") {
    throw makeCoreError(ErrorCodes.TypeMismatch, "tree value required");
  }
  return value;
};
