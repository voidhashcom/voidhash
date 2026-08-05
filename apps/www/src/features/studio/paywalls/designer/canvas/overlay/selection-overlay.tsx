"use client";

import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { Application, Graphics } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { CANVAS_DEFAULTS } from "../../constants";
import {
  cancelResize,
  endResize,
  startResize,
  updateResize,
} from "../../state/actions/resize-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type { DesignerStoreState, ResizeHandle } from "../../state/designer-store-state";
import type { BoundingBox } from "../../state/utils/bounding-box";
import { calculateCombinedBoundingBox } from "../../state/utils/bounding-box";
import { documentRootFromSnapshot } from "../../state/utils/document-root";
import { selectedNodeIdsFromPresence } from "../../state/utils/presence";
import { getChildrenIds } from "../../state/utils/selection-level";

// ============================================================================
// Types
// ============================================================================

interface SelectionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// =============================================================================
// Transform Handle Constants
// =============================================================================

const HANDLE_SIZE = 8;
const HANDLE_COLOR = CANVAS_DEFAULTS.PRIMARY_COLOR;
const HANDLE_FILL = 0xff_ff_ff;
const HIT_AREA_PADDING = 4;
const EDGE_HIT_THICKNESS = 8;

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  e: "ew-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  s: "ns-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalize selection rectangle (handle negative dimensions from dragging in any direction).
 */
function normalizeRect(
  start: Point,
  end: Point,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { height, width, x, y };
}

/**
 * Draw a dashed line using Pixi.js Graphics.
 */
function drawDashedLine(
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  strokeWidth: number,
  dashLength: number,
  gapLength: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    return;
  }
  const unitX = dx / length;
  const unitY = dy / length;

  let currentLength = 0;
  let drawing = true;

  while (currentLength < length) {
    const segmentLength = drawing ? dashLength : gapLength;
    const endLength = Math.min(currentLength + segmentLength, length);

    if (drawing) {
      const startX = x1 + unitX * currentLength;
      const startY = y1 + unitY * currentLength;
      const endX = x1 + unitX * endLength;
      const endY = y1 + unitY * endLength;

      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
      graphics.stroke({ color, width: strokeWidth });
    }

    currentLength = endLength;
    drawing = !drawing;
  }
}

/**
 * Draw a dashed rectangle using Pixi.js Graphics.
 */
function drawDashedRect(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  strokeWidth: number,
  dashLength: number = 4,
  gapLength: number = 4,
): void {
  // Draw each edge as dashed line
  drawDashedLine(graphics, x, y, x + width, y, color, strokeWidth, dashLength, gapLength);
  drawDashedLine(
    graphics,
    x + width,
    y,
    x + width,
    y + height,
    color,
    strokeWidth,
    dashLength,
    gapLength,
  );
  drawDashedLine(
    graphics,
    x + width,
    y + height,
    x,
    y + height,
    color,
    strokeWidth,
    dashLength,
    gapLength,
  );
  drawDashedLine(graphics, x, y + height, x, y, color, strokeWidth, dashLength, gapLength);
}

/**
 * Draw transform handles (only corners) on the combined selection box.
 */
function drawTransformHandles(
  graphics: Graphics,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
): void {
  const half = HANDLE_SIZE / 2;

  // Corner handles (squares) - 2D scaling
  const corners = [
    { x: screenX, y: screenY },
    { x: screenX + screenW, y: screenY },
    { x: screenX, y: screenY + screenH },
    { x: screenX + screenW, y: screenY + screenH },
  ];

  for (const corner of corners) {
    graphics.rect(corner.x - half, corner.y - half, HANDLE_SIZE, HANDLE_SIZE);
    graphics.fill({ color: HANDLE_FILL });
    graphics.stroke({ color: HANDLE_COLOR, width: 1.5 });
  }
}

/**
 * Calculate handle positions for DOM hit areas.
 * Corner handles are small squares, edge handles are full-length thin strips.
 */
function calculateHandlePositions(
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
): HandlePosition[] {
  const cornerHitSize = HANDLE_SIZE + HIT_AREA_PADDING * 2;
  const edgeInset = cornerHitSize / 2;

  return [
    // Corner handles (small squares)
    {
      handle: "nw",
      height: cornerHitSize,
      width: cornerHitSize,
      x: screenX,
      y: screenY,
    },
    {
      handle: "ne",
      height: cornerHitSize,
      width: cornerHitSize,
      x: screenX + screenW,
      y: screenY,
    },
    {
      handle: "sw",
      height: cornerHitSize,
      width: cornerHitSize,
      x: screenX,
      y: screenY + screenH,
    },
    {
      handle: "se",
      height: cornerHitSize,
      width: cornerHitSize,
      x: screenX + screenW,
      y: screenY + screenH,
    },
    // Edge handles (full-length thin strips, inset to not overlap corners)
    {
      handle: "n",
      height: EDGE_HIT_THICKNESS,
      width: screenW - edgeInset * 2,
      x: screenX + screenW / 2,
      y: screenY,
    },
    {
      handle: "s",
      height: EDGE_HIT_THICKNESS,
      width: screenW - edgeInset * 2,
      x: screenX + screenW / 2,
      y: screenY + screenH,
    },
    {
      handle: "w",
      height: screenH - edgeInset * 2,
      width: EDGE_HIT_THICKNESS,
      x: screenX,
      y: screenY + screenH / 2,
    },
    {
      handle: "e",
      height: screenH - edgeInset * 2,
      width: EDGE_HIT_THICKNESS,
      x: screenX + screenW,
      y: screenY + screenH / 2,
    },
  ];
}

// ============================================================================
// Selection Overlay Component
// ============================================================================

interface SelectionOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function SelectionOverlay({ containerRef }: SelectionOverlayProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  // Track initialization state
  const isInitializedRef = useRef(false);

  // State for handle positions (for DOM hit areas)
  const [handlePositions, setHandlePositions] = useState<HandlePosition[]>([]);
  const [showHandles, setShowHandles] = useState(false);

  // Draw function that reads directly from store - use ref to avoid stale closures
  // Initial no-op function for ref
  const drawRef = useRef<() => void>(() => {});

  // Update drawRef to always have the latest implementation
  drawRef.current = () => {
    const graphics = graphicsRef.current;
    if (!graphics) {
      return;
    }
    if (!isInitializedRef.current) {
      return;
    }

    graphics.clear();

    // Draw selections
    const state = store.getState() as DesignerStoreState;
    const selectedNodeIds = selectedNodeIdsFromPresence(state.mimic.presence?.self);
    const previewSelectedNodeIds = state.dragSelect.previewSelectedNodeIds ?? [];
    const { canvas, highlightedNodeId } = state;
    const { boundingBoxes } = canvas;
    const { x: panX, y: panY, scale } = canvas;

    // Build selection boxes from both confirmed and preview selections
    // Use a Set to avoid duplicates
    const allSelectedIds = new Set([...selectedNodeIds, ...previewSelectedNodeIds]);
    const boxes: SelectionBox[] = [];

    for (const nodeId of allSelectedIds) {
      const box = boundingBoxes[nodeId];
      if (box) {
        boxes.push({ id: nodeId, ...box });
      }
    }

    // Selection style - constant screen-space thickness
    const strokeWidth = 1.5;
    const strokeColor = CANVAS_DEFAULTS.PRIMARY_COLOR;

    for (const box of boxes) {
      // Convert canvas coordinates to screen coordinates
      const screenX = box.x * scale + panX;
      const screenY = box.y * scale + panY;
      const screenWidth = box.width * scale;
      const screenHeight = box.height * scale;

      graphics.rect(screenX, screenY, screenWidth, screenHeight);
      graphics.stroke({ color: strokeColor, width: strokeWidth });
    }

    // Draw drag selection rectangle if active
    const { dragSelect, textEditingNodeId } = state;
    const isTextEditingMode = textEditingNodeId !== null;

    // Draw node highlight (disabled during drag selection and if node is already selected)
    const isHighlightedNodeSelected = allSelectedIds.has(highlightedNodeId ?? "");
    if (highlightedNodeId && !dragSelect.isActive && !isHighlightedNodeSelected) {
      const box = boundingBoxes[highlightedNodeId] ?? null;
      if (box) {
        const highlightStrokeWidth = 2;
        const screenX = box.x * scale + panX;
        const screenY = box.y * scale + panY;
        const screenWidth = box.width * scale;
        const screenHeight = box.height * scale;

        if (isTextEditingMode) {
          // Dotted rectangle during text editing mode
          drawDashedRect(
            graphics,
            screenX,
            screenY,
            screenWidth,
            screenHeight,
            strokeColor,
            highlightStrokeWidth,
          );
        } else {
          // Solid rectangle normally
          graphics.rect(screenX, screenY, screenWidth, screenHeight);
          graphics.stroke({ color: strokeColor, width: highlightStrokeWidth });
        }
      }

      // Draw dotted rectangles around direct children of the highlighted node
      const snapshot = documentRootFromSnapshot(state.mimic.snapshot);
      const childrenIds = getChildrenIds(snapshot, highlightedNodeId);
      const childStrokeWidth = 1.5;

      for (const childId of childrenIds) {
        const childBox = boundingBoxes[childId];
        if (childBox) {
          const childScreenX = childBox.x * scale + panX;
          const childScreenY = childBox.y * scale + panY;
          const childScreenWidth = childBox.width * scale;
          const childScreenHeight = childBox.height * scale;

          drawDashedRect(
            graphics,
            childScreenX,
            childScreenY,
            childScreenWidth,
            childScreenHeight,
            strokeColor,
            childStrokeWidth,
            4,
            4,
          );
        }
      }
    }
    if (dragSelect.isActive && dragSelect.startPoint && dragSelect.currentPoint) {
      const selectionRect = normalizeRect(dragSelect.startPoint, dragSelect.currentPoint);

      // Convert canvas coordinates to screen coordinates
      const screenX = selectionRect.x * scale + panX;
      const screenY = selectionRect.y * scale + panY;
      const screenWidth = selectionRect.width * scale;
      const screenHeight = selectionRect.height * scale;

      // Draw selection rectangle with semi-transparent fill and border
      graphics.rect(screenX, screenY, screenWidth, screenHeight);
      graphics.fill({ alpha: 0.1, color: strokeColor });
      graphics.stroke({ alpha: 0.8, color: strokeColor, width: 1 });
    }

    // Draw combined selection rectangle when multiple nodes are selected
    if (selectedNodeIds.length > 1) {
      const combinedBounds = calculateCombinedBoundingBox([...selectedNodeIds], boundingBoxes);
      if (combinedBounds) {
        const screenX = combinedBounds.x * scale + panX;
        const screenY = combinedBounds.y * scale + panY;
        const screenWidth = combinedBounds.width * scale;
        const screenHeight = combinedBounds.height * scale;

        graphics.rect(screenX, screenY, screenWidth, screenHeight);
        graphics.stroke({ color: strokeColor, width: strokeWidth });
      }
    }

    // Draw transform handles if there are selected nodes and not in text editing mode
    // Show handles even during resize (visual feedback), but hide hit areas during resize
    const shouldDrawHandles =
      selectedNodeIds.length > 0 && !isTextEditingMode && !dragSelect.isActive;

    // Only show hit areas when not actively resizing
    const shouldShowHitAreas = shouldDrawHandles && !state.resize.isActive;

    if (shouldDrawHandles) {
      const combinedBounds = calculateCombinedBoundingBox([...selectedNodeIds], boundingBoxes);

      if (combinedBounds) {
        const handleScreenX = combinedBounds.x * scale + panX;
        const handleScreenY = combinedBounds.y * scale + panY;
        const handleScreenW = combinedBounds.width * scale;
        const handleScreenH = combinedBounds.height * scale;

        drawTransformHandles(graphics, handleScreenX, handleScreenY, handleScreenW, handleScreenH);

        if (shouldShowHitAreas) {
          // Update handle positions for DOM hit areas
          const positions = calculateHandlePositions(
            handleScreenX,
            handleScreenY,
            handleScreenW,
            handleScreenH,
          );
          setHandlePositions(positions);
          setShowHandles(true);
        } else {
          setShowHandles(false);
        }
      } else {
        setShowHandles(false);
      }
    } else {
      setShowHandles(false);
    }
  };

  // Stable draw function that delegates to ref
  const draw = useCallback(() => {
    drawRef.current();
  }, []);

  // Initialize Pixi Application - only depends on containerRef
  useEffect(() => {
    const container = canvasRef.current;
    const resizeTarget = containerRef.current;
    if (!container) {
      return;
    }

    const app = new Application();
    let mounted = true;

    const initApp = async () => {
      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resizeTo: resizeTarget ?? undefined,
        resolution: typeof window !== "undefined" ? window.devicePixelRatio : 1,
      });

      // Check if component was unmounted during async init
      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      // Add canvas to DOM
      container.append(app.canvas);

      // Create graphics for drawing selections
      const graphics = new Graphics();
      app.stage.addChild(graphics);

      appRef.current = app;
      graphicsRef.current = graphics;
      isInitializedRef.current = true;

      // Initial draw after initialization
      draw();
    };

    initApp();

    return () => {
      mounted = false;
      isInitializedRef.current = false;
      // Cleanup
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        graphicsRef.current = null;
      }
    };
  }, [containerRef, draw]);

  // Subscribe to state changes that affect selection rendering
  useEffect(() => {
    // Subscribe to all state changes - the draw function will read what it needs
    const unsubscribe = store.subscribe(() => draw());

    return () => {
      unsubscribe();
    };
  }, [store, draw]);

  // Refs for handle elements to attach non-passive wheel listeners
  const handleRefs = useRef<Map<ResizeHandle, HTMLDivElement>>(new Map());

  // Set up non-passive wheel listeners on handle elements
  useEffect(() => {
    const container = containerRef.current;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom
      e.preventDefault();
      e.stopPropagation();

      // Re-dispatch wheel event to the canvas container so zoom gestures work
      if (container) {
        const wheelEvent = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          deltaMode: e.deltaMode,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
        });
        container.dispatchEvent(wheelEvent);
      }
    };

    // Add non-passive wheel listeners to all handle elements
    const refs = handleRefs.current;
    for (const el of refs.values()) {
      el.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      for (const el of refs.values()) {
        el.removeEventListener("wheel", handleWheel);
      }
    };
  }, [containerRef, showHandles, handlePositions]);

  // Draft management for optimistic resize preview
  const { begin: beginDraft, commit: commitDraft, discard: discardDraft } = useDesignerDraft(store);

  // Handle mouse down on a resize handle
  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();

      // Begin draft for optimistic preview
      beginDraft();

      dispatch(startResize)({
        handle,
        screenPoint: { x: e.clientX, y: e.clientY },
      });

      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("keydown", onKeyDown);
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        dispatch(updateResize)({
          maintainAspectRatio: moveEvent.shiftKey,
          screenPoint: { x: moveEvent.clientX, y: moveEvent.clientY },
        });
      };

      const onMouseUp = () => {
        // Commit the draft BEFORE dispatching endResize: while a draft is
        // active the commander skips undo recording (hasDraft guard), and
        // endResize writes its normalization through the live document
        // transaction anyway, so it must run draft-free to land on the undo
        // stack.
        commitDraft();
        dispatch(endResize)({});
        cleanup();
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          dispatch(cancelResize)({});
          discardDraft();
          cleanup();
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("keydown", onKeyDown);
    },
    [dispatch, beginDraft, commitDraft, discardDraft],
  );

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        ref={canvasRef}
        style={{ zIndex: 10 }}
      />
      {showHandles && (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 11 }}>
          {handlePositions.map((pos) => (
            <div
              key={pos.handle}
              ref={(el) => {
                if (el) {
                  handleRefs.current.set(pos.handle, el);
                } else {
                  handleRefs.current.delete(pos.handle);
                }
              }}
              style={{
                cursor: HANDLE_CURSORS[pos.handle],
                height: pos.height,
                left: pos.x - pos.width / 2,
                pointerEvents: "auto",
                position: "absolute",
                top: pos.y - pos.height / 2,
                width: pos.width,
              }}
              onMouseDown={(e) => onHandleMouseDown(e, pos.handle)}
            />
          ))}
        </div>
      )}
    </>
  );
}
