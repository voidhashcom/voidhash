"use client";

import type {
  Action,
  ComponentBoundAction,
  Interaction,
  Trigger,
  TriggerType,
} from "@voidhash/mimic-schema";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@voidhash/ui";
import { ChevronRightIcon, MinusIcon } from "lucide-react";
import { useState } from "react";

import { SelectInput } from "@/features/studio/paywalls/designer/components/ui/select-input";
import type { LabeledVariable } from "@/features/studio/paywalls/designer/components/variables/types";

import { ActionEditor, ACTION_TYPE_LABELS } from "./action-editor";
import { PopoverHeader } from "../../../components/ui/popover-header";

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: "click", label: "On click" },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  click: "On click",
};

/**
 * Narrows a component-bound action back to the visual interaction `Action`
 * vocabulary. Returns `null` for action-payload sources, which interactions
 * cannot store (the editor never offers them without `payloadFields`).
 */
function toVisualAction(action: ComponentBoundAction): Action | null {
  switch (action.type) {
    case "none":
      return { type: "none" };
    case "close-paywall":
      return { type: "close-paywall" };
    case "set-variable": {
      const source = action.payload.newValue;
      if (source.type === "action-payload") {
        return null;
      }
      return {
        payload: { newValue: source, variableId: action.payload.variableId },
        type: "set-variable",
      };
    }
    case "purchase-product": {
      if (action.payload.type === "action-payload") {
        return null;
      }
      return { payload: action.payload, type: "purchase-product" };
    }
  }
}

export interface InteractionRowProps {
  interaction: Interaction;
  onUpdateTrigger: (trigger: Trigger) => void;
  onUpdateAction: (action: Action) => void;
  onRemove: () => void;
  allVariables: readonly LabeledVariable[];
  productVariables: readonly LabeledVariable[];
}

export function InteractionRow({
  interaction,
  onUpdateTrigger,
  onUpdateAction,
  onRemove,
  allVariables,
  productVariables,
}: InteractionRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTriggerChange = (triggerType: TriggerType) => {
    onUpdateTrigger({ type: triggerType });
  };

  const handleActionChange = (action: ComponentBoundAction) => {
    const visualAction = toVisualAction(action);
    if (visualAction) {
      onUpdateAction(visualAction);
    }
  };

  const triggerLabel = TRIGGER_LABELS[interaction.trigger.type];
  const actionLabel = ACTION_TYPE_LABELS[interaction.action.type];

  return (
    <div className="flex flex-row items-center gap-2">
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <Button className="flex-1 justify-start gap-1 px-2" size="sm" variant="secondary">
            <span className="text-xs">{triggerLabel}</span>
            <ChevronRightIcon className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">{actionLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3" side="left" sideOffset={4}>
          <PopoverHeader title="Interaction" onClose={() => setIsOpen(false)} />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">Trigger</span>
              <SelectInput
                label="Trigger"
                onChange={handleTriggerChange}
                options={TRIGGER_OPTIONS}
                value={interaction.trigger.type}
              />
            </div>

            <ActionEditor
              action={interaction.action}
              onChange={handleActionChange}
              productVariables={productVariables}
              variables={allVariables}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Button onClick={onRemove} size="icon-sm" variant="secondary">
        <MinusIcon />
      </Button>
    </div>
  );
}
