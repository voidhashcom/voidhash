import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0;
    // biome-ignore lint/nursery/noBitwiseOperators: required
    hash = (hash << 5) - hash + char;
    // biome-ignore lint/style/useShorthandAssign: required
    // biome-ignore lint/nursery/noBitwiseOperators: required
    hash &= hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
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
  let hex = "#";
  for (const value of RGBArray) {
    if (value < 16) {
      hex += 0;
    }
    hex += value.toString(16);
  }
  return hex;
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
      hue?:
        | number
        | { max: number; min: number }
        | { max: number; min: number }[];
      hash?: string | ((str: string) => number);
    } = {}
  ) {
    const [L, S] = [options.lightness, options.saturation].map((param) => {
      const paramValue = param !== undefined ? param : [0.35, 0.5, 0.65]; // note that 3 is a prime
      return Array.isArray(paramValue) ? paramValue.concat() : [paramValue];
    });

    // biome-ignore lint/style/noNonNullAssertion: required
    this.L = L!;
    // biome-ignore lint/style/noNonNullAssertion: required
    this.S = S!;

    if (typeof options.hue === "number") {
      options.hue = { max: options.hue, min: options.hue };
    }
    if (typeof options.hue === "object" && !Array.isArray(options.hue)) {
      options.hue = [options.hue];
    }
    if (typeof options.hue === "undefined") {
      options.hue = [];
    }
    this.hueRanges = options.hue.map((range) => ({
      max: typeof range.max === "undefined" ? 360 : range.max,
      min: typeof range.min === "undefined" ? 0 : range.min,
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
    // biome-ignore lint/style/useConst: let me live
    let S: number;
    // biome-ignore lint/style/useConst: let me live
    let L: number;

    if (this.hueRanges.length) {
      // biome-ignore lint/style/noNonNullAssertion: required
      const range = this.hueRanges[hash % this.hueRanges.length]!;
      H =
        (((hash / this.hueRanges.length) % hueResolution) *
          (range.max - range.min)) /
          hueResolution +
        range.min;
    } else {
      H = hash % 359;
    }
    hash = Math.ceil(hash / 360);
    // biome-ignore lint/style/noNonNullAssertion: required
    S = this.S[hash % this.S.length]!;
    hash = Math.ceil(hash / this.S.length);
    // biome-ignore lint/style/noNonNullAssertion: required
    L = this.L[hash % this.L.length]!;

    // biome-ignore lint/style/noNonNullAssertion: required
    return [H, S!, L!];
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

  hexPair(str: string) {
    const s1Hsl = this.hsl(str);
    const s2Hsl = [(s1Hsl[0] + 87) % 360, s1Hsl[1], s1Hsl[2]];
    const rgb1 = HSL2RGB.apply(this, s1Hsl);
    const rgb2 = HSL2RGB.apply(this, s2Hsl as [number, number, number]);
    const hex1 = RGB2HEX(rgb1);
    const hex2 = RGB2HEX(rgb2);
    return [hex1, hex2];
  }
}

const colorHash = new ColorHash({ saturation: 1 });

const stringToColours = (s: string): string[] => colorHash.hexPair(s);

const generateColours = (s: string): [string, string] => {
  const s1 = s.slice(0, s.length / 2);
  const [c1, c2] = stringToColours(s1);
  // biome-ignore lint/style/noNonNullAssertion: required
  return [c1!, c2!];
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
    <Avatar className={className}>
      {src ? (
        <AvatarImage alt={alt} src={avatarSrc} />
      ) : (
        // biome-ignore lint/performance/noImgElement: custom image loading
        <img alt={alt} src={avatarSrc} />
      )}
      <AvatarFallback>{fallback?.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
