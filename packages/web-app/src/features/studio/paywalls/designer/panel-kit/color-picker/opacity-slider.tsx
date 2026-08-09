"use client";

import { useCallback, useEffect, useRef } from "react";

import { CheckerboardBackground } from "./checkerboard-background";

export interface OpacitySliderProps {
  color: string;
  opacity: number;
  onChange: (opacity: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDiscard?: () => void;
}

export function OpacitySlider({
  color,
  opacity,
  onChange,
  onDragStart,
  onDragEnd,
  onDiscard,
}: OpacitySliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateOpacity = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const o = Math.round((x / rect.width) * 100);
      onChange(o);
    },
    [onChange],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    onDragStart?.();
    updateOpacity(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateOpacity(e.clientX);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onDragEnd?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDragging.current) {
        isDragging.current = false;
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
  }, [updateOpacity, onDragEnd, onDiscard]);

  return (
    <div
      aria-label="Opacity slider"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={opacity}
      className="relative h-3 w-full cursor-pointer overflow-hidden rounded-full"
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role="slider"
      tabIndex={0}
    >
      <CheckerboardBackground />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, transparent, #${color})`,
        }}
      />
      {/* Slider handle */}
      <div
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{
          backgroundColor: `#${color}`,
          left: `${opacity}%`,
        }}
      />
    </div>
  );
}
