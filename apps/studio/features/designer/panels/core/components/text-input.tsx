'use client';

import { cn } from '@voidhash/ui';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from '@voidhash/ui/input-group';
import type { Schema } from 'effect';
import { Schema as S } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';

export type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  typeNumberStepIncrement?: number;
  icon?: React.ReactNode;
  label: string;
  validator?: Schema.Schema<string>;
  className?: string;
};

function useNumberStepper(
  step: number,
  getValue: () => string,
  onValueChange: (value: string) => void
) {
  const incrementInterval = useRef<NodeJS.Timeout | null>(null);
  const decrementInterval = useRef<NodeJS.Timeout | null>(null);

  const startIncrement = () => {
    if (incrementInterval.current) {
      return;
    }
    onValueChange((Number(getValue()) + step).toString());
    incrementInterval.current = setInterval(() => {
      onValueChange((Number(getValue()) + step).toString());
    }, 100);
  };

  const startDecrement = () => {
    if (decrementInterval.current) {
      return;
    }
    onValueChange((Number(getValue()) - step).toString());
    decrementInterval.current = setInterval(() => {
      onValueChange((Number(getValue()) - step).toString());
    }, 100);
  };

  const stopIncrement = () => {
    if (incrementInterval.current) {
      clearInterval(incrementInterval.current);
      incrementInterval.current = null;
    }
  };

  const stopDecrement = () => {
    if (decrementInterval.current) {
      clearInterval(decrementInterval.current);
      decrementInterval.current = null;
    }
  };

  return {
    startIncrement,
    startDecrement,
    stopIncrement,
    stopDecrement
  };
}

export function TextInput({
  value,
  onChange,
  icon,
  label,
  type = 'text',
  typeNumberStepIncrement = 1,
  validator = S.String,
  className
}: TextInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const internalValueRef = useRef(internalValue);

  // Keep ref in sync with state for use in intervals
  useEffect(() => {
    internalValueRef.current = internalValue;
  }, [internalValue]);

  // Sync internal value when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Save the value to the internal state only (for typing)
  const handleInputChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

  // Save to internal state AND propagate to parent (for dragging/incrementing)
  const handleLiveChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  // When editing is complete, validate the value and save it to the parent if valid, else reset to the previous state
  const handleBlur = () => {
    try {
      const result = S.decodeSync(validator)(internalValue);
      onChange(result);
    } catch {
      setInternalValue(value);
    }
  };

  const { startIncrement, startDecrement, stopIncrement, stopDecrement } =
    useNumberStepper(
      typeNumberStepIncrement,
      () => internalValueRef.current,
      handleLiveChange
    );

  const isDragging = useRef(false);
  const dragStartValue = useRef<number>(0);
  const accumulatedMovement = useRef<number>(0);
  const dragButtonRef = useRef<HTMLDivElement>(null);
  const pixelsPerStep = 5; // Pixels of movement per step increment

  useEffect(() => {
    if (type !== 'number') {
      return;
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) {
        return;
      }
      // Use movementX for pointer lock, accumulate the movement
      accumulatedMovement.current += e.movementX;
      const steps = Math.round(accumulatedMovement.current / pixelsPerStep);
      const newValue = dragStartValue.current + steps * typeNumberStepIncrement;
      handleLiveChange(newValue.toString());
    };

    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        accumulatedMovement.current = 0;
        document.exitPointerLock();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [type, typeNumberStepIncrement, handleLiveChange]);

  const handleIconMouseDown = (e: React.MouseEvent) => {
    if (type !== 'number') {
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    dragStartValue.current = Number(internalValue) || 0;
    accumulatedMovement.current = 0;
    // Lock the pointer to keep cursor in place
    dragButtonRef.current?.requestPointerLock();
  };

  const handleIconKeyDown = (e: React.KeyboardEvent) => {
    if (type !== 'number') {
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      startIncrement();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      startDecrement();
    }
  };

  const handleIconKeyUp = (e: React.KeyboardEvent) => {
    if (type !== 'number') {
      return;
    }
    if (e.key === 'ArrowRight') {
      stopIncrement();
    } else if (e.key === 'ArrowLeft') {
      stopDecrement();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // @ts-expect-error: Element may not always be present, but we're in an event handler so it's safe
      e.target.blur();
    }
    if (type === 'number' && e.key === 'ArrowUp') {
      startIncrement();
      // Prevent default scrolling
      e.preventDefault();
    }
    if (type === 'number' && e.key === 'ArrowDown') {
      startDecrement();
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type === 'number' && e.key === 'ArrowUp') {
      stopIncrement();
    }
    if (type === 'number' && e.key === 'ArrowDown') {
      stopDecrement();
    }
  };

  return (
    <InputGroup
      className={cn('h-7 rounded-sm border-none dark:bg-input/60', className)}
    >
      <InputGroupInput
        aria-label={label}
        className="h-7 px-1 py-0 text-xs"
        onBlur={() => handleBlur()}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        value={internalValue}
      />
      {icon ? (
        <InputGroupAddon className="py-1 pr-0.5 pl-2">
          {type === 'number' ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: We need to use a div to get the pointer lock to work
            // biome-ignore lint/nursery/noNoninteractiveElementInteractions: We need to use a div to get the pointer lock to work
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: We need to use a div to get the pointer lock to work
            <div
              aria-label="Drag to adjust value"
              className="flex size-3.5 cursor-ew-resize select-none items-center justify-center border-0 bg-transparent p-0"
              onKeyDown={handleIconKeyDown}
              onKeyUp={handleIconKeyUp}
              onMouseDown={handleIconMouseDown}
              ref={dragButtonRef}
              tabIndex={-1}
            >
              {icon}
            </div>
          ) : (
            <div className="flex size-3.5 items-center justify-center">
              {icon}
            </div>
          )}
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
