"use client";

import { useCallback, useEffect, useRef } from "react";

import { hsvToRgb } from "./color-utils";

export interface SaturationBrightnessPickerProps {
  hue: number;
  saturation: number;
  brightness: number;
  onChange: (s: number, v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDiscard?: () => void;
}

export function SaturationBrightnessPicker({
  hue,
  saturation,
  brightness,
  onChange,
  onDragStart,
  onDragEnd,
  onDiscard,
}: SaturationBrightnessPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateColor = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

      const s = x / rect.width;
      const v = 1 - y / rect.height;
      onChange(s, v);
    },
    [onChange],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    onDragStart?.();
    updateColor(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateColor(e.clientX, e.clientY);
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
  }, [updateColor, onDragEnd, onDiscard]);

  const hueRgb = hsvToRgb(hue, 1, 1);
  const hueColor = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;

  return (
    // TODO: Fix accessibility issues
    <div
      aria-label={`Color picker. Saturation: ${Math.round(saturation * 100)}%, Brightness: ${Math.round(brightness * 100)}%`}
      className="relative h-[200px] w-full cursor-crosshair rounded-md"
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(Math.min(1, saturation + step), brightness);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(Math.max(0, saturation - step), brightness);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(saturation, Math.min(1, brightness + step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(saturation, Math.max(0, brightness - step));
        }
      }}
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role="application"
      style={{ backgroundColor: hueColor }}
      // TODO: Fix accessibility issues
      tabIndex={0}
    >
      {/* White gradient (left to right) */}
      <div
        className="absolute inset-0 rounded-md"
        style={{
          background: "linear-gradient(to right, white, transparent)",
        }}
      />
      {/* Black gradient (top to bottom) */}
      <div
        className="absolute inset-0 rounded-md"
        style={{
          background: "linear-gradient(to bottom, transparent, black)",
        }}
      />
      {/* Picker handle */}
      <div
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{
          left: `${saturation * 100}%`,
          top: `${(1 - brightness) * 100}%`,
        }}
      />
    </div>
  );
}
