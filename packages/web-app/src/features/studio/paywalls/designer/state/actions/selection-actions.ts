/**
 * Selection commands using zustand-commander.
 *
 * These commands manage the currently selected nodes.
 * Selection state is stored in presence for real-time collaboration.
 */

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import { presenceInputFromSnapshot } from "../utils/presence";
import { findNodeById, flattenTree } from "../utils/tree";

// =============================================================================
// Selection Commands
// =============================================================================

/**
 * Select a node.
 * If `many` is false, clears current selection and selects only this node.
 * If `many` is true, adds to the current selection (multi-select mode).
 */
export const selectNode = commander.action<{ id: string; many: boolean }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic } = state;

  // Get current presence data
  const currentPresence = mimic.document.presence?.self();
  if (!currentPresence) {
    return;
  }

  const presenceInput = presenceInputFromSnapshot(currentPresence);
  const selectedNodeIds = presenceInput.selectedNodeIds;

  // If not selecting multiple nodes, clear the selection and select the new node
  if (!params.many) {
    // Update presence for collaboration (set entire presence object)
    mimic.document.presence?.set({
      ...presenceInput,
      selectedNodeIds: [params.id],
    });
    ctx.setState({
      highlightedNodeId: params.id,
    });
    return;
  }

  // Multi-select mode: combine the new selection
  const root = selectDocumentRoot(state);

  const nodeSubtree = findNodeById<SnapshotNode>(root, params.id);
  if (!nodeSubtree) {
    return;
  }

  // Do not select if already selected as a child of another selected node
  const allSelectedNodeIdsAndSubnodeIds = new Set(
    selectedNodeIds.flatMap((id) =>
      flattenTree(findNodeById<SnapshotNode>(root, id)).map((node) => node.id),
    ),
  );

  if (allSelectedNodeIdsAndSubnodeIds.has(params.id)) {
    return;
  }

  // Remove all children of the newly selected node
  const nodeIdsToUnselect = new Set(
    flattenTree(nodeSubtree)
      .map((node) => node.id)
      .filter((id) => id !== params.id),
  );

  const newSelectedNodeIds = [...selectedNodeIds, params.id].filter(
    (id) => !nodeIdsToUnselect.has(id),
  );

  const uniqueSelectedNodeIds = [...new Set(newSelectedNodeIds)];

  // Update presence for collaboration
  mimic.document.presence?.set({
    ...presenceInput,
    selectedNodeIds: uniqueSelectedNodeIds,
  });
  ctx.setState({
    highlightedNodeId: params.id,
  });
});

/**
 * Unselect a specific node.
 */
export const unselectNode = commander.action<{ id: string }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic } = state;

  const currentPresence = mimic.document.presence?.self();
  if (!currentPresence) {
    return;
  }
  const presenceInput = presenceInputFromSnapshot(currentPresence);
  const newSelectedNodeIds = presenceInput.selectedNodeIds.filter((id) => id !== params.id);

  // Update presence for collaboration
  mimic.document.presence?.set({
    ...presenceInput,
    selectedNodeIds: newSelectedNodeIds,
  });
});

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
      ...presenceInputFromSnapshot(currentPresence),
      selectedNodeIds: [],
    });
  }

  // Reset highlight so deleted or previously selected nodes are fully deselected in UI.
  ctx.setState({
    highlightedNodeId: null,
  });
});
