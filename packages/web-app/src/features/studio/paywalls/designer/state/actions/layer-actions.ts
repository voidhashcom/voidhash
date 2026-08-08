/**
 * Layer commands using zustand-commander.
 *
 * These commands manage node positioning in the layer tree.
 * Uses undoable actions for undo/redo support.
 */

import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import type { DesignerDocument } from "../designer-store-state";
import { findNodeById, findParentNode } from "../utils/tree";

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
function findNodeInfo(root: SnapshotNode, nodeId: string): NodeInfo | null {
  const node = findNodeById<SnapshotNode>(root, nodeId);
  if (!node) {
    return null;
  }
  const parent = findParentNode<SnapshotNode>(root, nodeId);
  return {
    id: nodeId,
    index: parent ? parent.children.findIndex((child) => child.id === nodeId) : 0,
    parentId: parent?.id ?? null,
    type: node.type,
  };
}

/**
 * Moves a node under a new parent at the given sibling index through the
 * tree proxy API.
 */
function moveNodeTo(
  document: DesignerDocument,
  nodeId: string,
  newParentId: string,
  toIndex: number,
): void {
  document.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    const parent = root.findByIdAcrossTree(newParentId);
    if (node === undefined || parent === undefined) {
      return;
    }
    node.moveTo(parent.children, toIndex);
  });
}

/**
 * Computes the moveTo target (parent + index) for placing `nodeId` next to
 * `siblingId`. Indexes are relative to the sibling list with the moving node
 * excluded, matching `moveTo`'s insertion semantics.
 */
function siblingMoveTarget(
  root: SnapshotNode,
  nodeId: string,
  siblingId: string,
  placement: "before" | "after",
): { parentId: string; index: number } | null {
  const parent = findParentNode<SnapshotNode>(root, siblingId);
  if (!parent) {
    return null;
  }
  const siblings = parent.children.filter((child) => child.id !== nodeId);
  const siblingIndex = siblings.findIndex((child) => child.id === siblingId);
  if (siblingIndex === -1) {
    return null;
  }
  return {
    index: placement === "before" ? siblingIndex : siblingIndex + 1,
    parentId: parent.id,
  };
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

    const root = selectDocumentRoot(state);

    // Find original position for undo
    const originalInfo = findNodeInfo(root, params.nodeId);
    if (!originalInfo) {
      return { originalIndex: 0, originalParentId: null };
    }

    // Don't move root nodes
    if (originalInfo.type === "root") {
      return { originalIndex: 0, originalParentId: null };
    }

    moveNodeTo(mimic.document, params.nodeId, params.newParentId, params.toIndex);

    return {
      originalIndex: originalInfo.index,
      originalParentId: originalInfo.parentId,
    };
  },
  (ctx, params, result) => {
    const { originalParentId } = result;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    moveNodeTo(mimic.document, params.nodeId, originalParentId, result.originalIndex);
  },
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

    const root = selectDocumentRoot(state);

    // Find original position for undo
    const originalInfo = findNodeInfo(root, params.nodeId);
    if (!originalInfo || originalInfo.type === "root") {
      return { originalIndex: 0, originalParentId: null };
    }

    const target = siblingMoveTarget(root, params.nodeId, params.siblingId, "before");
    if (!target) {
      return { originalIndex: 0, originalParentId: null };
    }

    moveNodeTo(mimic.document, params.nodeId, target.parentId, target.index);

    return {
      originalIndex: originalInfo.index,
      originalParentId: originalInfo.parentId,
    };
  },
  (ctx, params, result) => {
    const { originalParentId } = result;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    moveNodeTo(mimic.document, params.nodeId, originalParentId, result.originalIndex);
  },
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

    const root = selectDocumentRoot(state);

    // Find original position for undo
    const originalInfo = findNodeInfo(root, params.nodeId);
    if (!originalInfo || originalInfo.type === "root") {
      return { originalIndex: 0, originalParentId: null };
    }

    const target = siblingMoveTarget(root, params.nodeId, params.siblingId, "after");
    if (!target) {
      return { originalIndex: 0, originalParentId: null };
    }

    moveNodeTo(mimic.document, params.nodeId, target.parentId, target.index);

    return {
      originalIndex: originalInfo.index,
      originalParentId: originalInfo.parentId,
    };
  },
  (ctx, params, result) => {
    const { originalParentId } = result;
    if (originalParentId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    moveNodeTo(mimic.document, params.nodeId, originalParentId, result.originalIndex);
  },
);
