/**
 * Layer commands using zustand-commander.
 *
 * These commands manage node positioning in the layer tree.
 * Uses undoable actions for undo/redo support.
 */

import { commander } from '../designer-commander';

// =============================================================================
// Helper Types
// =============================================================================

interface NodeInfo {
  id: string;
  type: string;
  parentId: string | null;
  index: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find a node in the snapshot tree and get its parent info.
 */
function findNodeInfo(
  snapshot: {
    id: string;
    type: string;
    children?: unknown[];
  } | null,
  nodeId: string,
  parentId: string | null = null,
  index = 0
): NodeInfo | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.id === nodeId) {
    return { id: nodeId, type: snapshot.type, parentId, index };
  }

  if (snapshot.children && Array.isArray(snapshot.children)) {
    for (let i = 0; i < snapshot.children.length; i++) {
      const child = snapshot.children[i] as {
        id: string;
        type: string;
        children?: unknown[];
      };
      const found = findNodeInfo(child, nodeId, snapshot.id, i);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

// =============================================================================
// Layer Commands
// =============================================================================

/**
 * Move a node to a new parent and/or position within siblings.
 * Undoable: moves the node back to its original position on undo.
 */
export const moveNode = commander.undoableAction<
  {
    nodeId: string;
    newParentId: string;
    toIndex: number;
  },
  { originalParentId: string | null; originalIndex: number }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Get the snapshot to find original position
    const snapshot = mimic.snapshot as {
      id: string;
      type: string;
      children?: unknown[];
    } | null;

    // Find original position for undo
    const originalInfo = findNodeInfo(snapshot, params.nodeId);
    if (!originalInfo) {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Don't move root nodes
    if (originalInfo.type === 'root') {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Perform the move
    mimic.document.transaction((root) => {
      root.move(params.nodeId, params.newParentId, params.toIndex);
    });

    return {
      originalParentId: originalInfo.parentId,
      originalIndex: originalInfo.index
    };
  },
  (ctx, params, result) => {
    const originalParentId = result.originalParentId;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.move(params.nodeId, originalParentId, result.originalIndex);
    });
  }
);

/**
 * Move a node before a sibling.
 * Undoable: moves the node back to its original position on undo.
 */
export const moveNodeBefore = commander.undoableAction<
  {
    nodeId: string;
    siblingId: string;
  },
  { originalParentId: string | null; originalIndex: number }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Get the snapshot to find original position
    const snapshot = mimic.snapshot as {
      id: string;
      type: string;
      children?: unknown[];
    } | null;

    // Find original position for undo
    const originalInfo = findNodeInfo(snapshot, params.nodeId);
    if (!originalInfo) {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Don't move root nodes
    if (originalInfo.type === 'root') {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Perform the move
    mimic.document.transaction((root) => {
      root.moveBefore(params.nodeId, params.siblingId);
    });

    return {
      originalParentId: originalInfo.parentId,
      originalIndex: originalInfo.index
    };
  },
  (ctx, params, result) => {
    const originalParentId = result.originalParentId;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.move(params.nodeId, originalParentId, result.originalIndex);
    });
  }
);

/**
 * Move a node after a sibling.
 * Undoable: moves the node back to its original position on undo.
 */
export const moveNodeAfter = commander.undoableAction<
  {
    nodeId: string;
    siblingId: string;
  },
  { originalParentId: string | null; originalIndex: number }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Get the snapshot to find original position
    const snapshot = mimic.snapshot as {
      id: string;
      type: string;
      children?: unknown[];
    } | null;

    // Find original position for undo
    const originalInfo = findNodeInfo(snapshot, params.nodeId);
    if (!originalInfo) {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Don't move root nodes
    if (originalInfo.type === 'root') {
      return { originalParentId: null, originalIndex: 0 };
    }

    // Perform the move
    mimic.document.transaction((root) => {
      root.moveAfter(params.nodeId, params.siblingId);
    });

    return {
      originalParentId: originalInfo.parentId,
      originalIndex: originalInfo.index
    };
  },
  (ctx, params, result) => {
    const originalParentId = result.originalParentId;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.move(params.nodeId, originalParentId, result.originalIndex);
    });
  }
);
