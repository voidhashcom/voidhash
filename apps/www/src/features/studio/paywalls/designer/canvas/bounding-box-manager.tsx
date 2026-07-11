"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

import { updateBoundingBoxes } from "../state/actions";
import { usePaywallDesignerActions } from "../state/designer-store";
import { useViewport } from "./viewport";

// ============================================================================
// Types
// ============================================================================

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundingBoxManagerContextValue {
  registerElement: (nodeId: string, element: Element) => void;
  unregisterElement: (nodeId: string) => void;
}

const BoundingBoxManagerContext = createContext<BoundingBoxManagerContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

// Epsilon for floating point comparison to avoid jitter from subpixel rendering
const POSITION_EPSILON = 0.1;

function boxesEqual(a: BoundingBox | undefined, b: BoundingBox): boolean {
  if (!a) {
    return false;
  }
  return (
    Math.abs(a.x - b.x) < POSITION_EPSILON &&
    Math.abs(a.y - b.y) < POSITION_EPSILON &&
    Math.abs(a.width - b.width) < POSITION_EPSILON &&
    Math.abs(a.height - b.height) < POSITION_EPSILON
  );
}

// ============================================================================
// Provider Component
// ============================================================================

export function BoundingBoxManagerProvider({ children }: PropsWithChildren) {
  const dispatch = usePaywallDesignerActions();
  const viewport = useViewport();

  // Registry of elements keyed by node ID
  const elementsRef = useRef<Map<string, Element>>(new Map());

  // Cache of last known bounding boxes for change detection
  const cachedBoxesRef = useRef<Map<string, BoundingBox>>(new Map());

  // RAF loop ID
  const rafIdRef = useRef<number | null>(null);

  // Measure all registered elements and update store with changed values
  const measureAllElements = useCallback(() => {
    const transform = viewport.getTransform();
    const changedBoxes: Array<{ id: string; boundingBox: BoundingBox }> = [];

    for (const [nodeId, element] of elementsRef.current.entries()) {
      // Skip if element is not connected to DOM
      if (!element.isConnected) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const canvasCoords = viewport.screenToCanvas(rect.left, rect.top);
      const canvasWidth = rect.width / transform.scale;
      const canvasHeight = rect.height / transform.scale;

      const newBox: BoundingBox = {
        height: canvasHeight,
        width: canvasWidth,
        x: canvasCoords.x,
        y: canvasCoords.y,
      };

      const cached = cachedBoxesRef.current.get(nodeId);
      if (!boxesEqual(cached, newBox)) {
        changedBoxes.push({ boundingBox: newBox, id: nodeId });
        cachedBoxesRef.current.set(nodeId, newBox);
      }
    }

    if (changedBoxes.length > 0) {
      dispatch(updateBoundingBoxes)({ boxes: changedBoxes });
    }

    // Continue the loop
    rafIdRef.current = requestAnimationFrame(measureAllElements);
  }, [viewport, dispatch]);

  // Start/stop the RAF loop based on registered elements
  useEffect(() => {
    // Start the loop
    rafIdRef.current = requestAnimationFrame(measureAllElements);

    return () => {
      // Stop the loop on unmount
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [measureAllElements]);

  // Register an element for measurement
  const registerElement = useCallback((nodeId: string, element: Element) => {
    elementsRef.current.set(nodeId, element);
  }, []);

  // Unregister an element
  const unregisterElement = useCallback((nodeId: string) => {
    elementsRef.current.delete(nodeId);
    cachedBoxesRef.current.delete(nodeId);
  }, []);

  const contextValue: BoundingBoxManagerContextValue = {
    registerElement,
    unregisterElement,
  };

  return (
    <BoundingBoxManagerContext.Provider value={contextValue}>
      {children}
    </BoundingBoxManagerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useBoundingBoxManager() {
  const context = useContext(BoundingBoxManagerContext);
  if (!context) {
    throw new Error("useBoundingBoxManager must be used within a BoundingBoxManagerProvider");
  }
  return context;
}
