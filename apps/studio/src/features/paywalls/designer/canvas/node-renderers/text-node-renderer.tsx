import type { TextNodeData } from "@voidhash/mimic-schema";
import { buildTextStyles } from "@voidhash/paywall-renderer-web-core";
import { useEffect, useRef } from "react";
import { useStore } from "zustand/react";

import {
  textEditingStarted,
  textEditingStopped,
  updateTextNode,
} from "../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../state/designer-store";
import { Selectable } from "../helpers/selectable";

export function TextNodeRenderer({ node }: { node: TextNodeData }) {
  const store = usePaywallDesignerStore();
  const editingNodeId = useStore(store, (state) => state.textEditingNodeId);
  const isEditing = editingNodeId === node.id;
  const editableRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const dispatch = usePaywallDesignerActions();

  // Initialize content when entering edit mode
  useEffect(() => {
    if (isEditing && editableRef.current && !initializedRef.current) {
      // Set initial content only once when entering edit mode
      editableRef.current.textContent = node.text;
      initializedRef.current = true;
    }
    if (!isEditing) {
      initializedRef.current = false;
    }
  }, [isEditing, node.text]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && editableRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (editableRef.current) {
          editableRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editableRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch(textEditingStarted)({ id: node.id });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
  };

  const handleBlur = () => {
    const finalValue = editableRef.current?.textContent ?? "";
    dispatch(textEditingStopped)({ id: node.id });
    // Save the changes
    if (finalValue !== node.text) {
      dispatch(updateTextNode)({
        id: node.id,
        updates: { text: finalValue },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      // Reset content to original value
      if (editableRef.current) {
        editableRef.current.textContent = node.text;
      }
      e.currentTarget.blur();
    }
  };

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => {
        const { role, onMouseDown, ...otherSelectableProps } = selectableProps;
        const elementRole = isEditing ? "textbox" : role;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: We need a div to support both selectable (button role) and editable (textbox role) modes
          // biome-ignore lint/nursery/noNoninteractiveElementInteractions: We need a div to support both selectable (button role) and editable (textbox role) modes
          <div
            contentEditable={isEditing}
            key={isEditing ? "editing" : "display"}
            onBlur={handleBlur}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onMouseDown={isEditing ? undefined : onMouseDown}
            ref={editableRef}
            role={elementRole}
            style={{
              ...(buildTextStyles(node.style) as React.CSSProperties),
              // Editor-specific overrides
              userSelect: isEditing ? "text" : "none",
              outline: isEditing ? "1px solid currentColor" : "none",
              cursor: isEditing ? "text" : "default",
            }}
            suppressContentEditableWarning
            {...otherSelectableProps}
          >
            {/* When editing, don't render children - let contentEditable manage it */}
            {!isEditing && node.text}
          </div>
        );
      }}
    </Selectable>
  );
}
