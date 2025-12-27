/**
 * Selection commands using zustand-commander.
 *
 * These commands manage the currently selected nodes.
 * Selection state is stored in presence for real-time collaboration.
 */

import { commander } from '../designer-commander';

// =============================================================================
// Helper Types
// =============================================================================

interface SnapshotNode {
  id: string;
  type: string;
  children?: SnapshotNode[];
}

// =============================================================================
// Helper Functions for Snapshot Tree
// =============================================================================

/**
 * Find a subtree in the snapshot by its id.
 */
function findSubtreeInSnapshot(
  snapshot: SnapshotNode,
  id: string
): SnapshotNode | null {
  if (snapshot.id === id) {
    return snapshot;
  }
  if (snapshot.children) {
    for (const child of snapshot.children) {
      const found = findSubtreeInSnapshot(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Flatten a snapshot tree into an array of nodes.
 */
function flattenSnapshot(node: SnapshotNode): SnapshotNode[] {
  const result: SnapshotNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenSnapshot(child));
    }
  }
  return result;
}

// =============================================================================
// Selection Commands
// =============================================================================

/**
 * Select a node.
 * If `many` is false, clears current selection and selects only this node.
 * If `many` is true, adds to the current selection (multi-select mode).
 */
export const selectNode = commander.action<{ id: string; many: boolean }>(
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
    const snapshot = mimic.snapshot as SnapshotNode | null;
    if (!snapshot) {
      return;
    }

    const nodeSubtree = findSubtreeInSnapshot(snapshot, params.id);
    if (!nodeSubtree) {
      return;
    }

    // Do not select if already selected as a child of another selected node
    const allSelectedNodeIdsAndSubnodeIds = new Set(
      selectedNodeIds.flatMap((id) => {
        const subtree = findSubtreeInSnapshot(snapshot, id);
        if (!subtree) {
          return [];
        }
        return flattenSnapshot(subtree).map((node) => node.id);
      })
    );

    if (allSelectedNodeIdsAndSubnodeIds.has(params.id)) {
      return;
    }

    // Remove all children of the newly selected node
    const flattenedSubtree = flattenSnapshot(nodeSubtree);
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
export const unselectNode = commander.action<{ id: string }>(
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
export const clearSelection = commander.action((ctx) => {
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
