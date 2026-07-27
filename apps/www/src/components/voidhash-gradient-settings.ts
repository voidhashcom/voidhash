export type VoidhashGradientSettings = {
  blur: number;
  effectHeight: number;
  bottomOffset: number;
  topEnabled: boolean;
  topOffset: number;
  bottomSeed: number;
  topSeed: number;
  fadeStart: number;
  fadeEnd: number;
  planeY: number;
  rotationX: number;
  scaleX: number;
  scaleY: number;
  amplitude: number;
  frequency: number;
  midFrequency: number;
  highFrequency: number;
  speed: number;
  lift: number;
  fresnelPower: number;
  fresnelStrength: number;
  horizonStrength: number;
  lateralStrength: number;
  intensity: number;
  baseGlow: number;
  opacity: number;
  baseColor: string;
  fresnelColor: string;
};

export const VOIDHASH_GRADIENT_STORAGE_KEY = "voidhash:gradient-background-settings";
export const VOIDHASH_GRADIENT_CONTROLS_STORAGE_KEY = "voidhash:gradient-background-controls";

export const DEFAULT_VOIDHASH_GRADIENT_SETTINGS: VoidhashGradientSettings = {
  blur: 7,
  effectHeight: 98,
  bottomOffset: 0,
  topEnabled: false,
  topOffset: 0,
  bottomSeed: 0,
  topSeed: 28.7,
  fadeStart: 22,
  fadeEnd: 58,
  planeY: -2.4,
  rotationX: -0.86,
  scaleX: 1.42,
  scaleY: 0.96,
  amplitude: 1.42,
  frequency: 0.19,
  midFrequency: 0.8,
  highFrequency: 1.5,
  speed: 0.072,
  lift: 0.58,
  fresnelPower: 0.96,
  fresnelStrength: 1.7,
  horizonStrength: 0,
  lateralStrength: 0.52,
  intensity: 1.03,
  baseGlow: 0,
  opacity: 1,
  baseColor: "#7f14ff",
  fresnelColor: "#0673ff",
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Merges persisted or caller-provided values with the supported gradient settings. */
export function mergeVoidhashGradientSettings(
  value: unknown,
  defaults: VoidhashGradientSettings = DEFAULT_VOIDHASH_GRADIENT_SETTINGS,
): VoidhashGradientSettings {
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const settings: VoidhashGradientSettings = { ...defaults };
  const entries = Object.entries(value as Partial<Record<keyof VoidhashGradientSettings, unknown>>);

  for (const [key, entryValue] of entries) {
    if (!(key in settings)) {
      continue;
    }

    const settingKey = key as keyof VoidhashGradientSettings;
    const defaultValue = settings[settingKey];

    if (typeof defaultValue === "number" && typeof entryValue === "number" && Number.isFinite(entryValue)) {
      settings[settingKey] = entryValue as never;
    }

    if (typeof defaultValue === "boolean" && typeof entryValue === "boolean") {
      settings[settingKey] = entryValue as never;
    }

    if (typeof defaultValue === "string" && typeof entryValue === "string" && HEX_COLOR_PATTERN.test(entryValue)) {
      settings[settingKey] = entryValue.toLowerCase() as never;
    }
  }

  return settings;
}
