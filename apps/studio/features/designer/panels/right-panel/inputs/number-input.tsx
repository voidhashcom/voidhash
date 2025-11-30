'use client';

import { Input } from '@voidhash/ui';
import { useCallback, useEffect, useState } from 'react';

interface NumberInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    let numValue = Number.parseFloat(localValue);

    if (Number.isNaN(numValue)) {
      numValue = value;
    }

    if (min !== undefined && numValue < min) {
      numValue = min;
    }
    if (max !== undefined && numValue > max) {
      numValue = max;
    }

    setLocalValue(String(numValue));
    if (numValue !== value) {
      onChange(numValue);
    }
  }, [localValue, min, max, value, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleBlur();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const newValue = Math.min(value + step, max ?? Number.POSITIVE_INFINITY);
        onChange(newValue);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const newValue = Math.max(value - step, min ?? Number.NEGATIVE_INFINITY);
        onChange(newValue);
      }
    },
    [handleBlur, value, step, max, min, onChange]
  );

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="w-5 shrink-0 text-muted-foreground text-xs">
          {label}
        </span>
      )}
      <div className="relative flex-1">
        <Input
          className="h-8 pr-6 text-xs"
          onBlur={handleBlur}
          onChange={(event) => {
            setLocalValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          type="text"
          value={localValue}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground text-xs">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

