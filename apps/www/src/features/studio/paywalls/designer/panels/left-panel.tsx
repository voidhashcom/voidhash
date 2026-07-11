"use client";

import { cn, ScrollArea } from "@voidhash/ui";
import { useStore } from "zustand/react";

import { Panel } from "@/features/studio/paywalls/designer/components/ui/panel";

import { usePaywallDesignerStore } from "../state/designer-store";
import { PANEL_DIMENSIONS } from "./constants";
import { CodeFileTree } from "./left-panel/code-file-tree";
import { LayersSection } from "./left-panel/layers-section";

export function LeftPanel() {
  const store = usePaywallDesignerStore();
  const mode = useStore(store, (state) => state.mode);
  const aiPanelOpen = useStore(store, (state) => state.ai.panelOpen);
  const aiWidth = useStore(store, (state) => state.ai.width);
  const isPreviewMode = mode === "preview";
  const isCodeMode = mode === "code";
  const aiOffset = aiPanelOpen && !isPreviewMode ? aiWidth : 0;

  return (
    <div
      className={cn(
        "fixed bottom-0 z-40 flex flex-col border-border border-r bg-panel",
        "transition-[transform,left] duration-300 ease-in-out",
        isPreviewMode && "-translate-x-full",
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        left: aiOffset,
        width: PANEL_DIMENSIONS.LEFT_WIDTH,
      }}
    >
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
