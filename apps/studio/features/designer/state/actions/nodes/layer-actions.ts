import {
  generateJitteredKeyBetween,
  IndexGenerator
} from 'fractional-indexing-jittered';
import z from 'zod';
import type { NodeDataWithoutRoot } from '../../schema';
import { getNodesByParentId } from '../../utils/nodes';
import type { DesignerStoreState } from '../types';

/**
 * Moves a node to a new parent and/or position within siblings.
 * Uses fractional indexing to determine the new position.
 */
export const moveNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({
      /** The ID of the node being moved */
      nodeId: z.string(),
      /** The ID of the new parent (can be the same as current parent) */
      newParentId: z.string(),
      /** The ID of the sibling to place the node before (null = place at end) */
      beforeSiblingId: z.string().nullable()
    }),
    ({ params, getState, doc }) => {
      const state = getState();
      const node = state.nodes?.[params.nodeId];

      if (!node || node.type === 'root') {
        return;
      }

      const newParent = state.nodes?.[params.newParentId];
      if (!newParent) {
        return;
      }

      // Prevent moving a node into itself or its descendants
      if (isDescendant(state.nodes, params.nodeId, params.newParentId)) {
        return;
      }

      // Get siblings at the new parent (excluding the node being moved)
      const siblings = getNodesByParentId(state.nodes, params.newParentId)
        .filter((n) => n.id !== params.nodeId)
        .sort((a, b) => a.parent.index.localeCompare(b.parent.index));

      // Calculate the new fractional index
      const newIndex = calculateNewIndex(siblings, params.beforeSiblingId);

      // Update the node with new parent and index
      const nodesMap = doc.getMap('nodes');
      const updatedNode: NodeDataWithoutRoot = {
        ...node,
        parent: {
          id: params.newParentId,
          index: newIndex
        }
      };

      nodesMap.set(params.nodeId, updatedNode);
    }
  );

/**
 * Checks if targetId is a descendant of nodeId
 */
function isDescendant(
  nodes: Record<string, { type: string; parent?: { id: string } }> | undefined,
  nodeId: string,
  targetId: string
): boolean {
  if (!nodes || nodeId === targetId) {
    return true;
  }

  let current = nodes[targetId];
  while (current && 'parent' in current && current.parent) {
    if (current.parent.id === nodeId) {
      return true;
    }
    current = nodes[current.parent.id];
  }

  return false;
}

/**
 * Calculates a new fractional index for a node being inserted among siblings.
 */
function calculateNewIndex(
  siblings: NodeDataWithoutRoot[],
  beforeSiblingId: string | null
): string {
  const existingIndices = siblings.map((s) => s.parent.index);
  const generator = new IndexGenerator(existingIndices);

  if (siblings.length === 0) {
    // No siblings, generate first index
    return generator.keyEnd();
  }

  if (beforeSiblingId === null) {
    // Place at the end
    return generator.keyEnd();
  }

  const beforeIndex = siblings.findIndex((s) => s.id === beforeSiblingId);

  if (beforeIndex === -1) {
    // Sibling not found, place at end
    return generator.keyEnd();
  }

  if (beforeIndex === 0) {
    // Place at the beginning
    return generator.keyStart();
  }

  // Place between two siblings
  const prevSibling = siblings[beforeIndex - 1];
  const nextSibling = siblings[beforeIndex];

  if (!(prevSibling && nextSibling)) {
    return generator.keyEnd();
  }

  return generateJitteredKeyBetween(
    prevSibling.parent.index,
    nextSibling.parent.index
  );
}

export const createLayerActions = (storeState: DesignerStoreState) => ({
  moveNode: moveNode(storeState)
});
