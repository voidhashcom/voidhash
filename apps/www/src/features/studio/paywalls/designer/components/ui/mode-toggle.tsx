"use client";

import { ToggleGroup, ToggleGroupItem } from "@voidhash/ui";
import { Code2, Eye, Languages, Paintbrush } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "zustand/react";

import { setMode } from "../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../state/designer-store";
import type { DesignerMode } from "../../state/designer-store-state";

const MODES: readonly { value: DesignerMode; label: string; icon: LucideIcon }[] = [
  { icon: Paintbrush, label: "Design", value: "design" },
  { icon: Eye, label: "Preview", value: "preview" },
  { icon: Code2, label: "Code", value: "code" },
  { icon: Languages, label: "Translate", value: "translation" },
];

export function ModeToggle() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const mode = useStore(store, (state) => state.mode);

  return (
    <ToggleGroup
      indicatorClassName="duration-150"
      onValueChange={(value) => {
        if (value) {
          dispatch(setMode)({ mode: value as DesignerMode });
        }
      }}
      size="sm"
      type="single"
      value={mode}
      variant="outline"
    >
      {MODES.map(({ icon: Icon, label, value }) => (
        <ToggleGroupItem
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          key={value}
          size="sm"
          value={value}
        >
          <Icon />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
