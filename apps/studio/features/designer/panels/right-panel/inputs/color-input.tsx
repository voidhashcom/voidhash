'use client';

import { Input, Popover, PopoverContent, PopoverTrigger } from '@voidhash/ui';
import { useCallback, useEffect, useState } from 'react';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  allowNull?: boolean;
}

const PRESET_COLORS = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#d1d5db'
];

export function ColorInput({
  value,
  onChange,
  allowNull = false
}: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    // Validate hex color
    if (HEX_COLOR_REGEX.test(localValue)) {
      onChange(localValue);
    } else {
      setLocalValue(value);
    }
  }, [localValue, value, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleBlur();
      }
    },
    [handleBlur]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setLocalValue(color);
      onChange(color);
    },
    [onChange]
  );

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input shadow-xs transition-colors hover:border-ring"
            style={{ backgroundColor: value }}
            type="button"
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-3">
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                className="h-6 w-6 cursor-pointer rounded border border-input transition-transform hover:scale-110"
                key={color}
                onClick={() => {
                  handlePresetClick(color);
                }}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
          </div>
          {allowNull && (
            <button
              className="mt-2 w-full rounded border border-input border-dashed p-1 text-muted-foreground text-xs hover:border-ring"
              onClick={() => {
                onChange('');
              }}
              type="button"
            >
              Remove
            </button>
          )}
        </PopoverContent>
      </Popover>
      <Input
        className="h-8 font-mono text-xs uppercase"
        onBlur={handleBlur}
        onChange={(event) => {
          setLocalValue(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        value={localValue.replace('#', '')}
      />
    </div>
  );
}
