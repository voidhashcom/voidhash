'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@voidhash/ui';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectInputProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  placeholder?: string;
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select...'
}: SelectInputProps<T>) {
  return (
    <Select
      onValueChange={(newValue) => {
        onChange(newValue as T);
      }}
      value={value}
    >
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

