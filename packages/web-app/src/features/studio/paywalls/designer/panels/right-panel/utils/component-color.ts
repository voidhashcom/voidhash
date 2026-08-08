import { parseRgba, rgbToHex, rgbaToString } from "../../../components/ui/color-picker/color-utils";

const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const FALLBACK_RGBA = "rgba(255, 255, 255, 1)";
const FALLBACK_HEX = "#FFFFFF";

function expandShortHex(hex: string): string {
  return hex
    .split("")
    .map((char) => char + char)
    .join("");
}

/**
 * Converts a stored/manifest hex color (`#RGB`, `#RGBA`, `#RRGGBB` or
 * `#RRGGBBAA`, leading `#` optional) into the `rgba()` string `ColorInput`
 * edits. Unparseable input falls back to opaque white, matching the
 * `ColorInput` parser's behavior.
 */
export function hexColorToRgbaString(hex: string): string {
  const match = HEX_COLOR_REGEX.exec(hex.trim());
  if (!match?.[1]) {
    return FALLBACK_RGBA;
  }
  const digits = match[1].length <= 4 ? expandShortHex(match[1]) : match[1];
  const r = Number.parseInt(digits.slice(0, 2), 16);
  const g = Number.parseInt(digits.slice(2, 4), 16);
  const b = Number.parseInt(digits.slice(4, 6), 16);
  const a = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
  return rgbaToString(r, g, b, Math.round(a * 100) / 100);
}

/**
 * Converts the `rgba()` string emitted by `ColorInput` back to the hex form
 * component props store (`#RRGGBB`, or `#RRGGBBAA` when the alpha channel is
 * below 1). Unparseable input falls back to opaque white.
 */
export function rgbaStringToHexColor(rgba: string): string {
  if (!rgba.trim().startsWith("rgb")) {
    return FALLBACK_HEX;
  }
  const { r, g, b, a } = parseRgba(rgba);
  const hex = `#${rgbToHex(r, g, b)}`;
  if (a >= 1) {
    return hex;
  }
  const alpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex}${alpha}`;
}
