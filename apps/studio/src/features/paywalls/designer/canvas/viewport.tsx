"use client";

import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { CANVAS_DEFAULTS, INIT_SCREEN_DATA } from "../constants";

// ============================================================================
// Types
// ============================================================================

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

interface ViewportContextValue {
  /**
   * Convert a point from screen/viewport coordinates to canvas coordinates
   */
  screenToCanvas: (
    screenX: number,
    screenY: number
  ) => { x: number; y: number };
  /**
   * Convert a point from canvas coordinates to screen/viewport coordinates
   */
  canvasToScreen: (
    canvasX: number,
    canvasY: number
  ) => { x: number; y: number };
  /**
   * Get the current viewport transform (for reading purposes)
   */
  getTransform: () => ViewportTransform;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

// ============================================================================
// Viewport Component
// ============================================================================

export type ViewportProps = PropsWithChildren<{
  onTransformChange?: (transform: ViewportTransform) => void;
}>;

export function Viewport({ children, onTransformChange }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Store transform in ref to avoid re-renders during pan/zoom
  const transformRef = useRef<ViewportTransform>({
    scale: 0.8,
    x: 0,
    y: 0, // Start at 80% zoom (matching pixi-viewport's zoomPercent(-0.2))
  });

  // Touch tracking for pinch gestures
  const touchStateRef = useRef<{
    initialDistance: number;
    initialScale: number;
    initialMidpoint: { x: number; y: number };
    lastMidpoint: { x: number; y: number };
  } | null>(null);

  // Apply transform to DOM element
  const applyTransform = useCallback(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const { x, y, scale } = transformRef.current;
    onTransformChange?.({ scale, x, y });
    content.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`;
  }, [onTransformChange]);

  // Calculate initial position to center the screen
  const initializePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { scale } = transformRef.current;
    const containerRect = container.getBoundingClientRect();

    // Center the initial screen in the viewport
    const scaledScreenWidth = INIT_SCREEN_DATA.width * scale;
    const scaledScreenHeight = INIT_SCREEN_DATA.height * scale;

    transformRef.current.x =
      (containerRect.width - scaledScreenWidth) / 2 -
      INIT_SCREEN_DATA.x * scale;
    transformRef.current.y =
      (containerRect.height - scaledScreenHeight) / 2 -
      INIT_SCREEN_DATA.y * scale;

    applyTransform();
  }, [applyTransform]);

  // Initialize position on mount
  useLayoutEffect(() => {
    initializePosition();
  }, [initializePosition]);

  // Zoom towards a specific point
  const zoomAtPoint = useCallback(
    (newScale: number, pointX: number, pointY: number) => {
      const { x, y, scale } = transformRef.current;

      // Clamp scale to min/max
      const clampedScale = Math.min(
        Math.max(newScale, CANVAS_DEFAULTS.MIN_ZOOM),
        CANVAS_DEFAULTS.MAX_ZOOM
      );

      if (clampedScale === scale) {
        return;
      }

      // Zoom towards the point: adjust position so the point stays in the same place
      const scaleRatio = clampedScale / scale;
      transformRef.current = {
        scale: clampedScale,
        x: pointX - (pointX - x) * scaleRatio,
        y: pointY - (pointY - y) * scaleRatio,
      };

      applyTransform();
    },
    [applyTransform]
  );

  // Pan by delta
  const pan = useCallback(
    (deltaX: number, deltaY: number) => {
      transformRef.current.x -= deltaX;
      transformRef.current.y -= deltaY;
      applyTransform();
    },
    [applyTransform]
  );

  // Wheel handler for trackpad pan and pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Trackpad pinch gesture sets ctrlKey to true
      if (e.ctrlKey) {
        // Pinch-to-zoom
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // deltaY is negative when zooming in (pinch out), positive when zooming out
        // Apply smooth zoom factor
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newScale = transformRef.current.scale * zoomFactor;

        zoomAtPoint(newScale, mouseX, mouseY);
      } else {
        // Trackpad pan
        pan(e.deltaX, e.deltaY);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [pan, zoomAtPoint]);

  // Touch handlers for pinch-to-zoom and two-finger pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const getDistance = (touch1: Touch, touch2: Touch) => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.hypot(dx, dy);
    };

    const getMidpoint = (touch1: Touch, touch2: Touch) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        return;
      }
      e.preventDefault();
      const touch1 = e.touches.item(0);
      const touch2 = e.touches.item(1);
      if (!touch1) {
        return;
      }
      if (!touch2) {
        return;
      }
      const midpoint = getMidpoint(touch1, touch2);

      touchStateRef.current = {
        initialDistance: getDistance(touch1, touch2),
        initialMidpoint: midpoint,
        initialScale: transformRef.current.scale,
        lastMidpoint: midpoint,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        return;
      }
      if (!touchStateRef.current) {
        return;
      }
      e.preventDefault();

      const touch1 = e.touches.item(0);
      const touch2 = e.touches.item(1);
      if (!touch1) {
        return;
      }
      if (!touch2) {
        return;
      }
      const currentDistance = getDistance(touch1, touch2);
      const currentMidpoint = getMidpoint(touch1, touch2);

      const { initialDistance, initialScale, lastMidpoint } =
        touchStateRef.current;

      // Calculate new scale from pinch
      const scaleRatio = currentDistance / initialDistance;
      const newScale = initialScale * scaleRatio;

      // Apply zoom at the current midpoint
      zoomAtPoint(newScale, currentMidpoint.x, currentMidpoint.y);

      // Apply pan from midpoint movement
      const panDeltaX = lastMidpoint.x - currentMidpoint.x;
      const panDeltaY = lastMidpoint.y - currentMidpoint.y;
      pan(panDeltaX, panDeltaY);

      touchStateRef.current.lastMidpoint = currentMidpoint;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchStateRef.current = null;
      }
    };

    // Prevent iOS gesture zoom
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);
    container.addEventListener("gesturestart", handleGestureStart);
    container.addEventListener("gesturechange", handleGestureChange);
    container.addEventListener("gestureend", handleGestureEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [pan, zoomAtPoint]);

  // Coordinate conversion functions
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const container = containerRef.current;
      if (!container) {
        return { x: 0, y: 0 };
      }

      const rect = container.getBoundingClientRect();
      const { x, y, scale } = transformRef.current;

      // Convert from screen coordinates to canvas coordinates
      const relativeX = screenX - rect.left;
      const relativeY = screenY - rect.top;

      return {
        x: (relativeX - x) / scale,
        y: (relativeY - y) / scale,
      };
    },
    []
  );

  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } => {
      const container = containerRef.current;
      if (!container) {
        return { x: 0, y: 0 };
      }

      const rect = container.getBoundingClientRect();
      const { x, y, scale } = transformRef.current;

      // Convert from canvas coordinates to screen coordinates
      return {
        x: canvasX * scale + x + rect.left,
        y: canvasY * scale + y + rect.top,
      };
    },
    []
  );

  const getTransform = useCallback(() => ({ ...transformRef.current }), []);

  const contextValue: ViewportContextValue = {
    canvasToScreen,
    getTransform,
    screenToCanvas,
  };

  return (
    <ViewportContext.Provider value={contextValue}>
      <div
        className="absolute inset-0 overflow-hidden"
        ref={containerRef}
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute origin-top-left"
          ref={contentRef}
          style={{
            // Will be updated via JS for performance
            transform: "matrix(1, 0, 0, 1, 0, 0)",
            willChange: "transform",
          }}
        >
          {children}
        </div>
      </div>
    </ViewportContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access viewport coordinate conversion functions.
 * Does NOT cause re-renders when the viewport transforms - use for event handlers
 * that need to convert coordinates.
 */
export function useViewport() {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error("useViewport must be used within a Viewport");
  }
  return context;
}
