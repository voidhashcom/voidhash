'use client';

import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@voidhash/ui';
import { InputGroup, InputGroupAddon } from '@voidhash/ui/input-group';
import type * as React from 'react';

export type SelectInputProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
  placeholder,
  disabled = false,
  className
}: SelectInputProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <InputGroup
      className={cn('h-7 rounded-sm border-none dark:bg-input/60', className)}
    >
      {icon ? (
        <InputGroupAddon className="py-1 pr-0.5 pl-2">
          <div className="flex size-3.5 items-center justify-center">
            {icon}
          </div>
        </InputGroupAddon>
      ) : null}
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 py-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          size="sm"
        >
          <SelectValue placeholder={placeholder}>
            {selectedOption?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </InputGroup>
  );
}
