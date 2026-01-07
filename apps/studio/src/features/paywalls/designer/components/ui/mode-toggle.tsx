"use client";

import { useStore } from "zustand/react";

import { setMode } from "../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../state/designer-store";
import type { DesignerMode } from "../../state/designer-store-state";
import { PanelToggleGroup, PanelToggleGroupItem } from "./toggle-group";

export function ModeToggle() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const mode = useStore(store, (state) => state.mode);

  return (
    <PanelToggleGroup
      onValueChange={(value) => {
        if (value) {
          dispatch(setMode)({ mode: value as DesignerMode });
        }
      }}
      type="single"
      value={mode}
    >
      <PanelToggleGroupItem value="design">Design</PanelToggleGroupItem>
      <PanelToggleGroupItem value="preview">Preview</PanelToggleGroupItem>
    </PanelToggleGroup>
  );
}
