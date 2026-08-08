/**
 * Selection actions: Select Parent, Deselect All.
 */

import { clearSelection, selectNode } from "../../actions";
import { buildParentMap } from "../../utils/selection-level";
import type { ContextMenuAction, ContextMenuContext } from "../types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the parent ID of the first selected node.
 */
function getSelectableParentId(ctx: ContextMenuContext): string | null {
  const { selectedNodeIds } = ctx.selection;
  if (selectedNodeIds.length === 0 || !ctx.snapshot) {
    return null;
  }

  const parentMap = buildParentMap(ctx.snapshot);
  const firstSelectedId = selectedNodeIds[0];
  if (!firstSelectedId) {
    return null;
  }

  const parentId = parentMap[firstSelectedId];
  if (!parentId) {
    return null;
  }

  // Don't allow selecting root
  if (parentId === ctx.snapshot.id && ctx.snapshot.type === "root") {
    return null;
  }

  return parentId;
}

// =============================================================================
// Actions
// =============================================================================

export const selectParentAction: ContextMenuAction = {
  id: "select-parent",
  label: "Select Parent",
  shortcut: { key: "Escape" },
  group: "selection",
  isVisible: (ctx) => {
    // Show when there's a selection with a valid parent to select
    return getSelectableParentId(ctx) !== null;
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (ctx, dispatch) => {
    const parentId = getSelectableParentId(ctx);
    if (!parentId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ContextMenu] selectParentAction: Unable to get parent ID. Selection: ${ctx.selection.selectedNodeIds.join(", ")}`,
        );
      }
      return;
    }

    dispatch(clearSelection)({});
    dispatch(selectNode)({ id: parentId, many: false });
  },
};

export const deselectAllAction: ContextMenuAction = {
  id: "deselect-all",
  label: "Deselect All",
  group: "selection",
  isVisible: (ctx) => {
    // Show when there's a selection
    return ctx.selection.selectedNodeIds.length > 0;
  },
  isEnabled: () => {
    // Always enabled when visible
    return true;
  },
  execute: (_ctx, dispatch) => {
    dispatch(clearSelection)({});
  },
};

/**
 * All selection actions for registration.
 */
export const selectionActions: ContextMenuAction[] = [selectParentAction, deselectAllAction];
