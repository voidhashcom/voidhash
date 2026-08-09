import { ErrorCodes, makeCoreError } from "./errors.ts";
import {
  HiddenTreeRootId,
  type ArrayItem,
  type Command,
  type ObjectValue,
  type Path,
  type TreeNode,
  type Value,
  arrayValue,
  clonePath,
  cloneValue,
  objectValue,
  treeValue,
} from "./types.ts";
import { compareArrayItems, compareTreeNodes } from "./order.ts";
import { validateValue } from "./validate.ts";

const withClonedPath = (command: Command): Command => ({
  ...command,
  path: clonePath(command.path),
});

export const apply = (state: Value, command: Command): Value => {
  validateValue(state);
  const next = cloneValue(state);
  applyInPlace(next, withClonedPath(command));
  validateValue(next);
  return next;
};

export const applyBatch = (state: Value, commands: readonly Command[]): Value => {
  validateValue(state);
  const next = cloneValue(state);
  for (const command of commands) {
    applyInPlace(next, withClonedPath(command));
  }
  validateValue(next);
  return next;
};

const applyInPlace = (state: Value, command: Command): void => {
  switch (command.kind) {
    case "value.set":
      applyValueSet(state, command.path, command.value);
      return;
    case "object.set":
      applyObjectSet(state, command.path, command.key, command.value);
      return;
    case "object.delete":
      applyObjectDelete(state, command.path, command.key);
      return;
    case "array.insert":
      applyArrayInsert(state, command.path, command.item);
      return;
    case "array.move":
      applyArrayMove(state, command.path, command.id, command.pos);
      return;
    case "array.delete":
      applyArrayDelete(state, command.path, command.id);
      return;
    case "tree.insert":
      applyTreeInsert(state, command.path, command.node);
      return;
    case "tree.move":
      applyTreeMove(state, command.path, command.id, command.parent, command.pos);
      return;
    case "tree.delete":
      applyTreeDelete(state, command.path, command.id);
      return;
  }
};

const applyValueSet = (state: Value, path: Path, value: Value): void => {
  if (path.length === 0) {
    replaceValue(state, cloneValue(value));
    return;
  }
  mutateAtPath(state, path, (target) => {
    replaceValue(target, cloneValue(value));
  });
};

const applyObjectSet = (state: Value, path: Path, key: string, value: Value): void => {
  if (!key) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "object.set requires key and value");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "object") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "object command requires object target");
    }
    mutableFields(target)[key] = cloneValue(value);
  });
};

const applyObjectDelete = (state: Value, path: Path, key: string): void => {
  if (!key) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "object.delete requires key");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "object") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "object command requires object target");
    }
    if (!Object.hasOwn(target.fields, key)) {
      throw makeCoreError(ErrorCodes.MissingField, "object field does not exist");
    }
    delete mutableFields(target)[key];
  });
};

const applyArrayInsert = (state: Value, path: Path, item: ArrayItem): void => {
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "array") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "array command requires array target");
    }
    for (const existing of target.items) {
      if (existing.id === item.id) {
        throw makeCoreError(ErrorCodes.DuplicateArrayItemId, "array item id already exists");
      }
      if (existing.pos === item.pos) {
        throw makeCoreError(ErrorCodes.DuplicateArrayPos, "array item position already exists");
      }
    }
    const nextItems = [
      ...target.items,
      { id: item.id, pos: item.pos, value: cloneValue(item.value) },
    ];
    nextItems.sort(compareArrayItems);
    replaceValue(target, arrayValue(nextItems));
  });
};

const applyArrayMove = (state: Value, path: Path, id: string, pos: string): void => {
  if (!id || !pos) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "array.move requires id and pos");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "array") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "array command requires array target");
    }
    let index = -1;
    for (let i = 0; i < target.items.length; i += 1) {
      const item = target.items[i];
      if (item?.id === id) {
        index = i;
        continue;
      }
      if (item?.pos === pos) {
        throw makeCoreError(ErrorCodes.DuplicateArrayPos, "array item position already exists");
      }
    }
    if (index === -1) {
      throw makeCoreError(ErrorCodes.MissingArrayItem, "array item does not exist");
    }
    const nextItems = [...target.items];
    nextItems[index] = {
      ...target.items[index]!,
      pos,
    };
    nextItems.sort(compareArrayItems);
    replaceValue(target, arrayValue(nextItems));
  });
};

const applyArrayDelete = (state: Value, path: Path, id: string): void => {
  if (!id) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "array.delete requires id");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "array") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "array command requires array target");
    }
    const index = findArrayItemIndex(target.items, id);
    if (index === -1) {
      throw makeCoreError(ErrorCodes.MissingArrayItem, "array item does not exist");
    }
    const nextItems = [...target.items];
    nextItems.splice(index, 1);
    replaceValue(target, arrayValue(nextItems));
  });
};

const applyTreeInsert = (state: Value, path: Path, node: TreeNode): void => {
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "tree") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "tree command requires tree target");
    }
    if (node.id === HiddenTreeRootId) {
      throw makeCoreError(
        ErrorCodes.ReservedIdentifier,
        "tree node id uses reserved root identifier",
      );
    }
    if (node.value.kind !== "object") {
      throw makeCoreError(ErrorCodes.TreeNodeValueMustBeObject, "tree node value must be object");
    }
    if (findTreeNodeIndex(target.nodes, node.id) !== -1) {
      throw makeCoreError(ErrorCodes.DuplicateTreeNodeId, "tree node id already exists");
    }
    if (!treeParentExists(target.nodes, node.parent)) {
      throw makeCoreError(ErrorCodes.InvalidTreeParent, "tree parent does not exist");
    }
    if (siblingTreePosExists(target.nodes, node.parent, node.pos, "")) {
      throw makeCoreError(ErrorCodes.DuplicateTreePos, "tree sibling position already exists");
    }

    const nextNodes = [
      ...target.nodes,
      {
        id: node.id,
        parent: node.parent,
        pos: node.pos,
        value: cloneObjectValue(node.value),
      },
    ];
    nextNodes.sort(compareTreeNodes);
    replaceValue(target, treeValue(nextNodes));
  });
};

const applyTreeMove = (state: Value, path: Path, id: string, parent: string, pos: string): void => {
  if (!id || !parent || !pos) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "tree.move requires id, parent, and pos");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "tree") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "tree command requires tree target");
    }

    const index = findTreeNodeIndex(target.nodes, id);
    if (index === -1) {
      throw makeCoreError(ErrorCodes.MissingTreeNode, "tree node does not exist");
    }
    if (!treeParentExists(target.nodes, parent)) {
      throw makeCoreError(ErrorCodes.InvalidTreeParent, "tree parent does not exist");
    }
    if (parent === id || isTreeDescendant(target.nodes, parent, id)) {
      throw makeCoreError(ErrorCodes.TreeCycle, "tree move would create cycle");
    }
    if (siblingTreePosExists(target.nodes, parent, pos, id)) {
      throw makeCoreError(ErrorCodes.DuplicateTreePos, "tree sibling position already exists");
    }

    const nextNodes = [...target.nodes];
    nextNodes[index] = {
      ...target.nodes[index]!,
      parent,
      pos,
    };
    nextNodes.sort(compareTreeNodes);
    replaceValue(target, treeValue(nextNodes));
  });
};

const applyTreeDelete = (state: Value, path: Path, id: string): void => {
  if (!id) {
    throw makeCoreError(ErrorCodes.InvalidCommand, "tree.delete requires id");
  }
  mutateAtPath(state, path, (target) => {
    if (target.kind !== "tree") {
      throw makeCoreError(ErrorCodes.TypeMismatch, "tree command requires tree target");
    }
    if (findTreeNodeIndex(target.nodes, id) === -1) {
      throw makeCoreError(ErrorCodes.MissingTreeNode, "tree node does not exist");
    }

    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of target.nodes) {
        if (toDelete.has(node.parent) && !toDelete.has(node.id)) {
          toDelete.add(node.id);
          changed = true;
        }
      }
    }

    const nextNodes = target.nodes.filter((node) => !toDelete.has(node.id));
    replaceValue(target, treeValue(nextNodes));
  });
};

const mutateAtPath = (current: Value, path: Path, fn: (target: Value) => void): void => {
  if (path.length === 0) {
    fn(current);
    return;
  }

  const segment = path[0]!;
  const rest = path.slice(1);
  switch (segment.kind) {
    case "field":
      if (current.kind !== "object") {
        throw makeCoreError(ErrorCodes.TypeMismatch, "field path requires object");
      }
      if (!Object.hasOwn(current.fields, segment.key)) {
        throw makeCoreError(ErrorCodes.MissingField, "field does not exist");
      }
      mutateAtPath(current.fields[segment.key]!, rest, fn);
      return;
    case "item":
      if (current.kind !== "array") {
        throw makeCoreError(ErrorCodes.TypeMismatch, "item path requires array");
      }
      {
        const index = findArrayItemIndex(current.items, segment.id);
        if (index === -1) {
          throw makeCoreError(ErrorCodes.MissingArrayItem, "array item does not exist");
        }
        mutateAtPath(current.items[index]!.value, rest, fn);
      }
      return;
    case "node":
      if (current.kind !== "tree") {
        throw makeCoreError(ErrorCodes.TypeMismatch, "node path requires tree");
      }
      {
        const index = findTreeNodeIndex(current.nodes, segment.id);
        if (index === -1) {
          throw makeCoreError(ErrorCodes.MissingTreeNode, "tree node does not exist");
        }
        mutateAtPath(current.nodes[index]!.value, rest, fn);
      }
      return;
  }
};

const replaceValue = (target: Value, next: Value): void => {
  for (const key of Object.keys(target)) {
    Reflect.deleteProperty(target, key);
  }
  Object.assign(target, next);
};

/**
 * Narrow view over an object value's fields so in-place edits stay local to this module.
 */
const mutableFields = (target: ObjectValue): Record<string, Value> => target.fields;

const cloneObjectValue = (value: ObjectValue): ObjectValue => {
  const fields: Record<string, Value> = {};
  for (const [key, field] of Object.entries(value.fields)) {
    fields[key] = cloneValue(field);
  }
  return objectValue(fields);
};

const findArrayItemIndex = (items: readonly ArrayItem[], id: string): number =>
  items.findIndex((item) => item.id === id);

const findTreeNodeIndex = (nodes: readonly TreeNode[], id: string): number =>
  nodes.findIndex((node) => node.id === id);

const treeParentExists = (nodes: readonly TreeNode[], parent: string): boolean =>
  parent === HiddenTreeRootId || findTreeNodeIndex(nodes, parent) !== -1;

const siblingTreePosExists = (
  nodes: readonly TreeNode[],
  parent: string,
  pos: string,
  excludeId: string,
): boolean =>
  nodes.some((node) => node.parent === parent && node.id !== excludeId && node.pos === pos);

const isTreeDescendant = (
  nodes: readonly TreeNode[],
  candidateId: string,
  ancestorId: string,
): boolean => {
  if (candidateId === HiddenTreeRootId) {
    return false;
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let currentId = candidateId;
  while (true) {
    const node = byId.get(currentId);
    if (!node) {
      return false;
    }
    if (node.parent === ancestorId) {
      return true;
    }
    if (node.parent === HiddenTreeRootId) {
      return false;
    }
    currentId = node.parent;
  }
};
