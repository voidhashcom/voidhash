/**
 * Create actions: Add Row, Add Column, Add Text.
 */

import { canCreateLayoutChildren } from "@voidhash/mimic-schema";
import * as Option from "effect/Option";

import { createScrollViewNode, createTextNode, createViewNode } from "../../actions";
import { nodePassesSlotGate } from "../../utils/component-children";
import type { SnapshotNode } from "../../utils/selection-level";
import type { ContextMenuAction, ContextMenuContext } from "../types";

// =============================================================================
// Helper Functions
// =============================================================================

function findNodeById(node: SnapshotNode | null, nodeId: string): SnapshotNode | null {
  if (!node) {
    return null;
  }
  if (node.id === nodeId) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Check if the current selection can accept children. Component targets
 * additionally pass the manifest slot gate (slot-less components reject
 * Add Row/Column/Text).
 */
function canAddChildren(ctx: ContextMenuContext): boolean {
  const { selectedNodeIds, selectedNodeTypes } = ctx.selection;

  // Need exactly one node selected
  if (selectedNodeIds.length !== 1) {
    return false;
  }

  // Must be a node type that can host layout primitives.
  const type = selectedNodeTypes[0];
  if (!canCreateLayoutChildren(Option.fromUndefinedOr(type))) {
    return false;
  }

  if (type === "component") {
    const nodeId = selectedNodeIds[0];
    const node = nodeId === undefined ? null : findNodeById(ctx.snapshot, nodeId);
    return nodePassesSlotGate(node, ctx.componentCatalogByContentHash);
  }

  return true;
}

/**
 * Get the parent ID for creating a new node.
 */
function getParentId(ctx: ContextMenuContext): string | null {
  if (ctx.selection.selectedNodeIds.length !== 1) {
    return null;
  }
  return ctx.selection.selectedNodeIds[0] ?? null;
}

// =============================================================================
// Actions
// =============================================================================

export const addRowAction: ContextMenuAction = {
  id: "add-row",
  label: "Add Row",
  group: "create",
  isVisible: (ctx) => {
    // Show when a container is selected
    return canAddChildren(ctx);
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (ctx, dispatch) => {
    const parentId = getParentId(ctx);
    if (!parentId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ContextMenu] addRowAction: Unable to get parent ID. Selection: ${ctx.selection.selectedNodeIds.join(", ")}`,
        );
      }
      return;
    }

    dispatch(createViewNode)({
      initialValues: {
        name: "Row",
        style: { flexDirection: "row" },
      },
      insertAffordance: true,
      parentId,
    });
  },
};

export const addColumnAction: ContextMenuAction = {
  id: "add-column",
  label: "Add Column",
  group: "create",
  isVisible: (ctx) => {
    // Show when a container is selected
    return canAddChildren(ctx);
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (ctx, dispatch) => {
    const parentId = getParentId(ctx);
    if (!parentId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ContextMenu] addColumnAction: Unable to get parent ID. Selection: ${ctx.selection.selectedNodeIds.join(", ")}`,
        );
      }
      return;
    }

    dispatch(createViewNode)({
      initialValues: {
        name: "Column",
        style: { flexDirection: "column" },
      },
      insertAffordance: true,
      parentId,
    });
  },
};

export const addScrollViewAction: ContextMenuAction = {
  id: "add-scroll-view",
  label: "Add Scroll View",
  group: "create",
  isVisible: (ctx) => {
    // Show when a container is selected
    return canAddChildren(ctx);
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (ctx, dispatch) => {
    const parentId = getParentId(ctx);
    if (!parentId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ContextMenu] addScrollViewAction: Unable to get parent ID. Selection: ${ctx.selection.selectedNodeIds.join(", ")}`,
        );
      }
      return;
    }

    dispatch(createScrollViewNode)({
      initialValues: {
        name: "ScrollView",
        // Vertical scroll => column main-axis flow for its children.
        style: { flexDirection: "column" },
      },
      insertAffordance: true,
      parentId,
    });
  },
};

export const addTextAction: ContextMenuAction = {
  id: "add-text",
  label: "Add Text",
  group: "create",
  isVisible: (ctx) => {
    // Show when a container is selected
    return canAddChildren(ctx);
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (ctx, dispatch) => {
    const parentId = getParentId(ctx);
    if (!parentId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ContextMenu] addTextAction: Unable to get parent ID. Selection: ${ctx.selection.selectedNodeIds.join(", ")}`,
        );
      }
      return;
    }

    dispatch(createTextNode)({
      initialValues: {
        name: "Text",
        text: "New Text",
      },
      parentId,
    });
  },
};

/**
 * All create actions for registration.
 */
export const createActions: ContextMenuAction[] = [
  addRowAction,
  addColumnAction,
  addScrollViewAction,
  addTextAction,
];
