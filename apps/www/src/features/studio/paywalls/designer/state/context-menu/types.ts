/**
 * Context menu system type definitions.
 *
 * This module defines the core types for the unified context menu and
 * keyboard shortcut system used in the paywall designer.
 */

import type { LucideIcon } from "lucide-react";
import type { CommandDispatch, CommanderSlice } from "@voidhash/mimic/zustand-commander";
import type { EditableNodeType, PaywallDesignerDocument } from "@voidhash/mimic-schema";

import type { ComponentCatalogByContentHash, DesignerStoreState } from "../designer-store-state";
import type { SnapshotNode } from "../utils/selection-level";

// =============================================================================
// Node & Source Types
// =============================================================================

/**
 * Node types in the designer.
 */
export type NodeType = EditableNodeType;

/**
 * Where the context menu was triggered from.
 */
export type ContextSource = "canvas" | "layers-panel";

// =============================================================================
// Context Types
// =============================================================================

/**
 * Selection state for context menu decisions.
 */
export interface SelectionContext {
  /** IDs of currently selected nodes */
  selectedNodeIds: string[];
  /** Types of currently selected nodes */
  selectedNodeTypes: NodeType[];
  /** Whether all selected nodes are the same type */
  isHomogeneousSelection: boolean;
  /** Whether user is currently editing text content */
  isTextEditing: boolean;
}

/**
 * Click/trigger information for context menu.
 */
export interface ClickContext {
  /** Where the context menu was triggered */
  source: ContextSource;
  /** ID of the node that was clicked (null for canvas background) */
  clickedNodeId: string | null;
  /** Type of the node that was clicked */
  clickedNodeType: NodeType | null;
  /** Whether the click was inside a currently selected node's bounds */
  clickedInsideSelection: boolean;
  /** Canvas coordinates of the click (null for layers panel) */
  canvasPosition: { x: number; y: number } | null;
}

/**
 * Full context for action visibility/enablement decisions.
 */
export interface ContextMenuContext {
  /** Current selection state */
  selection: SelectionContext;
  /** Click/trigger details */
  click: ClickContext;
  /** Document snapshot for advanced queries */
  snapshot: SnapshotNode | null;
  /** Catalog mirror for component manifest slot gates. */
  componentCatalogByContentHash: ComponentCatalogByContentHash;
}

// =============================================================================
// Action Types
// =============================================================================

/**
 * Keyboard shortcut definition.
 */
export interface ActionShortcut {
  /** The key to press (e.g., "c", "v", "Backspace") */
  key: string;
  /** Whether Cmd/Ctrl modifier is required */
  modKey?: boolean;
  /** Whether Shift modifier is required */
  shiftKey?: boolean;
}

/**
 * Action group for organizing menu items.
 */
export type ActionGroup = "clipboard" | "create" | "edit" | "arrange" | "selection" | "delete";

/**
 * Dispatch function matching the designer commander's typed dispatch
 * (`createCommander<DesignerStoreState, typeof PaywallDesignerDocument>`),
 * so action payload shapes are checked at the context-menu boundary.
 */
export type DispatchFn = CommandDispatch<
  DesignerStoreState & CommanderSlice,
  typeof PaywallDesignerDocument
>;

/**
 * Context menu action definition.
 *
 * Actions are defined once and used by both context menus and keyboard shortcuts.
 * Each action specifies when it's visible, when it's enabled, and what it does.
 */
export interface ContextMenuAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label in the menu */
  label: string;
  /** Optional keyboard shortcut */
  shortcut?: ActionShortcut;
  /** Group for menu organization */
  group: ActionGroup;
  /**
   * Determines if the action should be visible in the menu.
   * Return false to hide the action entirely.
   */
  isVisible: (ctx: ContextMenuContext) => boolean;
  /**
   * Determines if the action should be enabled.
   * Return false to show the action as disabled/grayed out.
   */
  isEnabled: (ctx: ContextMenuContext) => boolean;
  /**
   * Executes the action.
   * The dispatch function is provided to dispatch commander actions.
   */
  execute: (ctx: ContextMenuContext, dispatch: DispatchFn) => void;
}

/**
 * Group metadata for rendering separators and labels.
 */
export interface ActionGroupMeta {
  id: ActionGroup;
  label?: string;
  order: number;
}

/**
 * Action with computed visibility/enabled state for rendering.
 */
export interface ResolvedAction {
  action: ContextMenuAction;
  isEnabled: boolean;
}
