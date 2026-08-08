"use client";

import { cn, ScrollArea } from "@voidhash/ui";
import { useCallback } from "react";
import { useStore } from "zustand/react";

import { Panel } from "@/features/studio/paywalls/designer/components/ui/panel";

import { useAiPanelOffset } from "../ai-panel/use-ai-panel-offset";
import { setLeftPanelWidth, setPanelResizeActive } from "../state/actions/panel-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { PANEL_DIMENSIONS } from "./constants";
import { CodeFileTree } from "./left-panel/code-file-tree";
import { LayersSection } from "./left-panel/layers-section";
import { PanelResizeHandle } from "./panel-resize-handle";
import { persistPanelWidths } from "./panel-width-storage";

export function LeftPanel() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const mode = useStore(store, (state) => state.mode);
  const width = useStore(store, (state) => state.viewport.panels.left.width);
  const resizeActive = useStore(store, (state) => state.viewport.panelResizeActive);
  const visibleAiOffset = useAiPanelOffset();
  const isPreviewMode = mode === "preview";
  const isCodeMode = mode === "code";
  const aiOffset = isPreviewMode ? 0 : visibleAiOffset;

  const handleResizeStart = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: true });
  }, [dispatch]);

  const handleResizeChange = useCallback(
    (nextWidth: number) => {
      dispatch(setLeftPanelWidth)({ width: nextWidth });
    },
    [dispatch],
  );

  const handleResizeEnd = useCallback(() => {
    dispatch(setPanelResizeActive)({ active: false });
    persistPanelWidths(store.getState());
  }, [dispatch, store]);

  const getWidth = useCallback(() => store.getState().viewport.panels.left.width, [store]);

  return (
    <div
      className={cn(
        "fixed bottom-0 z-40 flex flex-col border-border border-r bg-panel",
        // Suspended while a resize handle is dragged so `left` tracks the AI
        // panel's live width instead of easing behind it.
        !resizeActive && "transition-[transform,left] duration-300 ease-in-out",
        isPreviewMode && "-translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        left: aiOffset,
        width,
      }}
    >
      <PanelResizeHandle
        edge="right"
        label="Resize layers panel"
        getWidth={getWidth}
        onWidthChange={handleResizeChange}
        onDragStart={handleResizeStart}
        onDragEnd={handleResizeEnd}
      />
      <Panel className="relative overflow-hidden">
        <div className="absolute inset-0">
          {/* Code mode swaps the layers/components panels for a virtual file tree. */}
          {isCodeMode ? (
            <CodeFileTree />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2">
                <LayersSection />
              </div>
            </ScrollArea>
          )}
        </div>
      </Panel>
    </div>
  );
}
