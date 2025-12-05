export type HSV = {
  h: number;
  s: number;
  v: number;
};

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type RGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ColorMode = 'hex' | 'rgb';

const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
export function hexToRgb(hex: string): RGB {
  const result = HEX_REGEX.exec(hex);
  if (!result) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: Number.parseInt(result.at(1) ?? 'ff', 16),
    g: Number.parseInt(result.at(2) ?? 'ff', 16),
    b: Number.parseInt(result.at(3) ?? 'ff', 16)
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / diff) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / diff + 2;
    } else {
      h = (rNorm - gNorm) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }

  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

const RGBA_REGEX =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;

export function parseRgba(rgba: string): RGBA {
  const match = RGBA_REGEX.exec(rgba);
  if (!match) {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  return {
    r: Math.min(255, Math.max(0, Number.parseInt(match.at(1) ?? '255', 10))),
    g: Math.min(255, Math.max(0, Number.parseInt(match.at(2) ?? '255', 10))),
    b: Math.min(255, Math.max(0, Number.parseInt(match.at(3) ?? '255', 10))),
    a: Math.min(1, Math.max(0, Number.parseFloat(match.at(4) ?? '1')))
  };
}

export function rgbaToString(
  r: number,
  g: number,
  b: number,
  a: number
): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

export function hexOpacityToRgba(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  return rgbaToString(rgb.r, rgb.g, rgb.b, opacity / 100);
}

export function rgbaToHexOpacity(rgba: string): {
  hex: string;
  opacity: number;
} {
  const { r, g, b, a } = parseRgba(rgba);
  return {
    hex: rgbToHex(r, g, b),
    opacity: Math.round(a * 100)
  };
}
