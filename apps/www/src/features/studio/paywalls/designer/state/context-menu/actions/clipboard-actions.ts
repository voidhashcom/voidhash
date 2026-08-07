/**
 * Clipboard actions: Copy, Cut, Paste.
 */

import { copyNodes, cutNodes, pasteNodes } from "../../actions";
import type { ContextMenuAction } from "../types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if there's a valid selection that can be copied/cut.
 * Screen nodes cannot be copied/cut.
 */
function hasCopiableSelection(selectedNodeTypes: string[]): boolean {
  if (selectedNodeTypes.length === 0) {
    return false;
  }
  // Filter out screen nodes - they cannot be copied
  return selectedNodeTypes.some((type) => type !== "screen");
}

// =============================================================================
// Actions
// =============================================================================

export const copyAction: ContextMenuAction = {
  id: "copy",
  label: "Copy",
  shortcut: { key: "c", modKey: true },
  group: "clipboard",
  isVisible: (ctx) => {
    // Show when there's a selection (visible in context menu when nodes selected)
    return ctx.selection.selectedNodeIds.length > 0;
  },
  isEnabled: (ctx) => {
    // Enable when there's a copiable selection
    return hasCopiableSelection(ctx.selection.selectedNodeTypes);
  },
  execute: (_ctx, dispatch) => {
    void dispatch(copyNodes)({});
  },
};

export const cutAction: ContextMenuAction = {
  id: "cut",
  label: "Cut",
  shortcut: { key: "x", modKey: true },
  group: "clipboard",
  isVisible: (ctx) => {
    // Show when there's a selection
    return ctx.selection.selectedNodeIds.length > 0;
  },
  isEnabled: (ctx) => {
    // Enable when there's a copiable selection (same as copy)
    return hasCopiableSelection(ctx.selection.selectedNodeTypes);
  },
  execute: (_ctx, dispatch) => {
    void dispatch(cutNodes)({});
  },
};

export const pasteAction: ContextMenuAction = {
  id: "paste",
  label: "Paste",
  shortcut: { key: "v", modKey: true },
  group: "clipboard",
  isVisible: () => {
    // Always show paste - clipboard might have content
    // We can't check clipboard synchronously, so always show
    return true;
  },
  isEnabled: () => {
    // Always enabled - the paste action itself handles finding a valid target
    // (falls back to original parent or parent of selected node)
    return true;
  },
  execute: (_ctx, dispatch) => {
    void dispatch(pasteNodes)({});
  },
};

/**
 * All clipboard actions for registration.
 */
export const clipboardActions: ContextMenuAction[] = [copyAction, cutAction, pasteAction];
