'use client';

import { Input } from '@voidhash/ui';
import { useCallback, useEffect, useState } from 'react';
import type { Padding } from '../../../state/schema';

interface SpacingInputProps {
  value: Padding;
  onChange: (value: Padding) => void;
}

type SpacingSide = 'top' | 'right' | 'bottom' | 'left';

const SIDES: Array<{ key: SpacingSide; label: string }> = [
  { key: 'top', label: 'T' },
  { key: 'right', label: 'R' },
  { key: 'bottom', label: 'B' },
  { key: 'left', label: 'L' }
];

export function SpacingInput({ value, onChange }: SpacingInputProps) {
  const [localValues, setLocalValues] = useState({
    top: String(value.top),
    right: String(value.right),
    bottom: String(value.bottom),
    left: String(value.left)
  });

  useEffect(() => {
    setLocalValues({
      top: String(value.top),
      right: String(value.right),
      bottom: String(value.bottom),
      left: String(value.left)
    });
  }, [value.top, value.right, value.bottom, value.left]);

  const handleChange = useCallback(
    (side: SpacingSide, inputValue: string) => {
      setLocalValues((prev) => ({ ...prev, [side]: inputValue }));
    },
    []
  );

  const handleBlur = useCallback(
    (side: SpacingSide) => {
      let numValue = Number.parseFloat(localValues[side]);
      if (Number.isNaN(numValue)) {
        numValue = value[side];
      }
      if (numValue < 0) {
        numValue = 0;
      }

      setLocalValues((prev) => ({ ...prev, [side]: String(numValue) }));
      if (numValue !== value[side]) {
        onChange({ ...value, [side]: numValue });
      }
    },
    [localValues, value, onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, side: SpacingSide) => {
      if (event.key === 'Enter') {
        handleBlur(side);
      }
    },
    [handleBlur]
  );

  return (
    <div className="grid grid-cols-4 gap-1">
      {SIDES.map(({ key, label }) => (
        <div className="flex flex-col gap-1" key={key}>
          <span className="text-center text-muted-foreground text-[10px]">
            {label}
          </span>
          <Input
            className="h-8 px-1 text-center text-xs"
            onBlur={() => {
              handleBlur(key);
            }}
            onChange={(event) => {
              handleChange(key, event.target.value);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, key);
            }}
            type="text"
            value={localValues[key]}
          />
        </div>
      ))}
    </div>
  );
}

