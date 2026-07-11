"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { MinusIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { LiteralInput } from "@/features/studio/paywalls/designer/components/variables/literal-input";

interface PendingVariable {
  type: VariableTypeKey;
  name: string;
  value: VariableType;
}

function getValueDisplayText(value: VariableType): string {
  switch (value.key) {
    case "string":
      return value.value || '""';
    case "number":
      return String(value.value);
    case "boolean":
      return value.value ? "True" : "False";
    case "product":
      return value.value.productId ? "..." : "None";
  }
}

export interface PendingVariableRowProps {
  pendingVariable: PendingVariable;
  onUpdateName: (newName: string) => void;
  onUpdateValue: (newValue: VariableType) => void;
  onRemove: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingVariableRow({
  pendingVariable,
  onUpdateName,
  onUpdateValue,
  onRemove,
  isOpen,
  onOpenChange,
}: PendingVariableRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueDisplay = getValueDisplayText(pendingVariable.value);

  // Auto-focus name input when popover opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure popover is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div className="flex flex-row items-center gap-2">
      <Popover onOpenChange={onOpenChange} open={isOpen}>
        <PopoverTrigger asChild>
          <Button className="flex-1 justify-start gap-0 px-0" size="sm" variant="secondary">
            <span className="flex-1 truncate border-r border-border px-2 text-left text-xs">
              {pendingVariable.name || "Unnamed"}
            </span>
            <span className="flex-1 truncate px-2 text-left text-xs text-muted-foreground">
              {valueDisplay}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3" side="left" sideOffset={4}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <InputGroup className="h-7 rounded-sm border-none dark:bg-input/60">
                <InputGroupInput
                  aria-label="Variable name"
                  className="h-7 px-1 py-0 pl-2 text-xs"
                  onChange={(e) => onUpdateName(e.target.value)}
                  ref={inputRef}
                  value={pendingVariable.name}
                />
              </InputGroup>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">Value</span>
              <LiteralInput
                className="flex flex-row gap-1"
                onChange={onUpdateValue}
                value={pendingVariable.value}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button onClick={onRemove} size="icon-sm" variant="secondary">
        <MinusIcon />
      </Button>
    </div>
  );
}
