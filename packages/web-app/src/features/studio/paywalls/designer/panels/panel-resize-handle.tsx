"use client";

import { cn } from "@voidhash/ui";
import { useCallback, useRef } from "react";

interface PanelResizeHandleProps {
  /** Which edge of the panel the handle overlays; dragging away from the panel widens it. */
  edge: "left" | "right";
  label: string;
  /** Reads the panel's current width when a drag starts. */
  getWidth: () => number;
  /** Receives the proposed width on every pointer move; clamping is the owner's job. */
  onWidthChange: (width: number) => void;
  onDragStart?: () => void;
  /** Fires once when the drag ends — the place to persist the final width. */
  onDragEnd?: () => void;
}

/**
 * Invisible drag strip overlaying one edge of a floating designer panel.
 * Captures the pointer and translates horizontal movement into width updates
 * for the owning panel. Held in a ref so the move handler reads the drag
 * origin without re-subscribing.
 */
export function PanelResizeHandle({
  edge,
  label,
  getWidth,
  onWidthChange,
  onDragStart,
  onDragEnd,
}: PanelResizeHandleProps) {
  const dragOrigin = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragOrigin.current = { startX: event.clientX, startWidth: getWidth() };
      event.currentTarget.setPointerCapture(event.pointerId);
      onDragStart?.();
    },
    [getWidth, onDragStart],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOrigin.current;
      if (!origin) return;
      const delta = event.clientX - origin.startX;
      onWidthChange(origin.startWidth + (edge === "right" ? delta : -delta));
    },
    [edge, onWidthChange],
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragOrigin.current) return;
      dragOrigin.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      onDragEnd?.();
    },
    [onDragEnd],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={cn(
        "group absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none",
        edge === "right" ? "-right-1" : "-left-1",
      )}
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-primary" />
    </div>
  );
}
