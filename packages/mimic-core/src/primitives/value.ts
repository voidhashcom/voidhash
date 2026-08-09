import {
  HiddenTreeRootId,
  arrayValue,
  booleanValue,
  numberValue,
  objectValue,
  stringValue,
  treeValue,
  type ArrayValue,
  type ObjectValue,
  type TreeNode,
  type TreeValue,
  type Value,
} from "../core/types.ts";
import { PrimitiveError } from "./shared.ts";

export const decodeScalar = (value: Value | undefined): unknown => {
  switch (value?.kind) {
    case "string":
    case "number":
    case "boolean":
      return value.value;
    default:
      return undefined;
  }
};

export const encodeScalar = (value: string | number | boolean): Value => {
  switch (typeof value) {
    case "string":
      return stringValue(value);
    case "number":
      return numberValue(value);
    case "boolean":
      return booleanValue(value);
    default:
      throw new PrimitiveError(`Unsupported scalar value type: ${typeof value}`);
  }
};

export const decodeObjectToRecord = (
  value: ObjectValue | undefined,
): Record<string, Value> | undefined => {
  if (value) return { ...value.fields };
  return undefined;
};

export const buildObjectValue = (fields: Record<string, Value>): ObjectValue => objectValue(fields);

export const buildArrayValue = (items: ArrayValue["items"]): ArrayValue => arrayValue(items);

export const buildTreeValue = (nodes: TreeValue["nodes"]): TreeValue => treeValue(nodes);

export interface NestedTreeInputNode {
  readonly type: string;
  readonly id?: string;
  readonly children?: readonly NestedTreeInputNode[];
  readonly [key: string]: unknown;
}

export const flattenNestedTree = (
  input: NestedTreeInputNode,
  options: {
    readonly rootParent?: string;
    readonly nextNodeId: () => string;
    readonly nextPosBetween: (lower?: string, upper?: string) => string;
    readonly encodeNodeValue: (input: NestedTreeInputNode) => ObjectValue;
  },
): readonly TreeNode[] => {
  const nodes: TreeNode[] = [];

  const visit = (node: NestedTreeInputNode, parent: string, pos: string): void => {
    const id = node.id ?? options.nextNodeId();
    const value = options.encodeNodeValue(node);
    nodes.push({ id, parent, pos, value });

    const children = node.children ?? [];
    let lower: string | undefined;
    for (const child of children) {
      const childPos = options.nextPosBetween(lower, undefined);
      visit(child, id, childPos);
      lower = childPos;
    }
  };

  const rootPos = options.nextPosBetween(undefined, undefined);
  visit(input, options.rootParent ?? HiddenTreeRootId, rootPos);
  return nodes;
};
