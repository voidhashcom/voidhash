/**
 * Selection commands using zustand-commander.
 *
 * These commands manage the currently selected nodes.
 * Selection state is stored in presence for real-time collaboration.
 */

import { Schema } from 'effect';
import { commander } from '../designer-commander';
import type { DesignerStateNodes } from '../schema';
import { createTree, findSubtreeInTree, flattenTree } from '../utils/nodes';

// =============================================================================
// Helper to get nodes from snapshot as a flat map
// =============================================================================

/**
 * Converts the tree snapshot to a flat nodes map for compatibility
 * with existing tree utilities.
 */
function getNodesFromSnapshot(
  snapshot: {
    id: string;
    type: string;
    children: unknown[];
  } | null
): DesignerStateNodes {
  if (!snapshot) {
    return {};
  }

  const nodes: DesignerStateNodes = {};

  const traverse = (node: {
    id: string;
    type: string;
    children?: unknown[];
  }): void => {
    // Add the node to the map (spread to get all properties)
    nodes[node.id] = node as DesignerStateNodes[string];

    // Recursively traverse children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as { id: string; type: string; children?: unknown[] });
      }
    }
  };

  traverse(snapshot);
  return nodes;
}

// =============================================================================
// Selection Commands
// =============================================================================

/**
 * Select a node.
 * If `many` is false, clears current selection and selects only this node.
 * If `many` is true, adds to the current selection (multi-select mode).
 */
export const selectNode = commander.action(
  Schema.Struct({ id: Schema.String, many: Schema.Boolean }),
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Get current presence data
    const currentPresence = mimic.document.presence?.self();

    // Get current selection from presence
    const selectedNodeIds = currentPresence?.selectedNodeIds ?? [];

    // If not selecting multiple nodes, clear the selection and select the new node
    if (!params.many) {
      // Update presence for collaboration (set entire presence object)
      if (currentPresence) {
        mimic.document.presence?.set({
          ...currentPresence,
          selectedNodeIds: [params.id]
        });
      }
      return;
    }

    // Multi-select mode: combine the new selection
    const nodes = getNodesFromSnapshot(
      mimic.snapshot as {
        id: string;
        type: string;
        children: unknown[];
      } | null
    );
    const tree = createTree(nodes);
    const nodeSubtree = findSubtreeInTree(tree, params.id);
    if (!nodeSubtree) {
      return;
    }

    // Do not select if already selected as a child of another selected node
    const allSelectedNodeIdsAndSubnodeIds = new Set(
      selectedNodeIds.flatMap((id) => {
        const subtree = findSubtreeInTree(tree, id);
        if (!subtree) {
          return [];
        }
        return flattenTree(subtree).map((node) => node.id);
      })
    );

    if (allSelectedNodeIdsAndSubnodeIds.has(params.id)) {
      return;
    }

    // Remove all children of the newly selected node
    const flattenedSubtree = flattenTree(nodeSubtree);
    const nodeIdsToUnselect = flattenedSubtree
      .map((node) => node.id)
      .filter((id) => id !== params.id);

    const newSelectedNodeIds = [...selectedNodeIds, params.id].filter(
      (id) => !nodeIdsToUnselect.includes(id)
    );

    const uniqueSelectedNodeIds = Array.from(new Set(newSelectedNodeIds));

    // Update presence for collaboration
    if (currentPresence) {
      mimic.document.presence?.set({
        ...currentPresence,
        selectedNodeIds: uniqueSelectedNodeIds
      });
    }
  }
);

/**
 * Unselect a specific node.
 */
export const unselectNode = commander.action(
  Schema.Struct({ id: Schema.String }),
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    const currentPresence = mimic.document.presence?.self();
    const selectedNodeIds = currentPresence?.selectedNodeIds ?? [];
    const newSelectedNodeIds = selectedNodeIds.filter((id) => id !== params.id);

    // Update presence for collaboration
    if (currentPresence) {
      mimic.document.presence?.set({
        ...currentPresence,
        selectedNodeIds: newSelectedNodeIds
      });
    }
  }
);

/**
 * Clear all selection.
 */
export const clearSelection = commander.action(Schema.Struct({}), (ctx) => {
  const state = ctx.getState();
  const { mimic } = state;

  const currentPresence = mimic.document.presence?.self();

  // Update presence for collaboration
  if (currentPresence) {
    mimic.document.presence?.set({
      ...currentPresence,
      selectedNodeIds: []
    });
  }
});
