"use client";

/**
 * Designer Context Menu Component.
 *
 * Renders a context menu with actions from the registry, organized by groups.
 * Used for both canvas nodes and layers panel items.
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@voidhash/ui";
import { Effect } from "effect";
import { Fragment, useCallback, useMemo, useRef } from "react";
import { useContextMenuContext } from "../hooks/use-context-menu-context";
import { isMacPlatform } from "../utils/platform";
import { contextMenuRegistry, initializeContextMenuActions } from "../state/context-menu";
import type {
  ContextMenuContext as ContextMenuContextType,
  ResolvedAction,
} from "../state/context-menu/types";
import { usePaywallDesignerActions } from "../state/designer-store";

// =============================================================================
// Initialize Actions
// =============================================================================

// Ensure actions are registered when this module loads
initializeContextMenuActions();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format a keyboard shortcut for display.
 */
function formatShortcut(shortcut: { key: string; modKey?: boolean; shiftKey?: boolean }): string {
  const parts: string[] = [];
  const isMac = isMacPlatform();

  if (shortcut.modKey) {
    parts.push(isMac ? "\u2318" : "Ctrl");
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? "\u21E7" : "Shift");
  }

  // Format key
  let keyDisplay = shortcut.key;
  if (keyDisplay === "Backspace") {
    keyDisplay = isMac ? "\u232B" : "Del";
  } else if (keyDisplay === "Delete") {
    keyDisplay = isMac ? "\u2326" : "Del";
  } else if (keyDisplay === "Escape") {
    keyDisplay = "Esc";
  } else {
    keyDisplay = keyDisplay.toUpperCase();
  }

  parts.push(keyDisplay);

  return isMac ? parts.join("") : parts.join("+");
}

// =============================================================================
// Components
// =============================================================================

interface ContextMenuItemRowProps {
  resolved: ResolvedAction;
  onSelect: () => void;
}

function ContextMenuItemRow({ resolved, onSelect }: ContextMenuItemRowProps) {
  const { action, isEnabled } = resolved;

  return (
    <ContextMenuItem disabled={!isEnabled} onSelect={onSelect}>
      <span>{action.label}</span>
      {action.shortcut && (
        <ContextMenuShortcut>{formatShortcut(action.shortcut)}</ContextMenuShortcut>
      )}
    </ContextMenuItem>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface DesignerContextMenuProps {
  /** The trigger element (will be wrapped) */
  children: React.ReactNode;
  /** Build params for context when menu opens */
  source: "canvas" | "layers-panel";
  /** ID of the node being right-clicked (null for background) */
  nodeId?: string | null;
  /** Callback when context menu opens */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Context menu wrapper for designer elements.
 *
 * Context is built lazily when the menu opens to avoid unnecessary re-renders.
 *
 * @example
 * ```tsx
 * <DesignerContextMenu source="canvas" nodeId={nodeId}>
 *   <div>Right-click me</div>
 * </DesignerContextMenu>
 * ```
 */
export function DesignerContextMenu({
  children,
  source,
  nodeId = null,
  onOpenChange,
}: DesignerContextMenuProps) {
  const dispatch = usePaywallDesignerActions();
  const { buildContext } = useContextMenuContext();

  // Use a ref to store context - this avoids async state timing issues
  // The ref is updated synchronously when the menu opens
  const contextRef = useRef<ContextMenuContextType | null>(null);

  // Build context and get grouped actions synchronously
  // This is called during render when the menu is open
  const getMenuContent = useCallback(() => {
    const context = buildContext({
      source,
      clickedNodeId: nodeId,
      canvasPosition: null, // Canvas position not currently used by actions
    });
    contextRef.current = context;
    return contextMenuRegistry.getGroupedActions(context);
  }, [buildContext, source, nodeId]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        contextRef.current = null;
      }
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  // Create execute handler using the ref context
  const createExecuteHandler = useCallback(
    (resolved: ResolvedAction) => () => {
      const context = contextRef.current;
      if (!resolved.isEnabled || !context) {
        return;
      }
      Effect.runSync(
        Effect.try({
          try: () => {
            resolved.action.execute(context, dispatch);
          },
          catch: (error: unknown) => error,
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              console.error(`[ContextMenu] Action "${resolved.action.id}" failed:`, error);
            }),
          ),
        ),
      );
    },
    [dispatch],
  );

  // Get grouped actions - computed fresh each render when menu is visible
  const groupedActions = useMemo(() => getMenuContent(), [getMenuContent]);

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {groupedActions.map(([groupId, actions], groupIndex) => (
          <Fragment key={groupId}>
            {groupIndex > 0 && <ContextMenuSeparator />}
            {actions.map((resolved) => (
              <ContextMenuItemRow
                key={resolved.action.id}
                onSelect={createExecuteHandler(resolved)}
                resolved={resolved}
              />
            ))}
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// =============================================================================
// Standalone Content Component
// =============================================================================

export interface DesignerContextMenuContentProps {
  /** The context to use for action visibility/enablement */
  context: ContextMenuContextType;
}

/**
 * Standalone context menu content for manual control.
 *
 * Use this when you need more control over the context menu trigger,
 * such as with imperative context menu positioning.
 */
export function DesignerContextMenuContent({ context }: DesignerContextMenuContentProps) {
  const dispatch = usePaywallDesignerActions();

  // Get grouped actions - computed once per context change
  const groupedActions = useMemo(() => contextMenuRegistry.getGroupedActions(context), [context]);

  // Create execute handler
  const createExecuteHandler = useCallback(
    (resolved: ResolvedAction) => () => {
      if (!resolved.isEnabled) {
        return;
      }
      Effect.runSync(
        Effect.try({
          try: () => {
            resolved.action.execute(context, dispatch);
          },
          catch: (error: unknown) => error,
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              console.error(`[ContextMenu] Action "${resolved.action.id}" failed:`, error);
            }),
          ),
        ),
      );
    },
    [context, dispatch],
  );

  if (groupedActions.length === 0) {
    return null;
  }

  return (
    <ContextMenuContent className="w-56">
      {groupedActions.map(([groupId, actions], groupIndex) => (
        <Fragment key={groupId}>
          {groupIndex > 0 && <ContextMenuSeparator />}
          {actions.map((resolved) => (
            <ContextMenuItemRow
              key={resolved.action.id}
              onSelect={createExecuteHandler(resolved)}
              resolved={resolved}
            />
          ))}
        </Fragment>
      ))}
    </ContextMenuContent>
  );
}
