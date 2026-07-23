"use client";

import { IconButtonTooltip, ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import {
  GalleryVerticalIcon,
  type LucideIcon,
  MousePointer2Icon,
  SquareDashedIcon,
  TypeIcon,
} from "lucide-react";
import { useStore } from "zustand";

import { ZoomControls } from "../components/ui/zoom-controls";
import { setActiveTool } from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import type { AvailableTool } from "../state/designer-store-state";
import { AddComponentCommand } from "./add-component-dialog";
import { LocaleSwitcher } from "./locale-switcher";

/** Bottom-bar tool toggles, in order, with their tooltip labels. */
const TOOL_ITEMS: { icon: LucideIcon; label: string; value: AvailableTool }[] = [
  { icon: MousePointer2Icon, label: "Select", value: "cursor" },
  { icon: TypeIcon, label: "Text", value: "text" },
  { icon: SquareDashedIcon, label: "View", value: "columns" },
  { icon: GalleryVerticalIcon, label: "ScrollView", value: "scroll-view" },
];

export function ActionPanel() {
  const dispatch = usePaywallDesignerActions();
  const store = usePaywallDesignerStore();
  const activeTool = useStore(store, (state) => state.tools.activeTool);
  const isPreviewMode = useStore(store, (state) => state.mode === "preview");

  return (
    <div className="fixed right-0 bottom-12 left-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="flex flex-row gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg pointer-events-auto">
        {isPreviewMode ? (
          <>
            <ZoomControls />
            <LocaleSwitcher />
          </>
        ) : (
          <>
            <ToggleGroup
              onValueChange={(value) => dispatch(setActiveTool)({ tool: value as AvailableTool })}
              size="sm"
              spacing={0}
              type="single"
              value={activeTool}
              variant="outline"
            >
              {TOOL_ITEMS.map(({ icon: Icon, label, value }) => (
                <IconButtonTooltip key={value} label={label}>
                  <ToggleGroupItem
                    className="min-w-7 px-2 text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                    size="sm"
                    value={value}
                  >
                    <Icon />
                  </ToggleGroupItem>
                </IconButtonTooltip>
              ))}
            </ToggleGroup>
            <AddComponentCommand />
            <LocaleSwitcher />
          </>
        )}
      </div>
    </div>
  );
}
