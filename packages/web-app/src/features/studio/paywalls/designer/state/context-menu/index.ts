/**
 * Context menu system public API.
 *
 * This module provides a unified context menu and keyboard shortcut system
 * for the paywall designer. Actions are defined once and used by both
 * context menus and keyboard shortcuts.
 *
 * @example
 * ```tsx
 * // Initialize actions (call once at app start)
 * import { initializeContextMenuActions } from './state/context-menu';
 * initializeContextMenuActions();
 *
 * // Use the registry
 * import { contextMenuRegistry } from './state/context-menu';
 * const actions = contextMenuRegistry.getGroupedActions(context);
 * ```
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  ActionGroup,
  ActionShortcut,
  ClickContext,
  ContextMenuAction,
  ContextMenuContext,
  ContextSource,
  DispatchFn,
  NodeType,
  ResolvedAction,
  SelectionContext,
} from "./types";

// =============================================================================
// Registry Export
// =============================================================================

export { contextMenuRegistry } from "./action-registry";

// =============================================================================
// Action Exports
// =============================================================================

import { registerContextMenuActions } from "./actions";

export {
  allContextMenuActions,
  clipboardActions,
  createActions,
  deleteActions,
  registerContextMenuActions,
  selectionActions,
} from "./actions";

// =============================================================================
// Initialization
// =============================================================================

let initialized = false;

/**
 * Initialize the context menu system.
 * Registers all standard actions with the registry.
 * Safe to call multiple times - will only initialize once.
 */
export function initializeContextMenuActions(): void {
  if (initialized) {
    return;
  }

  registerContextMenuActions();
  initialized = true;
}
