'use client';

import { useCallback, useEffect, useRef } from 'react';

export type HueSliderProps = {
  hue: number;
  onChange: (hue: number) => void;
};

export function HueSlider({ hue, onChange }: HueSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateHue = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const h = (x / rect.width) * 360;
      onChange(h);
    },
    [onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    updateHue(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateHue(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateHue]);

  return (
    <div
      aria-label="Hue slider"
      aria-valuemax={360}
      aria-valuemin={0}
      aria-valuenow={Math.round(hue)}
      className="relative h-3 w-full cursor-pointer rounded-full"
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role="slider"
      style={{
        background:
          'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
      }}
      tabIndex={0}
    >
      {/* Slider handle */}
      <div
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{
          left: `${(hue / 360) * 100}%`,
          backgroundColor: `hsl(${hue}, 100%, 50%)`
        }}
      />
    </div>
  );
}
