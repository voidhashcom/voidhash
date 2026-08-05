"use client";

import { cn } from "@voidhash/ui";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@voidhash/ui/input-group";
import type { Schema } from "effect";
import { Schema as S } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  mixed?: boolean;
  mixedLabel?: string;
  /** Called when the user finishes editing (blur, Enter, drag end, stepper end). Use for committing deferred edits. */
  onCommit?: () => void;
  type?: "text" | "number";
  typeNumberStepIncrement?: number;
  minValue?: number;
  maxValue?: number;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  label: string;
  validator?: Schema.Decoder<string>;
  className?: string;
  disabled?: boolean;
}

function useNumberStepper(
  step: number,
  getValue: () => string,
  onValueChange: (value: string) => void,
  minValue?: number,
  maxValue?: number,
  disabled?: boolean,
) {
  const incrementInterval = useRef<NodeJS.Timeout | null>(null);
  const decrementInterval = useRef<NodeJS.Timeout | null>(null);

  const clampValue = (val: number): number => {
    if (minValue !== undefined && val < minValue) {
      return minValue;
    }
    if (maxValue !== undefined && val > maxValue) {
      return maxValue;
    }
    return val;
  };

  const startIncrement = () => {
    if (disabled || incrementInterval.current) {
      return;
    }
    const newValue = clampValue(Number(getValue()) + step);
    onValueChange(newValue.toString());
    incrementInterval.current = setInterval(() => {
      const currentValue = clampValue(Number(getValue()) + step);
      onValueChange(currentValue.toString());
    }, 100);
  };

  const startDecrement = () => {
    if (disabled || decrementInterval.current) {
      return;
    }
    const newValue = clampValue(Number(getValue()) - step);
    onValueChange(newValue.toString());
    decrementInterval.current = setInterval(() => {
      const currentValue = clampValue(Number(getValue()) - step);
      onValueChange(currentValue.toString());
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
    startDecrement,
    startIncrement,
    stopDecrement,
    stopIncrement,
  };
}

export function TextInput({
  value,
  onChange,
  mixed = false,
  mixedLabel = "Mixed",
  onCommit,
  icon,
  trailing,
  label,
  type = "text",
  typeNumberStepIncrement = 1,
  minValue,
  maxValue,
  validator = S.String,
  className,
  disabled = false,
}: TextInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
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

  // Clamp value between min and max if they are defined
  const clampValue = useCallback(
    (val: number): number => {
      if (minValue !== undefined && val < minValue) {
        return minValue;
      }
      if (maxValue !== undefined && val > maxValue) {
        return maxValue;
      }
      return val;
    },
    [minValue, maxValue],
  );

  // Save to internal state AND propagate to parent (for dragging/incrementing)
  const handleLiveChange = useCallback(
    (newValue: string) => {
      if (disabled) {
        return;
      }
      if (type === "number") {
        const numValue = Number(newValue);
        if (!Number.isNaN(numValue)) {
          const clampedValue = clampValue(numValue);
          setInternalValue(clampedValue.toString());
          onChange(clampedValue.toString());
          return;
        }
      }
      setInternalValue(newValue);
      onChange(newValue);
    },
    [onChange, type, clampValue, disabled],
  );

  // When editing is complete, validate the value and save it to the parent if valid, else reset to the previous state
  const handleBlur = () => {
    setIsFocused(false);
    if (mixed && internalValue.trim() === "") {
      setInternalValue(value);
      onCommit?.();
      return;
    }
    try {
      let result = S.decodeUnknownSync(validator)(internalValue);
      // Apply min/max constraints for number type
      if (type === "number") {
        const numValue = Number(result);
        if (!Number.isNaN(numValue)) {
          result = clampValue(numValue).toString();
        }
      }
      onChange(result);
    } catch {
      setInternalValue(value);
    }
    onCommit?.();
  };

  const { startIncrement, startDecrement, stopIncrement, stopDecrement } = useNumberStepper(
    typeNumberStepIncrement,
    () => internalValueRef.current,
    handleLiveChange,
    minValue,
    maxValue,
    disabled,
  );

  const isDragging = useRef(false);
  const dragStartValue = useRef<number>(0);
  const accumulatedMovement = useRef<number>(0);
  const dragButtonRef = useRef<HTMLDivElement>(null);
  const pixelsPerStep = 5; // Pixels of movement per step increment

  useEffect(() => {
    if (type !== "number") {
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
      const clampedValue = clampValue(newValue);
      handleLiveChange(clampedValue.toString());
    };

    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        accumulatedMovement.current = 0;
        document.exitPointerLock();
        onCommit?.();
      }
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [type, typeNumberStepIncrement, handleLiveChange, clampValue, onCommit]);

  const handleIconMouseDown = (e: React.MouseEvent) => {
    if (type !== "number" || disabled) {
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
    if (type !== "number") {
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      startIncrement();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      startDecrement();
    }
  };

  const handleIconKeyUp = (e: React.KeyboardEvent) => {
    if (type !== "number") {
      return;
    }
    if (e.key === "ArrowRight") {
      stopIncrement();
      onCommit?.();
    } else if (e.key === "ArrowLeft") {
      stopDecrement();
      onCommit?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // @ts-expect-error: Element may not always be present, but we're in an event handler so it's safe
      e.target.blur();
    }
    if (type === "number" && !disabled && e.key === "ArrowUp") {
      startIncrement();
      // Prevent default scrolling
      e.preventDefault();
    }
    if (type === "number" && !disabled && e.key === "ArrowDown") {
      startDecrement();
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type === "number" && e.key === "ArrowUp") {
      stopIncrement();
      onCommit?.();
    }
    if (type === "number" && e.key === "ArrowDown") {
      stopDecrement();
      onCommit?.();
    }
  };

  return (
    <InputGroup className={cn("h-7 rounded-sm border-none dark:bg-input/60", className)}>
      <InputGroupInput
        aria-label={label}
        className="h-7 px-1 py-0 pl-2 text-xs"
        disabled={disabled}
        placeholder={mixed && !isFocused ? mixedLabel : undefined}
        onBlur={() => handleBlur()}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={(e) => {
          setIsFocused(true);
          if (mixed) {
            setInternalValue("");
          }
          e.target.select();
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        value={mixed && !isFocused ? "" : internalValue}
      />
      {icon ? (
        <InputGroupAddon className="py-1 pr-0.5 pl-2">
          {type === "number" ? (
            // We need to use a div to get the pointer lock to work
            <div
              aria-label="Drag to adjust value"
              className={cn(
                "flex size-3.5 select-none items-center justify-center border-0 bg-transparent p-0",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-ew-resize",
              )}
              onKeyDown={handleIconKeyDown}
              onKeyUp={handleIconKeyUp}
              onMouseDown={handleIconMouseDown}
              ref={dragButtonRef}
              tabIndex={disabled ? undefined : -1}
            >
              {icon}
            </div>
          ) : (
            <div className="flex size-3.5 items-center justify-center">{icon}</div>
          )}
        </InputGroupAddon>
      ) : null}

      {trailing ? (
        <InputGroupAddon align="inline-end" className="py-1 pr-0.5 pl-2">
          {trailing}
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
