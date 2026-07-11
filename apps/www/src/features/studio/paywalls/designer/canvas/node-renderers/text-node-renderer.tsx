import { resolveText } from "@voidhash/mimic-schema";
import { buildTextStyles, type TextSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand/react";

import {
  selectNode,
  textEditingStarted,
  textEditingStopped,
  updateNodeTranslation,
  updateTextNode,
} from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import { documentRootFromSnapshot } from "../../state/utils/document-root";
import { selectDefaultLocale } from "../../state/utils/localization";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";
import { canSelectNode } from "../../state/utils/selection-level";
import {
  getSelectedStateIdForNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { Selectable } from "../helpers/selectable";

export function TextNodeRenderer({
  node,
  ref,
}: {
  node: TextSnapshotNode;
  /**
   * Ref to the single styled element (accepts a callback or object ref). The
   * caller registers this element with the bounding-box manager, so it MUST be
   * the element carrying `buildTextStyles` output (position + offsets).
   */
  ref?: React.Ref<HTMLDivElement>;
}) {
  const store = usePaywallDesignerStore();
  const editingNodeId = useStore(store, (state) => state.textEditingNodeId);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const defaultLocale = useStore(store, selectDefaultLocale);
  const selectedStateId = useStore(store, (state) =>
    getSelectedStateIdForNode(state.stateOverrideSelection, node.id),
  );
  const isTextEditingMode = editingNodeId !== null;
  const isFocused = editingNodeId === node.id;
  // `null` (default locale) resolves byte-for-byte to today's `node.data.text`.
  const isBaseLocale = activeLocale === null || activeLocale === defaultLocale;
  const resolvedText = resolveText(node.data, activeLocale, defaultLocale);
  // A non-default locale that resolves back to the base text has no override —
  // dim it in place so untranslated content is scannable without shifting layout.
  const isMissingTranslation = !isBaseLocale && resolvedText === node.data.text;
  const effectiveStyle = resolveEffectiveStyle(
    node,
    selectedStateId,
  ) as TextSnapshotNode["data"]["style"];
  const editableRef = useRef<HTMLDivElement>(null);
  // Track if focus came from a click (place cursor) vs double-click (select all)
  const focusedViaClickRef = useRef(false);
  const dispatch = usePaywallDesignerActions();

  // The styled element carries `buildTextStyles` output (position + offsets),
  // so it MUST also be the element the bounding-box manager registers — an
  // absolute text node has to leave the flow on the very element selection
  // boxes and drag math measure. Point both the internal `editableRef`
  // (content/focus) and the forwarded `ref` (bounding-box manager) at it,
  // supporting either a callback or object ref from the caller.
  const setElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      editableRef.current = element;
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    },
    [ref],
  );

  // Initialize content when entering text editing mode
  // All text nodes need their content set via refs since React doesn't render children in editing mode
  useEffect(() => {
    if (isTextEditingMode && editableRef.current) {
      editableRef.current.textContent = resolvedText;
    }
  }, [isTextEditingMode, resolvedText]);

  // Focus and select text when this node becomes focused via double-click
  // (not when switching from another text node - that uses click position)
  useEffect(() => {
    if (isFocused && editableRef.current) {
      // Skip if focus came from a click (cursor already placed)
      if (focusedViaClickRef.current) {
        focusedViaClickRef.current = false;
        return;
      }

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (editableRef.current) {
          editableRef.current.focus();
          // Select all text when entering via double-click
          const range = document.createRange();
          range.selectNodeContents(editableRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });
    }
  }, [isFocused]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // In text editing mode, all text nodes are editable regardless of selection level
    if (!isTextEditingMode) {
      // Check if this text node can be interacted with at the current selection level
      const state = store.getState();
      const documentRoot = documentRootFromSnapshot(state.mimic.snapshot);
      const selectedNodeIds = selectedNodeIdsFromPresence(state.mimic.presence?.self);

      if (!canSelectNode(documentRoot, node.id, selectedNodeIds)) {
        return; // Let event bubble to parent
      }
    }

    e.stopPropagation();
    dispatch(textEditingStarted)({ id: node.id });
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    selectableOnMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void,
  ) => {
    // In text editing mode, handle focus switching between text nodes
    if (isTextEditingMode) {
      e.stopPropagation();

      if (!isFocused) {
        // Mark that focus came from a click (not double-click)
        // This prevents the useEffect from selecting all text
        focusedViaClickRef.current = true;

        // Let the browser handle focus and cursor placement naturally
        // (don't call preventDefault - let mousedown focus the contentEditable)

        // Update state to track this node as the editing node
        dispatch(textEditingStarted)({ id: node.id });

        // Also select this node so the blue selection rectangle moves
        dispatch(selectNode)({ id: node.id, many: false });
      }
      return;
    }

    // Not in text editing mode - use the selectable's mouse down handler
    selectableOnMouseDown?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const finalValue = editableRef.current?.textContent ?? "";

    // Save the changes against the active locale. Base-locale edits keep
    // dispatching `updateTextNode`; a non-default locale routes to
    // `updateNodeTranslation` (empty value clears the override → base fallback).
    if (finalValue !== resolvedText) {
      if (activeLocale === null || activeLocale === defaultLocale) {
        dispatch(updateTextNode)({
          id: node.id,
          updates: { text: finalValue },
        });
      } else {
        dispatch(updateNodeTranslation)({
          id: node.id,
          locale: activeLocale,
          text: finalValue,
        });
      }
    }

    // Check if focus is moving to another text node
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isMovingToAnotherTextNode = relatedTarget?.closest("[data-text-node]") !== null;

    if (!isMovingToAnotherTextNode) {
      // Exit text editing mode entirely
      dispatch(textEditingStopped)({ id: node.id });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Reset content to original value (discard changes)
      if (editableRef.current) {
        editableRef.current.textContent = resolvedText;
      }
      // Exit text editing mode directly (don't save)
      dispatch(textEditingStopped)({ id: node.id });
      // Remove focus
      e.currentTarget.blur();
    }
  };

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => {
        // Extract onDoubleClick since text nodes use their own handler for text editing
        const { role, onMouseDown, onDoubleClick: _, ...otherSelectableProps } = selectableProps;
        const elementRole = isFocused ? "textbox" : role;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: We need a div to support both selectable (button role) and editable (textbox role) modes
          // biome-ignore lint/nursery/noNoninteractiveElementInteractions: We need a div to support both selectable (button role) and editable (textbox role) modes
          <div
            contentEditable={isTextEditingMode}
            data-text-node="true"
            key={isTextEditingMode ? "editing" : "display"}
            onBlur={handleBlur}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => handleMouseDown(e, onMouseDown)}
            ref={setElementRef}
            role={elementRole}
            style={{
              ...(buildTextStyles(effectiveStyle) as React.CSSProperties),
              // Editor-specific overrides
              userSelect: isTextEditingMode ? "text" : "none",
              cursor: isTextEditingMode ? "text" : "default",
              outline: "none",
              // Subtle missing-translation affordance (does not alter layout).
              ...(isMissingTranslation && !isTextEditingMode ? { opacity: 0.5 } : {}),
            }}
            suppressContentEditableWarning
            {...otherSelectableProps}
          >
            {/* In editing mode, content is managed via refs for all text nodes */}
            {!isTextEditingMode && resolvedText}
          </div>
        );
      }}
    </Selectable>
  );
}
