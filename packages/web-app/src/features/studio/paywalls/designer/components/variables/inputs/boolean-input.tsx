"use client";

import { ToggleGroup, ToggleGroupItem, cn } from "@voidhash/ui";

export interface BooleanInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export function BooleanInput({ value, onChange, className }: BooleanInputProps) {
  return (
    <ToggleGroup
      className={cn("h-7 flex items-center", className)}
      onValueChange={(v) => onChange(v === "true")}
      size="sm"
      type="single"
      value={value ? "true" : "false"}
    >
      <ToggleGroupItem className="h-7 px-2 text-xs flex-1" size="sm" value="true">
        True
      </ToggleGroupItem>
      <ToggleGroupItem className="h-7 px-2 text-xs flex-1" size="sm" value="false">
        False
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
