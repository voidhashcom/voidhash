'use client';

import { Application, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef } from 'react';
import { CANVAS_DEFAULTS } from '../../constants';
import { useDesignerStore } from '../../state/designer-store';

// ============================================================================
// Types
// ============================================================================

type SelectionBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// ============================================================================
// Selection Overlay Component
// ============================================================================

type SelectionOverlayProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function SelectionOverlay({ containerRef }: SelectionOverlayProps) {
  const store = useDesignerStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);

  // Draw function using refs - stable reference
  const drawSelections = useCallback(
    (graphics: Graphics) => {
      const state = store.zustand.getState();
      const { selectedNodeIds, nodes, canvas } = state;
      const { boundingBoxes } = canvas;
      const { x: panX, y: panY, scale } = canvas;

      // Build selection boxes from selected nodes
      const boxes: SelectionBox[] = [];
      for (const nodeId of selectedNodeIds) {
        const node = nodes[nodeId];
        if (!node) {
          continue;
        }

        const box = boundingBoxes[nodeId];
        if (box) {
          boxes.push({ id: nodeId, ...box });
        }
      }

      // Selection style - constant screen-space thickness
      const strokeWidth = 1;
      const strokeColor = CANVAS_DEFAULTS.PRIMARY_COLOR;

      for (const box of boxes) {
        // Convert canvas coordinates to screen coordinates
        const screenX = box.x * scale + panX;
        const screenY = box.y * scale + panY;
        const screenWidth = box.width * scale;
        const screenHeight = box.height * scale;

        graphics.rect(screenX, screenY, screenWidth, screenHeight);
        graphics.stroke({ width: strokeWidth, color: strokeColor });
      }
    },
    [store]
  );

  const drawNodeHighlight = useCallback(
    (graphics: Graphics) => {
      const state = store.zustand.getState();
      const { highlightedNodeId, nodes, canvas } = state;
      const { boundingBoxes } = canvas;
      const { x: panX, y: panY, scale } = canvas;

      if (!highlightedNodeId) {
        return;
      }

      const node = nodes[highlightedNodeId];
      if (!node) {
        return;
      }

      const box = boundingBoxes[highlightedNodeId] ?? null;
      if (!box) {
        return;
      }

      // Selection style - constant screen-space thickness
      const strokeWidth = 2;
      const strokeColor = CANVAS_DEFAULTS.PRIMARY_COLOR;

      // Convert canvas coordinates to screen coordinates
      const screenX = box.x * scale + panX;
      const screenY = box.y * scale + panY;
      const screenWidth = box.width * scale;
      const screenHeight = box.height * scale;

      graphics.rect(screenX, screenY, screenWidth, screenHeight);
      graphics.stroke({ width: strokeWidth, color: strokeColor });
    },
    [store]
  );

  const draw = useCallback(() => {
    const graphics = graphicsRef.current;
    if (!graphics) {
      return;
    }

    graphics.clear();

    drawSelections(graphics);
    drawNodeHighlight(graphics);
  }, [drawSelections, drawNodeHighlight]);

  // Initialize Pixi Application
  useEffect(() => {
    const container = canvasRef.current;
    const resizeTarget = containerRef.current;
    if (!container) {
      return;
    }

    const app = new Application();

    const initApp = async () => {
      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resizeTo: resizeTarget ?? undefined,
        resolution: typeof window !== 'undefined' ? window.devicePixelRatio : 1
      });

      // Add canvas to DOM
      container.appendChild(app.canvas);

      // Create graphics for drawing selections
      const graphics = new Graphics();
      app.stage.addChild(graphics);

      appRef.current = app;
      graphicsRef.current = graphics;

      // Initial draw
      draw();
    };

    initApp();

    return () => {
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
    // Subscribe to selectedNodeIds changes
    const unsubscribeSelection = store.zustand.subscribe(
      (state) => state.selectedNodeIds,
      () => draw()
    );

    const unsubscribeHighlightedNodeId = store.zustand.subscribe(
      (state) => state.highlightedNodeId,
      () => draw()
    );

    // Subscribe to boundingBoxes changes
    const unsubscribeBoundingBoxes = store.zustand.subscribe(
      (state) => state.canvas.boundingBoxes,
      () => draw()
    );

    // Subscribe to canvas transform changes (pan/zoom)
    const unsubscribeCanvas = store.zustand.subscribe(
      (state) => ({
        x: state.canvas.x,
        y: state.canvas.y,
        scale: state.canvas.scale
      }),
      () => draw(),
      {
        equalityFn: (a, b) => a.x === b.x && a.y === b.y && a.scale === b.scale
      }
    );

    // Subscribe to nodes changes (for when node properties change)
    const unsubscribeNodes = store.zustand.subscribe(
      (state) => state.nodes,
      () => draw()
    );

    return () => {
      unsubscribeSelection();
      unsubscribeHighlightedNodeId();
      unsubscribeBoundingBoxes();
      unsubscribeCanvas();
      unsubscribeNodes();
    };
  }, [store, draw]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      ref={canvasRef}
      style={{ zIndex: 10 }}
    />
  );
}
