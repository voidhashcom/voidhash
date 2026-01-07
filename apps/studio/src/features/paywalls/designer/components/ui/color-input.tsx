"use client";

import { Popover, PopoverContent, PopoverTrigger, cn } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { PercentIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ColorPickerContent } from "./color-picker/color-picker-content";
import { ColorSwatch } from "./color-picker/color-swatch";
import { hexOpacityToRgba, rgbaToHexOpacity } from "./color-picker/color-utils";
import { TextInput } from "./text-input";

export interface ColorInputProps {
  /** RGBA color string (e.g., "rgba(255, 255, 255, 1)") */
  value: string;
  /** Callback when color changes, returns RGBA string */
  onChange: (value: string) => void;
  className?: string;
}

const HEX_REGEX = /^[0-9A-Fa-f]{6}$/;

export function ColorInput({
  value = "rgba(255, 255, 255, 1)",
  onChange,
  className,
}: ColorInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse RGBA to internal hex + opacity representation
  const { hex: initialHex, opacity: initialOpacity } = rgbaToHexOpacity(value);
  const [internalHex, setInternalHex] = useState(initialHex);
  const [internalOpacity, setInternalOpacity] = useState(initialOpacity);

  // Sync internal state when external value changes
  useEffect(() => {
    const { hex, opacity } = rgbaToHexOpacity(value);
    setInternalHex(hex);
    setInternalOpacity(opacity);
  }, [value]);

  const emitChange = (hex: string, opacity: number) => {
    onChange(hexOpacityToRgba(hex, opacity));
  };

  const handleColorChange = (newHex: string) => {
    setInternalHex(newHex);
    emitChange(newHex, internalOpacity);
  };

  const handleOpacityChange = (newOpacity: number) => {
    setInternalOpacity(newOpacity);
    emitChange(internalHex, newOpacity);
  };

  const handleHexInputChange = (inputValue: string) => {
    const cleaned = inputValue.replace("#", "").toUpperCase();
    setInternalHex(cleaned);
    if (HEX_REGEX.test(cleaned)) {
      emitChange(cleaned, internalOpacity);
    }
  };

  const handleHexInputBlur = () => {
    if (!HEX_REGEX.test(internalHex)) {
      const { hex } = rgbaToHexOpacity(value);
      setInternalHex(hex);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <InputGroup className="h-7 flex-1 rounded-sm border-none dark:bg-input/60">
        <Popover onOpenChange={setIsOpen} open={isOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Open color picker"
              className="flex h-7 shrink-0 items-center justify-center rounded-sm px-1.5 transition-colors hover:bg-accent dark:bg-input/60 dark:hover:bg-accent/50"
              type="button"
            >
              <ColorSwatch color={internalHex} opacity={internalOpacity} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto rounded-2xl p-3"
            side="left"
            sideOffset={8}
          >
            <ColorPickerContent
              color={internalHex}
              onColorChange={handleColorChange}
              onOpacityChange={handleOpacityChange}
              opacity={internalOpacity}
            />
          </PopoverContent>
        </Popover>
        <InputGroupInput
          aria-label="Hex color code"
          className="h-7 px-2 py-0 text-xs"
          maxLength={6}
          onBlur={handleHexInputBlur}
          onChange={(e) => handleHexInputChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          value={internalHex}
        />
      </InputGroup>

      <TextInput
        className="w-16"
        icon={<PercentIcon />}
        label="Opacity"
        maxValue={100}
        minValue={0}
        onChange={(opacityValue) => {
          handleOpacityChange(Number.parseInt(opacityValue, 10));
        }}
        type="number"
        value={internalOpacity.toString()}
      />
    </div>
  );
}
