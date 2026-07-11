"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import type { VoidhashGradientSettings } from "./voidhash-gradient-settings";

type NumericSettingKey = {
  [Key in keyof VoidhashGradientSettings]: VoidhashGradientSettings[Key] extends number ? Key : never;
}[keyof VoidhashGradientSettings];

type BooleanSettingKey = {
  [Key in keyof VoidhashGradientSettings]: VoidhashGradientSettings[Key] extends boolean ? Key : never;
}[keyof VoidhashGradientSettings];

type ColorSettingKey = {
  [Key in keyof VoidhashGradientSettings]: VoidhashGradientSettings[Key] extends string ? Key : never;
}[keyof VoidhashGradientSettings];

const booleanControls: Array<{ key: BooleanSettingKey; label: string }> = [
  { key: "topEnabled", label: "Top effect" },
];

const numericControls: Array<{
  key: NumericSettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "blur", label: "Blur", min: 0, max: 90, step: 1 },
  { key: "effectHeight", label: "Height", min: 70, max: 180, step: 1 },
  { key: "bottomOffset", label: "Bottom", min: -60, max: 20, step: 1 },
  { key: "topOffset", label: "Top", min: -20, max: 60, step: 1 },
  { key: "bottomSeed", label: "Bottom seed", min: 0, max: 80, step: 0.1 },
  { key: "topSeed", label: "Top seed", min: 0, max: 80, step: 0.1 },
  { key: "fadeStart", label: "Fade start", min: 0, max: 80, step: 1 },
  { key: "fadeEnd", label: "Fade full", min: 10, max: 100, step: 1 },
  { key: "planeY", label: "Plane Y", min: -2.4, max: 0.2, step: 0.01 },
  { key: "rotationX", label: "Tilt", min: -1.4, max: -0.25, step: 0.01 },
  { key: "scaleX", label: "Width", min: 0.8, max: 2.2, step: 0.01 },
  { key: "scaleY", label: "Depth", min: 0.5, max: 1.8, step: 0.01 },
  { key: "amplitude", label: "Amplitude", min: 0, max: 1.8, step: 0.01 },
  { key: "frequency", label: "Frequency", min: 0.05, max: 0.5, step: 0.01 },
  { key: "midFrequency", label: "Mid noise", min: 0.8, max: 4, step: 0.01 },
  { key: "highFrequency", label: "Fine noise", min: 1.5, max: 7, step: 0.01 },
  { key: "speed", label: "Speed", min: 0, max: 0.2, step: 0.001 },
  { key: "lift", label: "Lift", min: 0, max: 1, step: 0.01 },
  { key: "fresnelPower", label: "Fresnel pow", min: 0.5, max: 4, step: 0.01 },
  { key: "fresnelStrength", label: "Fresnel", min: 0, max: 3, step: 0.01 },
  { key: "horizonStrength", label: "Horizon", min: 0, max: 2, step: 0.01 },
  { key: "lateralStrength", label: "Blue bias", min: 0, max: 1.5, step: 0.01 },
  { key: "intensity", label: "Intensity", min: 0.2, max: 2, step: 0.01 },
  { key: "baseGlow", label: "Purple mix", min: 0, max: 1.5, step: 0.01 },
  { key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
];

const colorControls: Array<{ key: ColorSettingKey; label: string }> = [
  { key: "baseColor", label: "Base" },
  { key: "fresnelColor", label: "Fresnel" },
];

function formatValue(value: number) {
  if (Math.abs(value) >= 10) {
    return value.toFixed(0);
  }

  return value.toFixed(2);
}

/** Renders the debug tuner for Voidhash gradient background settings. */
export function VoidhashGradientControls({
  onChange,
  onHide,
  onReset,
  settings,
  title = "Gradient FX",
}: {
  onChange: Dispatch<SetStateAction<VoidhashGradientSettings>>;
  onHide: () => void;
  onReset: () => void;
  settings: VoidhashGradientSettings;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-h-[calc(100vh-2rem)] w-[320px] flex-col overflow-hidden rounded-lg border border-border bg-background/95 text-foreground shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-border border-b px-3 py-2">
        <div className="font-medium text-sm">{title}</div>
        <button className="text-muted-foreground text-xs hover:text-foreground" onClick={onHide} type="button">
          Hide
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        {booleanControls.map((control) => (
          <label className="grid grid-cols-[88px_1fr_44px] items-center gap-2 text-xs" key={control.key}>
            <span className="text-muted-foreground">{control.label}</span>
            <input
              aria-label={control.label}
              checked={settings[control.key]}
              className="h-4 w-4 accent-primary"
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  [control.key]: event.target.checked,
                }));
              }}
              type="checkbox"
            />
            <span className="text-right font-mono text-muted-foreground">{settings[control.key] ? "on" : "off"}</span>
          </label>
        ))}

        {colorControls.map((control) => (
          <label className="grid grid-cols-[88px_1fr_76px] items-center gap-2 text-xs" key={control.key}>
            <span className="text-muted-foreground">{control.label}</span>
            <input
              aria-label={control.label}
              className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  [control.key]: event.target.value,
                }));
              }}
              type="color"
              value={settings[control.key]}
            />
            <span className="font-mono text-muted-foreground">{settings[control.key]}</span>
          </label>
        ))}

        {numericControls.map((control) => (
          <label className="grid grid-cols-[88px_1fr_44px] items-center gap-2 text-xs" key={control.key}>
            <span className="text-muted-foreground">{control.label}</span>
            <input
              aria-label={control.label}
              className="accent-primary"
              max={control.max}
              min={control.min}
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  [control.key]: Number(event.target.value),
                }));
              }}
              step={control.step}
              type="range"
              value={settings[control.key]}
            />
            <span className="text-right font-mono text-muted-foreground">{formatValue(settings[control.key])}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2 border-border border-t p-3">
        <button
          className="flex-1 rounded-md border border-border px-3 py-2 text-xs hover:bg-card"
          onClick={async () => {
            await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          type="button"
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
        <button className="rounded-md border border-border px-3 py-2 text-xs hover:bg-card" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
