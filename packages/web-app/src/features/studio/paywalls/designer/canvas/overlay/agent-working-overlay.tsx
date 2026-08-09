"use client";

import { cn } from "@voidhash/ui";
import { SparklesIcon } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand/react";

import { PANEL_DIMENSIONS } from "../../panels/constants";
import { usePaywallDesignerStore } from "../../state/designer-store";
import type { AgentCanvasOperation } from "../../state/designer-store-state";

const phaseClasses: Record<AgentCanvasOperation["phase"], string> = {
  thinking: "border-violet-400/70 bg-violet-400/10 text-violet-700 dark:text-violet-200",
  inspecting: "border-sky-400/80 bg-sky-400/10 text-sky-700 dark:text-sky-200",
  editing: "border-violet-400/90 bg-violet-400/10 text-violet-700 dark:text-violet-200",
  reviewing: "border-amber-400/90 bg-amber-400/10 text-amber-700 dark:text-amber-200",
  finishing: "border-emerald-400/90 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
};

const phaseOutlineClasses: Record<AgentCanvasOperation["phase"], string> = {
  thinking: "border-violet-400/70 text-violet-700 dark:text-violet-200",
  inspecting: "border-sky-400/80 text-sky-700 dark:text-sky-200",
  editing: "border-violet-400/90 text-violet-700 dark:text-violet-200",
  reviewing: "border-amber-400/90 text-amber-700 dark:text-amber-200",
  finishing: "border-emerald-400/90 text-emerald-700 dark:text-emerald-200",
};

/**
 * Visualizes the agent's current tool activity over the canvas. Targeted tools
 * outline the document nodes they read or mutate; every active turn also gets a
 * compact status pill so non-node work (thinking, component compilation, final
 * review) remains visible.
 */
export function AgentWorkingOverlay() {
  const store = usePaywallDesignerStore();
  const operations = useStore(store, (state) => state.ai.operations);
  const canvas = useStore(store, (state) => state.canvas);

  const active = useMemo(
    () => Object.values(operations).sort((a, b) => b.startedAt - a.startedAt),
    [operations],
  );
  const primary = active.find((operation) => operation.phase !== "thinking") ?? active[0];

  const targets = useMemo(() => {
    const byId = new Map<string, AgentCanvasOperation>();
    for (const operation of active) {
      for (const nodeId of operation.nodeIds) {
        if (!byId.has(nodeId)) {
          byId.set(nodeId, operation);
        }
      }
    }
    return [...byId.entries()];
  }, [active]);

  if (!primary) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="polite">
      <div
        className={cn(
          "absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md",
          phaseClasses[primary.phase],
        )}
        style={{ top: PANEL_DIMENSIONS.TOP_HEIGHT + 12 }}
      >
        <SparklesIcon className="size-3.5 animate-pulse" />
        <span>{primary.label}</span>
        {active.length > 1 ? (
          <span className="rounded-full bg-current/10 px-1.5 tabular-nums">{active.length}</span>
        ) : null}
      </div>

      {targets.map(([nodeId, operation]) => {
        const box = canvas.boundingBoxes[nodeId];
        if (!box) {
          return null;
        }
        return (
          <div
            key={nodeId}
            className={cn(
              "absolute animate-pulse rounded-sm border-2 border-dashed bg-transparent shadow-lg",
              phaseOutlineClasses[operation.phase],
            )}
            style={{
              height: box.height * canvas.scale,
              left: box.x * canvas.scale + canvas.x,
              top: box.y * canvas.scale + canvas.y,
              width: box.width * canvas.scale,
            }}
          >
            <span className="absolute -top-6 left-0 max-w-52 truncate rounded-sm bg-background/95 px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
              {operation.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
