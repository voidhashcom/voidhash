"use client";

import { MousePointer2Icon, SquareDashedIcon, TypeIcon } from "lucide-react";
import { useStore } from "zustand";

import {
  DesignerToggleGroup,
  DesignerToggleGroupItem,
} from "../components/ui/designer-toggle-group";
import { ModeToggle } from "../components/ui/mode-toggle";
import { ZoomControls } from "../components/ui/zoom-controls";
import { setActiveTool } from "../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../state/designer-store";
import type { AvailableTool } from "../state/designer-store-state";

export function ActionPanel() {
  const dispatch = usePaywallDesignerActions();
  const store = usePaywallDesignerStore();
  const activeTool = useStore(store, (state) => state.tools.activeTool);
  const isPreviewMode = useStore(store, (state) => state.mode === "preview");

  return (
    <div className="fixed right-0 bottom-12 left-0 z-40 flex items-center justify-center">
      <div className="flex flex-row gap-2 rounded-2xl border border-border bg-muted p-2 shadow-lg">
        {isPreviewMode && <ZoomControls />}
        {!isPreviewMode && (
          <DesignerToggleGroup
            onValueChange={(value) =>
              dispatch(setActiveTool)({ tool: value as AvailableTool })
            }
            spacing={2}
            type="single"
            value={activeTool}
            variant="primary"
          >
            <DesignerToggleGroupItem value="cursor">
              <MousePointer2Icon />
            </DesignerToggleGroupItem>
            <DesignerToggleGroupItem value="text">
              <TypeIcon />
            </DesignerToggleGroupItem>
            <DesignerToggleGroupItem value="columns">
              <SquareDashedIcon />
            </DesignerToggleGroupItem>
          </DesignerToggleGroup>
        )}
        <ModeToggle />
      </div>
    </div>
  );
}
