import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useEffect, useRef } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import { useDesignerDraft } from "../../hooks/use-designer-draft";
import { DesignerContextMenu } from "../../components/designer-context-menu";
import {
  cancelMove,
  endMove,
  nodeClicked,
  nodeDoubleClicked,
  nodeMouseEnter,
  nodeMouseLeave,
  nodeMouseOver,
  selectNode,
  startMove,
  updateMove,
} from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import { documentRootFromSnapshot } from "../../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";
import {
  getSelectedStateIdForNode,
  resolveEffectiveStyle,
} from "../../state/utils/state-overrides";
import { canSelectNode } from "../../state/utils/selection-level";
import { excludeNestedNodes, findNodeById } from "../../state/utils/tree";
import { useViewport } from "../viewport";

/**
 * Screen-space distance (px) the pointer must travel from mousedown before a
 * drag begins. Below it the gesture stays a plain click so selection,
 * shift-select, and double-click drill-down keep working.
 */
const MOVE_DRAG_THRESHOLD = 3;

export interface SelectableProps {
  children: ({
    onContextMenu,
    onDoubleClick,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    onMouseOver,
    role,
  }: {
    onContextMenu: (e: React.MouseEvent) => void;
    onDoubleClick: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onMouseOver: (e: React.MouseEvent) => void;
    role: string;
  }) => React.ReactNode;
  nodeId: string;
}

export function Selectable({ children, nodeId }: SelectableProps) {
  const store = usePaywallDesignerStore();
  const isSelected = useStore(
    store,
    useShallow((state) =>
      selectedNodeIdsFromPresence(state.mimic.presence?.self).includes(nodeId),
    ),
  );
  const dispatch = usePaywallDesignerActions();
  const viewport = useViewport();
  const { begin: beginDraft, commit: commitDraft, discard: discardDraft } = useDesignerDraft(store);

  // Teardown for an in-flight drag gesture (document listeners + cursor + move
  // state). Set only while a gesture is active so a plain click stays zero-cost;
  // the unmount effect runs it if this node is removed mid-drag (e.g. deleted by
  // a collaborator) — otherwise the listeners, `cursor: "move"`, and an active
  // `move` state would all leak.
  const activeGestureCleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      activeGestureCleanupRef.current?.();
      activeGestureCleanupRef.current = null;
    },
    [],
  );

  // Helper to check if this node can be interacted with at the current selection level
  const canInteract = () => {
    const state = store.getState();
    const documentRoot = documentRootFromSnapshot(state.mimic.snapshot);
    const selectedNodeIds = selectedNodeIdsFromPresence(state.mimic.presence?.self);
    return canSelectNode(documentRoot, nodeId, selectedNodeIds);
  };

  /**
   * Whether `node` is a draggable node type (view, scrollView or text) whose
   * effective style is absolutely positioned. All carry `position`/`left`/`top`
   * and are state-capable, so `resolveEffectiveStyle` reads them uniformly.
   */
  const isAbsolutePositioned = (node: SnapshotNode | null | undefined, id: string): boolean => {
    if (!node || (node.type !== "view" && node.type !== "scrollView" && node.type !== "text")) {
      return false;
    }
    const selectedStateId = getSelectedStateIdForNode(store.getState().stateOverrideSelection, id);
    return resolveEffectiveStyle(node, selectedStateId)["position"] === "absolute";
  };

  /** Whether this node is an absolutely positioned draggable (view or text) node. */
  const isAbsoluteDraggableNode = () => {
    const state = store.getState();
    const root = documentRootFromSnapshot(state.mimic.snapshot);
    return isAbsolutePositioned(findNodeById<SnapshotNode>(root, nodeId), nodeId);
  };

  /**
   * The absolutely positioned view/text nodes that should move together: every
   * selected absolute node, always including the pressed node. A node whose
   * selected ancestor is also a target is dropped — moving the ancestor already
   * shifts it, so keeping it would apply the drag delta twice.
   */
  const collectMoveTargets = () => {
    const state = store.getState();
    const root = documentRootFromSnapshot(state.mimic.snapshot);
    const selectedNodeIds = selectedNodeIdsFromPresence(state.mimic.presence?.self);
    const ids = new Set(selectedNodeIds);
    ids.add(nodeId);

    const absoluteIds = [...ids].filter((id) =>
      isAbsolutePositioned(findNodeById<SnapshotNode>(root, id), id),
    );

    return excludeNestedNodes(root, absoluteIds);
  };

  const dispatchClick = (shiftKey: boolean) => {
    dispatch(nodeClicked)({ id: nodeId, shiftKey });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle if node can be selected at current level
    if (!canInteract()) {
      return; // Let event bubble to parent
    }
    e.stopPropagation();

    // Non-primary buttons (context menu etc.) keep click semantics only.
    // Non-absolute nodes are not draggable — behave exactly as before.
    if (e.button !== 0 || !isAbsoluteDraggableNode()) {
      dispatchClick(e.shiftKey);
      return;
    }

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const shiftKey = e.shiftKey;
    let dragging = false;

    // Removes the document listeners + restores the cursor, and clears the
    // unmount hook (so a later unmount does not re-run a finished gesture).
    const cleanup = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.cursor = "";
      activeGestureCleanupRef.current = null;
    };

    // Runs on unmount MID-DRAG: tears down the gesture and, if a move is still
    // in flight, cancels it (resetting `move.isActive`) and discards its draft —
    // `cleanup` alone would leave the move state active.
    const cancelActiveGesture = () => {
      const wasDragging = dragging;
      cleanup();
      if (wasDragging) {
        dispatch(cancelMove)({});
        discardDraft();
      }
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging) {
        const dx = moveEvent.clientX - startClientX;
        const dy = moveEvent.clientY - startClientY;
        if (Math.hypot(dx, dy) < MOVE_DRAG_THRESHOLD) {
          return;
        }
        // Threshold crossed: select the pressed node (unless it is part of a
        // multi-selection being dragged), then begin the draft-backed move.
        if (!isSelected) {
          dispatchClick(shiftKey);
        }
        const nodeIds = collectMoveTargets();
        if (nodeIds.length === 0) {
          cleanup();
          return;
        }
        beginDraft();
        dispatch(startMove)({
          nodeIds,
          screenPoint: { x: startClientX, y: startClientY },
        });
        document.body.style.cursor = "move";
        dragging = true;
        // Now that a draft-backed move is live, an unmount must tear it down.
        activeGestureCleanupRef.current = cancelActiveGesture;
      }
      dispatch(updateMove)({ screenPoint: { x: moveEvent.clientX, y: moveEvent.clientY } });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      // Only the primary button ends the drag; a secondary/middle release must
      // not commit a move mid-gesture.
      if (upEvent.button !== 0) {
        return;
      }
      cleanup();
      if (!dragging) {
        // No drag occurred — treat as a plain click (select / drill parent).
        dispatchClick(shiftKey);
        return;
      }
      // Commit the draft BEFORE endMove: while a draft is active the commander
      // skips undo recording, so endMove must run draft-free to land its single
      // undo entry on the stack (mirrors endResize).
      commitDraft();
      dispatch(endMove)({ screenPoint: { x: upEvent.clientX, y: upEvent.clientY } });
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape" && dragging) {
        cleanup();
        dispatch(cancelMove)({});
        discardDraft();
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    // Before the threshold is crossed the only in-flight resource is these
    // listeners; register a teardown so an unmount during the press removes
    // them (the pre-drag path has no move/draft to cancel yet).
    activeGestureCleanupRef.current = cancelActiveGesture;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only handle double-click if node can be selected at current level
    if (!canInteract()) {
      return; // Let event bubble to parent
    }
    e.stopPropagation();
    // Convert screen coordinates to canvas coordinates for drill-down
    const canvasCoords = viewport.screenToCanvas(e.clientX, e.clientY);
    dispatch(nodeDoubleClicked)({
      id: nodeId,
      canvasX: canvasCoords.x,
      canvasY: canvasCoords.y,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only handle context menu if node can be selected at current level
    if (!canInteract()) {
      return; // Let event bubble to parent
    }
    e.stopPropagation();

    // Auto-select node if not already selected (standard UX pattern)
    if (!isSelected) {
      dispatch(selectNode)({ id: nodeId, many: false });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const result = dispatch(nodeMouseEnter)({ id: nodeId }) as
      | { shouldPropagate?: boolean }
      | undefined;
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseOver = (e: React.MouseEvent) => {
    const result = dispatch(nodeMouseOver)({ id: nodeId }) as
      | { shouldPropagate?: boolean }
      | undefined;
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(nodeMouseLeave)({ id: nodeId });
  };

  return (
    <DesignerContextMenu nodeId={nodeId} source="canvas">
      {children({
        onContextMenu: handleContextMenu,
        onDoubleClick: handleDoubleClick,
        onMouseDown: handleMouseDown,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onMouseOver: handleMouseOver,
        role: "button",
      })}
    </DesignerContextMenu>
  );
}
