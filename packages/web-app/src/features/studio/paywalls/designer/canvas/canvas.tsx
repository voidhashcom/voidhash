"use client";

import { useCallback, useEffect, useRef } from "react";

import { DesignerContextMenu } from "../components/designer-context-menu";
import { CANVAS_DEFAULTS } from "../constants";
import {
  cancelDragSelect,
  clearHighlight,
  clearSelection,
  endDragSelect,
  saveCanvasState,
  startDragSelect,
  textEditingStopped,
  updateDragSelect,
} from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { BoundingBoxManagerProvider } from "./bounding-box-manager";
import { NodeTreeRenderer } from "./node-tree-renderer";
import { AgentWorkingOverlay } from "./overlay/agent-working-overlay";
import { GradientOverlay } from "./overlay/gradient-overlay";
import { SelectionOverlay } from "./overlay/selection-overlay";
import { WorkingIndicatorOverlay } from "./overlay/working-indicator-overlay";
import { useViewport, Viewport, type ViewportTransform } from "./viewport";

// Minimum distance in pixels to consider it a drag vs click
const DRAG_THRESHOLD = 5;

/**
 * Canvas background component that handles drag-to-select.
 * Must be inside Viewport to use the viewport context.
 */
function CanvasBackground() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const viewport = useViewport();
  const isDraggingRef = useRef(false);
  const startScreenPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const handleMouseEnter = () => {
    // Clear highlight when entering the canvas background (empty space)
    dispatch(clearHighlight)({});
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left mouse button and direct clicks on background
    if (e.button !== 0 || e.target !== e.currentTarget) {
      return;
    }

    e.preventDefault();

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startScreenPointRef.current = { x: e.clientX, y: e.clientY };

    // Convert screen coordinates to canvas coordinates
    const canvasPoint = viewport.screenToCanvas(e.clientX, e.clientY);

    dispatch(startDragSelect)({
      point: canvasPoint,
      shiftKey: e.shiftKey,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      // Check if we've exceeded the drag threshold
      if (!hasDraggedRef.current && startScreenPointRef.current) {
        const dx = e.clientX - startScreenPointRef.current.x;
        const dy = e.clientY - startScreenPointRef.current.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= DRAG_THRESHOLD) {
          hasDraggedRef.current = true;
        }
      }

      // Only update if we're actually dragging
      if (hasDraggedRef.current) {
        const canvasPoint = viewport.screenToCanvas(e.clientX, e.clientY);
        dispatch(updateDragSelect)({ point: canvasPoint });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      isDraggingRef.current = false;

      if (hasDraggedRef.current) {
        // Finish drag selection
        dispatch(endDragSelect)({});
      } else {
        // It was just a click on background, clear selection and exit text editing mode
        dispatch(cancelDragSelect)({});
        dispatch(textEditingStopped)({ id: "" });
        if (!e.shiftKey) {
          dispatch(clearSelection)({});
        }
      }

      startScreenPointRef.current = null;
      hasDraggedRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          hasDraggedRef.current = false;
          startScreenPointRef.current = null;
          dispatch(cancelDragSelect)({});
        } else {
          // Don't clear selection if exiting text editing mode
          // (text-node-renderer handles the Escape key and exits edit mode)
          const state = store.getState();
          if (!state.textEditingNodeId) {
            dispatch(clearSelection)({});
          }
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Use capture phase so this runs BEFORE text-node-renderer's handler
    // This allows us to check textEditingNodeId before it's cleared
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [viewport, dispatch, store]);

  return (
    <DesignerContextMenu source="canvas">
      <div
        aria-label="Canvas background"
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        role="button"
        tabIndex={0}
      />
    </DesignerContextMenu>
  );
}

export function Canvas() {
  const dispatch = usePaywallDesignerActions();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set overscroll-behavior on html and body to prevent overscroll navigation
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    const originalHtmlOverscrollX = htmlElement.style.overscrollBehaviorX;
    const originalBodyOverscrollX = bodyElement.style.overscrollBehaviorX;
    const originalHtmlOverscrollY = htmlElement.style.overscrollBehaviorY;
    const originalBodyOverscrollY = bodyElement.style.overscrollBehaviorY;

    htmlElement.style.overscrollBehaviorX = "none";
    bodyElement.style.overscrollBehaviorX = "none";
    htmlElement.style.overscrollBehaviorY = "none";
    bodyElement.style.overscrollBehaviorY = "none";

    return () => {
      htmlElement.style.overscrollBehaviorX = originalHtmlOverscrollX;
      bodyElement.style.overscrollBehaviorX = originalBodyOverscrollX;
      htmlElement.style.overscrollBehaviorY = originalHtmlOverscrollY;
      bodyElement.style.overscrollBehaviorY = originalBodyOverscrollY;
    };
  }, []);

  const handleTransformChange = useCallback(
    (newTransform: ViewportTransform) => {
      dispatch(saveCanvasState)({
        scale: newTransform.scale,
        x: newTransform.x,
        y: newTransform.y,
      });
    },
    [dispatch],
  );

  const handleMouseLeave = () => {
    // Clear highlight when mouse leaves the canvas area
    dispatch(clearHighlight)({});
  };

  return (
    <div
      className="absolute inset-0 h-full w-full overflow-hidden bg-sidebar"
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
    >
      <Viewport onTransformChange={handleTransformChange}>
        <BoundingBoxManagerProvider>
          <div
            className="absolute"
            style={{
              // Large canvas area for clicking to clear selection
              height: CANVAS_DEFAULTS.WORLD_HEIGHT,
              // Center the canvas so screens at (0,0) appear in the middle-ish
              left: -CANVAS_DEFAULTS.WORLD_WIDTH / 2,
              top: -CANVAS_DEFAULTS.WORLD_HEIGHT / 2,
              width: CANVAS_DEFAULTS.WORLD_WIDTH,
            }}
          >
            <CanvasBackground />
            <div
              style={{
                // Offset to place (0,0) at center of the world
                left: CANVAS_DEFAULTS.WORLD_WIDTH / 2,
                position: "absolute",
                top: CANVAS_DEFAULTS.WORLD_HEIGHT / 2,
              }}
            >
              <NodeTreeRenderer />
            </div>
          </div>
        </BoundingBoxManagerProvider>
      </Viewport>

      <WorkingIndicatorOverlay containerRef={containerRef} />

      {/* Pixi overlay for selection visualization */}
      <SelectionOverlay containerRef={containerRef} />

      {/* Gradient start/end point controls for the selected node */}
      <GradientOverlay containerRef={containerRef} />

      <AgentWorkingOverlay />
    </div>
  );
}
