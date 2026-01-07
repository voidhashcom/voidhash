"use client";

import { cn } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
}: NumberInputProps) {
  return (
    <InputGroup
      className={cn(
        "h-7 w-20 rounded-sm border-none dark:bg-input/60",
        className
      )}
    >
      <InputGroupInput
        className="h-7 px-1 py-0 pl-2 text-xs"
        max={max}
        min={min}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        step={step}
        type="number"
        value={value}
      />
    </InputGroup>
  );
}
