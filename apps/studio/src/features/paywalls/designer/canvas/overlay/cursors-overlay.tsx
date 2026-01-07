import { forwardRef } from "react";
import { useStore } from "zustand/react";

import { useCursorUpdater } from "../../hooks/use-cursor-updater";
import { usePaywallDesignerStore } from "../../state/designer-store";
import { useViewport } from "../viewport";

export const MultiplayerCursor = forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    name?: string;
    color?: string;
  }
>(({ x, y, name, color, ...rest }, ref) => (
  <div
    ref={ref}
    style={{
      left: 0,
      position: "absolute",
      top: 0,
      transform: `translate(${x}px, ${y}px)`,
    }}
    {...rest}
  >
    <svg
      width="20"
      viewBox="0 0 51 59"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{name}'s cursor</title>
      <path
        d="M12.5 55L3 3.5L46.5 30L25.5 36L12.5 55Z"
        fill="black"
        stroke="white"
        strokeWidth="3"
      />
    </svg>
    {name && color && (
      <div
        className="-mt-1 ml-3 rounded-full rounded-tl-sm py-0.5 pl-1 pr-1.5 text-xs text-white"
        style={{
          backgroundColor: color,
        }}
      >
        {name}
      </div>
    )}
  </div>
));

export function CursorsOverlay() {
  const store = usePaywallDesignerStore();
  const others = useStore(store, (state) => state.mimic.presence.others);
  const { canvasToScreen } = useViewport();

  const cursors = [...others.entries()].map(([_, value]) => {
    const screenPos = canvasToScreen(
      value.data.cursor?.x ?? 0,
      value.data.cursor?.y ?? 0
    );
    return {
      color: value.data.user.color,
      name: value.data.user.name,
      x: screenPos.x,
      y: screenPos.y,
    };
  });

  useCursorUpdater();

  return (
    <div
      className="pointer-events-none absolute w-screen h-screen inset-0"
      style={{ zIndex: 11 }}
    >
      {cursors.map((cursor) => (
        <MultiplayerCursor key={cursor.name} {...cursor} />
      ))}
    </div>
  );
}
