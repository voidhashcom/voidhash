/**
 * Context menu action registry.
 *
 * A singleton registry that manages all context menu actions.
 * Actions are registered once and can be queried for visibility/enablement
 * based on the current context.
 */

import { isMacPlatform } from "../../utils/platform";
import type {
  ActionGroup,
  ActionGroupMeta,
  ContextMenuAction,
  ContextMenuContext,
  ResolvedAction,
} from "./types";

// =============================================================================
// Group Configuration
// =============================================================================

/**
 * Group metadata defining order and optional labels.
 */
const GROUP_META: ActionGroupMeta[] = [
  { id: "clipboard", order: 1 },
  { id: "create", order: 2 },
  { id: "edit", order: 3 },
  { id: "arrange", order: 4 },
  { id: "selection", order: 5 },
  { id: "delete", order: 6 },
];

// =============================================================================
// Registry Class
// =============================================================================

class ActionRegistry {
  private actions: Map<string, ContextMenuAction> = new Map();

  /**
   * Register an action with the registry.
   * Throws if an action with the same ID already exists.
   */
  register(action: ContextMenuAction): void {
    if (this.actions.has(action.id)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[ActionRegistry] Action "${action.id}" is already registered. Skipping.`);
      }
      return;
    }
    this.actions.set(action.id, action);
  }

  /**
   * Register multiple actions at once.
   */
  registerAll(actions: ContextMenuAction[]): void {
    for (const action of actions) {
      this.register(action);
    }
  }

  /**
   * Get an action by ID.
   */
  get(id: string): ContextMenuAction | undefined {
    return this.actions.get(id);
  }

  /**
   * Get all registered actions.
   */
  getAll(): ContextMenuAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get visible actions for the given context, resolved with enabled state.
   */
  getVisibleActions(ctx: ContextMenuContext): ResolvedAction[] {
    const results: ResolvedAction[] = [];

    for (const action of this.actions.values()) {
      if (action.isVisible(ctx)) {
        results.push({
          action,
          isEnabled: action.isEnabled(ctx),
        });
      }
    }

    return results;
  }

  /**
   * Get visible actions grouped by their group, maintaining order.
   * Returns an array of [group, actions] pairs in display order.
   */
  getGroupedActions(ctx: ContextMenuContext): Array<[ActionGroup, ResolvedAction[]]> {
    const visibleActions = this.getVisibleActions(ctx);

    // Group actions
    const grouped = new Map<ActionGroup, ResolvedAction[]>();
    for (const resolved of visibleActions) {
      const { group } = resolved.action;
      const groupActions = grouped.get(group);
      if (groupActions) {
        groupActions.push(resolved);
      } else {
        grouped.set(group, [resolved]);
      }
    }

    // Sort by group order
    const sortedGroups = GROUP_META.filter((meta) => grouped.has(meta.id)).sort(
      (a, b) => a.order - b.order,
    );

    return sortedGroups.map((meta) => [meta.id, grouped.get(meta.id) ?? []]);
  }

  /**
   * Find an action that matches the given keyboard event.
   * Returns the action if found and visible/enabled, null otherwise.
   */
  findByShortcut(
    ctx: ContextMenuContext,
    event: {
      key: string;
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
    },
  ): ContextMenuAction | null {
    const isMac = isMacPlatform();
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    for (const action of this.actions.values()) {
      if (!action.shortcut) {
        continue;
      }

      const { key, modKey: needsMod = false, shiftKey: needsShift = false } = action.shortcut;

      // Check key match (case-insensitive)
      if (event.key.toLowerCase() !== key.toLowerCase()) {
        continue;
      }

      // Check modifiers
      if (needsMod !== modKey) {
        continue;
      }
      if (needsShift !== event.shiftKey) {
        continue;
      }

      // Check visibility and enabled state
      if (!action.isVisible(ctx) || !action.isEnabled(ctx)) {
        continue;
      }

      return action;
    }

    return null;
  }

  /**
   * Clear all registered actions.
   * Useful for testing or reinitialization.
   */
  clear(): void {
    this.actions.clear();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Global action registry instance.
 */
export const contextMenuRegistry = new ActionRegistry();
