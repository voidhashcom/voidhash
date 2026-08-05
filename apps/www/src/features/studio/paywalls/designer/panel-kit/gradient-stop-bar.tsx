"use client";

import { cn } from "@voidhash/ui";
import { useCallback, useEffect, useRef } from "react";

import { CheckerboardBackground } from "./color-picker/checkerboard-background";
import { interpolateRgba } from "./color-picker/color-utils";

export interface GradientStopBarStop {
  color: string;
  position: number;
}

export interface GradientStopBarProps {
  /** Logical gradient stops (unsorted); rendered sorted by position. */
  stops: GradientStopBarStop[];
  /** Index of the currently selected stop, or `null` when none is selected. */
  selectedIndex: number | null;
  /** Selects a stop (e.g. on marker mousedown or track add). */
  onSelect: (index: number) => void;
  /** Live position update for the stop at `index` (position clamped to `[0, 1]`). */
  onPositionChange: (index: number, position: number) => void;
  /**
   * Adds a stop at `position` with `color`. Returns nothing; the parent is
   * responsible for selecting the new stop if desired.
   */
  onAddStop: (position: number, color: string) => void;
  /** Called when a marker drag begins. Use for beginning a deferred edit. */
  onDragStart?: () => void;
  /** Called when a marker drag ends (mouse up). Use for committing the edit. */
  onDragEnd?: () => void;
  /** Called when a marker drag is cancelled (Escape). Use for discarding the edit. */
  onDiscard?: () => void;
  className?: string;
}

/** Builds a left→right CSS `linear-gradient` from stops sorted by position. */
function buildTrackGradient(stops: GradientStopBarStop[]): string {
  if (stops.length === 0) {
    return "transparent";
  }
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const segments = sorted.map(
    (stop) => `${stop.color} ${(Math.max(0, Math.min(1, stop.position)) * 100).toFixed(2)}%`,
  );
  return `linear-gradient(to right, ${segments.join(", ")})`;
}

/**
 * Interpolates the color for a stop inserted at `position` from the two nearest
 * neighbors in `stops` (linear blend of their rgba values). Falls back to the
 * single nearest stop's color when there is only one neighbor on either side.
 */
function colorAtPosition(stops: GradientStopBarStop[], position: number): string {
  if (stops.length === 0) {
    return "rgba(255, 255, 255, 1)";
  }
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const before = [...sorted].reverse().find((s) => s.position <= position);
  const after = sorted.find((s) => s.position >= position);
  if (before && after) {
    if (after.position === before.position) {
      return before.color;
    }
    const t = (position - before.position) / (after.position - before.position);
    return interpolateRgba(before.color, after.color, t);
  }
  return (before ?? after ?? sorted[0]!).color;
}

/**
 * Figma-style gradient preview track with draggable square stop markers over a
 * checkerboard. Dragging a marker updates its position live; clicking an empty
 * area of the track inserts a new stop with an interpolated color.
 *
 * The dragged stop is tracked by the index captured at drag start. Positions are
 * not reordered on write (only on add), so the index stays stable mid-drag.
 */
export function GradientStopBar({
  stops,
  selectedIndex,
  onSelect,
  onPositionChange,
  onAddStop,
  onDragStart,
  onDragEnd,
  onDiscard,
  className,
}: GradientStopBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingIndex = useRef<number | null>(null);

  const fractionFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return rect.width === 0 ? 0 : x / rect.width;
  }, []);

  const handleMarkerMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingIndex.current = index;
    onSelect(index);
    onDragStart?.();
  };

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    // Only reached when the target is the track itself (markers stop propagation).
    e.preventDefault();
    const position = fractionFromClientX(e.clientX);
    onAddStop(position, colorAtPosition(stops, position));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIndex.current !== null) {
        onPositionChange(draggingIndex.current, fractionFromClientX(e.clientX));
      }
    };

    const handleMouseUp = () => {
      if (draggingIndex.current !== null) {
        draggingIndex.current = null;
        onDragEnd?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && draggingIndex.current !== null) {
        draggingIndex.current = null;
        onDiscard?.();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [fractionFromClientX, onPositionChange, onDragEnd, onDiscard]);

  return (
    <div
      className={cn(
        "relative h-7 cursor-copy overflow-hidden rounded-md ring-1 ring-white/10 ring-inset",
        className,
      )}
      onMouseDown={handleTrackMouseDown}
      ref={trackRef}
    >
      <CheckerboardBackground />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: buildTrackGradient(stops) }}
      />
      {stops.map((stop, index) => (
        // Stops are positional; the logical write shape has no stable id, so the
        // index is the key.
        <button
          aria-label={`Gradient stop ${index + 1}`}
          className={cn(
            "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 size-3.5 cursor-grab rounded-[3px] border shadow-[0_0_0_1px_rgba(0,0,0,0.4)] active:cursor-grabbing",
            index === selectedIndex
              ? "border-white ring-2 ring-white"
              : "border-white/80",
          )}
          key={index}
          onMouseDown={handleMarkerMouseDown(index)}
          style={{
            backgroundColor: stop.color,
            left: `${Math.max(0, Math.min(1, stop.position)) * 100}%`,
          }}
          type="button"
        />
      ))}
    </div>
  );
}
