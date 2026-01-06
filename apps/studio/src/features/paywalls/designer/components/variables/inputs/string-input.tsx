'use client';

import { cn } from '@voidhash/ui';
import { InputGroup, InputGroupInput } from '@voidhash/ui/input-group';

export interface StringInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function StringInput({
  value,
  onChange,
  placeholder = 'Value...',
  className
}: StringInputProps) {
  return (
    <InputGroup
      className={cn(
        'h-7 min-w-20 flex-1 rounded-sm border-none dark:bg-input/60',
        className
      )}
    >
      <InputGroupInput
        className="h-7 px-1 py-0 pl-2 text-xs"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </InputGroup>
  );
}
