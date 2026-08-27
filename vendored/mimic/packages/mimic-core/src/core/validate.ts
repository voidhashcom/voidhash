import { ErrorCodes, makeCoreError } from "./errors.ts";
import { HiddenTreeRootId, type TreeNode, type Value } from "./types.ts";

export const validateValue = (value: Value): void => {
  switch (value.kind) {
    case "string":
    case "boolean":
      return;
    case "number":
      if (Number.isNaN(value.value) || !Number.isFinite(value.value)) {
        throw makeCoreError(ErrorCodes.InvalidCommand, "number must be finite");
      }
      return;
    case "object":
      for (const field of Object.values(value.fields)) {
        validateValue(field);
      }
      return;
    case "array": {
      const ids = new Set<string>();
      const positions = new Set<string>();

      for (const item of value.items) {
        if (ids.has(item.id)) {
          throw makeCoreError(ErrorCodes.DuplicateArrayItemId, "duplicate array item id");
        }
        if (positions.has(item.pos)) {
          throw makeCoreError(ErrorCodes.DuplicateArrayPos, "duplicate array position");
        }
        ids.add(item.id);
        positions.add(item.pos);
        validateValue(item.value);
      }
      return;
    }
    case "tree": {
      const ids = new Set<string>();
      const nodesById = new Map<string, TreeNode>();
      const positionsByParent = new Map<string, Set<string>>();

      for (const node of value.nodes) {
        if (node.id === HiddenTreeRootId) {
          throw makeCoreError(
            ErrorCodes.ReservedIdentifier,
            "tree node id uses reserved root identifier",
          );
        }
        if (node.value.kind !== "object") {
          throw makeCoreError(
            ErrorCodes.TreeNodeValueMustBeObject,
            "tree node value must be object",
          );
        }
        if (ids.has(node.id)) {
          throw makeCoreError(ErrorCodes.DuplicateTreeNodeId, "duplicate tree node id");
        }
        ids.add(node.id);
        nodesById.set(node.id, node);

        const parentPositions = positionsByParent.get(node.parent) ?? new Set<string>();
        if (parentPositions.has(node.pos)) {
          throw makeCoreError(ErrorCodes.DuplicateTreePos, "duplicate tree position");
        }
        parentPositions.add(node.pos);
        positionsByParent.set(node.parent, parentPositions);

        validateValue(node.value);
      }

      for (const node of value.nodes) {
        if (node.parent !== HiddenTreeRootId && !nodesById.has(node.parent)) {
          throw makeCoreError(ErrorCodes.InvalidTreeParent, "tree parent does not exist");
        }
      }

      const visiting = new Set<string>();
      const visited = new Set<string>();

      const visit = (id: string): void => {
        if (visiting.has(id)) {
          throw makeCoreError(ErrorCodes.TreeCycle, "tree contains cycle");
        }
        if (visited.has(id)) {
          return;
        }

        visiting.add(id);
        const node = nodesById.get(id);
        if (node && node.parent !== HiddenTreeRootId) {
          visit(node.parent);
        }
        visiting.delete(id);
        visited.add(id);
      };

      const idsInOrder = [...nodesById.keys()].sort();
      for (const id of idsInOrder) {
        visit(id);
      }
      return;
    }
  }
};
