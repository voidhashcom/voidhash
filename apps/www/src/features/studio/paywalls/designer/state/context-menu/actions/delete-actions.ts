/**
 * Delete actions.
 */

import { deleteNodes } from "../../actions";
import type { ContextMenuAction } from "../types";

// =============================================================================
// Actions
// =============================================================================

export const deleteAction: ContextMenuAction = {
  id: "delete",
  label: "Delete",
  shortcut: { key: "Backspace" },
  group: "delete",
  isVisible: (ctx) => {
    // Show when there's a selection
    return ctx.selection.selectedNodeIds.length > 0;
  },
  isEnabled: (ctx) => {
    // Disable for screen nodes (and root, but that's never selectable)
    // Enable if at least one selected node is not a screen
    return ctx.selection.selectedNodeTypes.some((type) => type !== "screen");
  },
  execute: (_ctx, dispatch) => {
    dispatch(deleteNodes)({});
  },
};

/**
 * All delete actions for registration.
 */
export const deleteActions: ContextMenuAction[] = [deleteAction];
