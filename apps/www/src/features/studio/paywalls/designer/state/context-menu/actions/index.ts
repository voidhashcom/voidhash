/**
 * Context menu actions index.
 *
 * This module exports all actions and handles registration with the registry.
 */

import { contextMenuRegistry } from "../action-registry";

import { clipboardActions } from "./clipboard-actions";
import { createActions } from "./create-actions";
import { deleteActions } from "./delete-actions";
import { selectionActions } from "./selection-actions";

// =============================================================================
// Exports
// =============================================================================

export { clipboardActions } from "./clipboard-actions";
export { createActions } from "./create-actions";
export { deleteActions } from "./delete-actions";
export { selectionActions } from "./selection-actions";

// =============================================================================
// Registration
// =============================================================================

/**
 * All standard actions for the context menu system.
 */
export const allContextMenuActions = [
  ...clipboardActions,
  ...createActions,
  ...selectionActions,
  ...deleteActions,
];

/**
 * Register all standard actions with the registry.
 * Call this once during app initialization.
 */
export function registerContextMenuActions(): void {
  contextMenuRegistry.registerAll(allContextMenuActions);
}
