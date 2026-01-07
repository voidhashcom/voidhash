"use client";

import { cn } from "@voidhash/ui";
import { useStore } from "zustand/react";

import { Panel } from "@/features/paywalls/designer/components/ui/panel";

import { usePaywallDesignerStore } from "../state/designer-store";
import { PANEL_DIMENSIONS } from "./constants";
import { LayersSection } from "./left-panel/layers-section";

export function LeftPanel() {
  const store = usePaywallDesignerStore();
  const isPreviewMode = useStore(store, (state) => state.mode === "preview");

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 z-40 flex flex-col border-border border-r bg-sidebar",
        "transition-transform duration-300 ease-in-out",
        isPreviewMode && "-translate-x-full"
      )}
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width: PANEL_DIMENSIONS.LEFT_WIDTH,
      }}
    >
      <Panel>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          <LayersSection />
        </div>
      </Panel>
    </div>
  );
}
