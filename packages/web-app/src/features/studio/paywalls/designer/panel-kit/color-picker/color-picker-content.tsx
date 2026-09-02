"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@voidhash/ui";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@voidhash/ui/input-group";
import { PercentIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { TextInput } from "../text-input";
import { type ColorMode, type HSV, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "./color-utils";
import { EyedropperButton } from "./eyedropper-button";
import { HueSlider } from "./hue-slider";
import { OpacitySlider } from "./opacity-slider";
import { SaturationBrightnessPicker } from "./saturation-brightness-picker";

export interface ColorPickerContentProps {
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDiscard?: () => void;
}

const HEX_REGEX = /^[0-9A-Fa-f]{6}$/;

export function ColorPickerContent({
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  onDragStart,
  onDragEnd,
  onDiscard,
}: ColorPickerContentProps) {
  const [mode, setMode] = useState<ColorMode>("hex");
  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  const [internalHsv, setInternalHsv] = useState<HSV>(hsv);
  const [hexInput, setHexInput] = useState(color);
  const [rgbInput, setRgbInput] = useState(rgb);

  // Sync internal state when external color changes
  useEffect(() => {
    const newRgb = hexToRgb(color);
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    setInternalHsv(newHsv);
    setHexInput(color);
    setRgbInput(newRgb);
  }, [color]);

  const handleSaturationBrightnessChange = (s: number, v: number) => {
    const newHsv = { ...internalHsv, s, v };
    setInternalHsv(newHsv);
    const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(hex);
    setRgbInput(newRgb);
    onColorChange(hex);
  };

  const handleHueChange = (h: number) => {
    const newHsv = { ...internalHsv, h };
    setInternalHsv(newHsv);
    const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(hex);
    setRgbInput(newRgb);
    onColorChange(hex);
  };

  const handleHexInputChange = (value: string) => {
    setHexInput(value.toUpperCase());
    if (HEX_REGEX.test(value)) {
      const newRgb = hexToRgb(value);
      const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
      setInternalHsv(newHsv);
      setRgbInput(newRgb);
      onColorChange(value.toUpperCase());
    }
  };

  const handleRgbInputChange = (channel: "r" | "g" | "b", value: string) => {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
      return;
    }
    const clampedValue = Math.max(0, Math.min(255, num));
    const newRgb = { ...rgbInput, [channel]: clampedValue };
    setRgbInput(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    setInternalHsv(newHsv);
    setHexInput(hex);
    onColorChange(hex);
  };

  const handleColorPick = (pickedColor: string) => {
    const newRgb = hexToRgb(pickedColor);
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    setInternalHsv(newHsv);
    setHexInput(pickedColor);
    setRgbInput(newRgb);
    onColorChange(pickedColor);
  };

  return (
    <div className="flex w-[260px] flex-col gap-4">
      {/* Saturation/Brightness picker */}
      <SaturationBrightnessPicker
        brightness={internalHsv.v}
        hue={internalHsv.h}
        onChange={handleSaturationBrightnessChange}
        onDiscard={onDiscard}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        saturation={internalHsv.s}
      />

      {/* Sliders row */}
      <div className="flex items-center gap-3">
        <EyedropperButton onColorPick={handleColorPick} />
        <div className="flex flex-1 flex-col gap-2.5">
          <HueSlider
            hue={internalHsv.h}
            onChange={handleHueChange}
            onDiscard={onDiscard}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
          />
          <OpacitySlider
            color={color}
            onChange={onOpacityChange}
            onDiscard={onDiscard}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            opacity={opacity}
          />
        </div>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <Select onValueChange={(v) => setMode(v as ColorMode)} value={mode}>
          <SelectTrigger className="h-7 w-[70px] gap-1 rounded-sm border-none px-2 text-xs dark:bg-input/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hex">Hex</SelectItem>
            <SelectItem value="rgb">RGB</SelectItem>
          </SelectContent>
        </Select>

        {mode === "hex" ? (
          <>
            <InputGroup className="h-7 flex-1 rounded-sm border-none dark:bg-input/60">
              <InputGroupInput
                aria-label="Hex color"
                className="h-7 px-2 py-0 text-xs"
                maxLength={6}
                onBlur={() => {
                  if (!HEX_REGEX.test(hexInput)) {
                    setHexInput(color);
                  }
                }}
                onChange={(e) => handleHexInputChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                value={hexInput}
              />
            </InputGroup>
            <TextInput
              className="w-16"
              icon={<PercentIcon />}
              label="Opacity"
              maxValue={100}
              minValue={0}
              onChange={(opacityValue) => {
                onOpacityChange(Number.parseInt(opacityValue, 10));
              }}
              type="number"
              value={opacity.toString()}
            />
          </>
        ) : (
          <>
            <InputGroup className="h-7 w-11 shrink-0 rounded-sm border-none dark:bg-input/60">
              <InputGroupInput
                aria-label="Red"
                className="h-7 px-1.5 py-0 text-center text-xs"
                max={255}
                min={0}
                onChange={(e) => handleRgbInputChange("r", e.target.value)}
                type="number"
                value={rgbInput.r}
              />
            </InputGroup>
            <InputGroup className="h-7 w-11 shrink-0 rounded-sm border-none dark:bg-input/60">
              <InputGroupInput
                aria-label="Green"
                className="h-7 px-1.5 py-0 text-center text-xs"
                max={255}
                min={0}
                onChange={(e) => handleRgbInputChange("g", e.target.value)}
                type="number"
                value={rgbInput.g}
              />
            </InputGroup>
            <InputGroup className="h-7 w-11 shrink-0 rounded-sm border-none dark:bg-input/60">
              <InputGroupInput
                aria-label="Blue"
                className="h-7 px-1.5 py-0 text-center text-xs"
                max={255}
                min={0}
                onChange={(e) => handleRgbInputChange("b", e.target.value)}
                type="number"
                value={rgbInput.b}
              />
            </InputGroup>
            <InputGroup className="h-7 w-[52px] shrink-0 rounded-sm border-none dark:bg-input/60">
              <InputGroupInput
                aria-label="Opacity"
                className="h-7 px-2 py-0 text-xs"
                max={100}
                min={0}
                onBlur={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (Number.isNaN(val)) {
                    onOpacityChange(100);
                  }
                }}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) {
                    onOpacityChange(Math.max(0, Math.min(100, val)));
                  }
                }}
                type="number"
                value={opacity}
              />
              <InputGroupAddon align="inline-end" className="pr-2 text-xs">
                %
              </InputGroupAddon>
            </InputGroup>
          </>
        )}
      </div>
    </div>
  );
}
