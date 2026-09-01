import * as P from "effect/Predicate";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function simpleHash(str: string): number {
  return Math.abs(
    Array.from({ length: str.length }, (_, index) => index).reduce((hash, index) => {
      const char = str.codePointAt(index) ?? 0;
      const next = (hash << 5) - hash + char;
      return next | 0;
    }, 0),
  );
}

/**
 * Convert HSL to RGB
 *
 * @see {@link http://zh.wikipedia.org/wiki/HSL和HSV色彩空间} for further information.
 * @param {Number} H Hue ∈ [0, 360)
 * @param {Number} S Saturation ∈ [0, 1]
 * @param {Number} L Lightness ∈ [0, 1]
 * @returns {Array} R, G, B ∈ [0, 255]
 */
const HSL2RGB = (HBase: number, S: number, L: number) => {
  const H = HBase / 360;

  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;

  return [H + 1 / 3, H, H - 1 / 3].map((c) => {
    let color = c; // To prevent parameter assignment
    if (color < 0) {
      color++;
    }
    if (color > 1) {
      color--;
    }
    if (color < 1 / 6) {
      color = p + (q - p) * 6 * color;
    } else if (color < 0.5) {
      color = q;
    } else if (color < 2 / 3) {
      color = p + (q - p) * 6 * (2 / 3 - color);
    } else {
      color = p;
    }
    return Math.round(color * 255);
  });
};

/**
 * Convert RGB Array to HEX
 *
 * @param {Array} RGBArray - [R, G, B]
 * @returns {String} 6 digits hex starting with #
 */
const RGB2HEX = (RGBArray: number[]) => {
  return `#${RGBArray.map((value) => `${value < 16 ? "0" : ""}${value.toString(16)}`).join("")}`;
};

class ColorHash {
  L: number[];
  S: number[];
  hueRanges: { max: number; min: number }[];
  // hash: (str: string) => number;

  constructor(
    options: {
      lightness?: number | number[];
      saturation?: number | number[];
      hue?: number | { max: number; min: number } | { max: number; min: number }[];
      hash?: string | ((str: string) => number);
    } = {},
  ) {
    const lightness = options.lightness ?? [0.35, 0.5, 0.65];
    const saturation = options.saturation ?? [0.35, 0.5, 0.65];
    this.L = Array.isArray(lightness) ? [...lightness] : [lightness];
    this.S = Array.isArray(saturation) ? [...saturation] : [saturation];

    if (P.isNumber(options.hue)) {
      options.hue = { max: options.hue, min: options.hue };
    }
    if (P.isObject(options.hue) && !Array.isArray(options.hue)) {
      options.hue = [options.hue];
    }
    if (P.isUndefined(options.hue)) {
      options.hue = [];
    }
    this.hueRanges = options.hue.map((range) => ({
      max: P.isUndefined(range.max) ? 360 : range.max,
      min: P.isUndefined(range.min) ? 0 : range.min,
    }));
  }

  /**
   * Returns the hash in [h, s, l].
   * Note that H ∈ [0, 360); S ∈ [0, 1]; L ∈ [0, 1];
   *
   * @param {String} str string to hash
   * @returns {Array} [h, s, l]
   */
  hsl(str: string): [number, number, number] {
    let hash = simpleHash(str);
    const hueResolution = 727;
    let H: number;
    let S: number;
    let L: number;

    if (this.hueRanges.length) {
      const range = this.hueRanges[hash % this.hueRanges.length] ?? { max: 360, min: 0 };
      H =
        (((hash / this.hueRanges.length) % hueResolution) * (range.max - range.min)) /
          hueResolution +
        range.min;
    } else {
      H = hash % 359;
    }
    hash = Math.ceil(hash / 360);
    S = this.S[hash % this.S.length] ?? 0.5;
    hash = Math.ceil(hash / this.S.length);
    L = this.L[hash % this.L.length] ?? 0.5;

    return [H, S, L];
  }

  /**
   * Returns the hash in [r, g, b].
   * Note that R, G, B ∈ [0, 255]
   *
   * @param {String} str string to hash
   * @returns {Array} [r, g, b]
   */
  rgb(str: string) {
    const hsl = this.hsl(str);
    return HSL2RGB.apply(this, hsl);
  }

  /**
   * Returns the hash in hex
   *
   * @param {String} str string to hash
   * @returns {String} hex with #
   */
  hex(str: string) {
    const rgb = this.rgb(str);
    return RGB2HEX(rgb);
  }

  hexPair(str: string): [string, string] {
    const s1Hsl = this.hsl(str);
    const s2Hsl: [number, number, number] = [(s1Hsl[0] + 87) % 360, s1Hsl[1], s1Hsl[2]];
    const rgb1 = HSL2RGB.apply(this, s1Hsl);
    const rgb2 = HSL2RGB.apply(this, s2Hsl);
    const hex1 = RGB2HEX(rgb1);
    const hex2 = RGB2HEX(rgb2);
    return [hex1, hex2];
  }
}

const colorHash = new ColorHash({ saturation: 1 });

const stringToColours = (s: string): [string, string] => colorHash.hexPair(s);

const generateColours = (s: string): [string, string] => {
  const s1 = s.slice(0, s.length / 2);
  const [c1, c2] = stringToColours(s1);
  return [c1, c2];
};

const generateDataUrl = (s: string): string => {
  const [c1, c2] = generateColours(s ?? "null");
  const size = 256;
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#gradient)" />
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${c1}" />
      <stop offset="1" stop-color="${c2}" />
    </linearGradient>
  </defs>
</svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export function GradientAvatar({
  src,
  className,
  alt,
  fallback,
  gradientUrl,
}: {
  src?: string;
  className?: string;
  alt: string;
  fallback: string;
  gradientUrl?: string;
}) {
  // Generate gradient data URL if no src or gradientUrl is provided
  const avatarSrc = src ?? gradientUrl ?? generateDataUrl(fallback);

  return (
    // Avatars are always circular — force `rounded-full` to win over any
    // `rounded-*` a call site passes (the root's `overflow-hidden` clips the
    // image/gradient to the circle).
    <Avatar className={cn(className, "rounded-full")}>
      {src ? (
        <AvatarImage alt={alt} src={avatarSrc} />
      ) : (
        <img alt={alt} className="aspect-square size-full" src={avatarSrc} />
      )}
      <AvatarFallback>{fallback?.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
