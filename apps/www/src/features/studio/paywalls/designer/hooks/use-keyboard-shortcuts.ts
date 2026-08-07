"use client";

import { performRedo, performUndo } from "@voidhash/mimic/zustand-commander";
import { Effect } from "effect";
import { useEffect } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import { contextMenuRegistry, initializeContextMenuActions } from "../state/context-menu";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { selectDocumentRoot } from "../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import type { SnapshotNode } from "../state/utils/selection-level";
import { isMacPlatform } from "../utils/platform";

import { buildKeyboardContext } from "./use-context-menu-context";

// Ensure actions are registered
initializeContextMenuActions();

/**
 * Checks if the event target is an editable element that should take priority
 * over global keyboard shortcuts.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target && target instanceof HTMLElement)) {
    return false;
  }

  const { tagName } = target;
  const isInput = tagName === "INPUT" || tagName === "TEXTAREA";
  const isContentEditable = target.contentEditable === "true" || target.isContentEditable;

  return isInput || isContentEditable;
}

/**
 * Hook that sets up global keyboard shortcuts for the designer.
 * Shortcuts are disabled when typing in input fields or contenteditable elements.
 *
 * Uses the action registry to match keyboard events against registered actions,
 * ensuring consistency between keyboard shortcuts and context menu items.
 */
export function useKeyboardShortcuts() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const snapshot: SnapshotNode = useStore(store, selectDocumentRoot);
  const selectedNodeIds = useStore(
    store,
    useShallow((state) => selectedNodeIdsFromPresence(state.mimic.presence?.self)),
  );
  const textEditingNodeId = useStore(
    store,
    useShallow((state) => state.textEditingNodeId),
  );
  const componentCatalogByContentHash = useStore(
    store,
    (state) => state.componentCatalog.byContentHash,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip shortcuts if user is typing in an editable element
      if (isEditableElement(e.target)) {
        return;
      }

      // Undo/redo route to the commander's history (Cmd/Ctrl+Z, Shift for
      // redo, Ctrl+Y on non-mac). Skipped while text-editing so the native
      // contenteditable history applies instead of reverting whole
      // transactions mid-edit.
      const modKey = isMacPlatform() ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();
      if (modKey && (key === "z" || key === "y")) {
        if (textEditingNodeId !== null) {
          return;
        }
        e.preventDefault();
        if (key === "y" || e.shiftKey) {
          performRedo(store);
        } else {
          performUndo(store);
        }
        return;
      }

      // Build context for action lookup
      const context = buildKeyboardContext(
        snapshot,
        selectedNodeIds,
        textEditingNodeId,
        componentCatalogByContentHash,
      );

      // Find matching action from registry
      const action = contextMenuRegistry.findByShortcut(context, {
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });

      if (action) {
        e.preventDefault();
        Effect.runSync(
          Effect.try({
            try: () => action.execute(context, dispatch),
            catch: (error) => error,
          }).pipe(
            Effect.catch((error) =>
              Effect.sync(() => {
                console.error(`[KeyboardShortcuts] Action "${action.id}" failed:`, error);
              }),
            ),
          ),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, store, snapshot, selectedNodeIds, textEditingNodeId, componentCatalogByContentHash]);
}
