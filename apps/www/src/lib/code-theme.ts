/**
 * Shared source of truth for Voidhash code-syntax coloring.
 *
 * Both the paywall designer's Monaco editor themes
 * (`features/studio/paywalls/designer/code-mode/monaco-theme.ts`) and the
 * documentation site's Shiki themes (`features/docs/lib/shiki-theme.ts`) derive
 * their colors from the palette and per-role mapping defined here, so the two
 * surfaces render code identically.
 *
 * Colors are the sRGB resolutions of the OKLCH brand palette in
 * `packages/ui/styles/brand-theme.css`. Syntax hues follow a fixed role→family
 * mapping (violet keywords, green strings, amber numbers, blue types, fuchsia
 * regex/escapes, red invalids) so the light and dark variants read as the same
 * theme at different lightness.
 */

/** Brand palette (subset used by the code themes), stored with a leading `#`. */
export const CODE_PALETTE = {
  white: "#ffffff",
  zinc50: "#fafafa",
  zinc100: "#f4f4f4",
  zinc200: "#e4e4e4",
  zinc300: "#d4d4d4",
  zinc400: "#a0a0a0",
  zinc500: "#727272",
  zinc600: "#535353",
  zinc700: "#404040",
  zinc800: "#272727",
  zinc900: "#181818",
  zinc950: "#101010",
  blue50: "#edf8ff",
  blue300: "#83d1ff",
  blue400: "#48b7ff",
  blue500: "#1e93ff",
  blue600: "#0673ff",
  blue700: "#005eff",
  blue950: "#0e285d",
  violet300: "#c0a6ff",
  violet400: "#a373ff",
  violet700: "#7000f0",
  fuchsia300: "#f49cff",
  fuchsia400: "#ef61ff",
  fuchsia700: "#ab00cb",
  red400: "#ff5d78",
  red500: "#ff244f",
  red600: "#f00040",
  orange400: "#ff9d32",
  orange700: "#cc4902",
  amber400: "#ffdf1b",
  amber500: "#ffbf00",
  amber700: "#bb6802",
  amber800: "#985008",
  amber300: "#ffed46",
  pistachio300: "#dffe58",
  pistachio400: "#ccf526",
  pistachio600: "#91bd00",
  pistachio700: "#658506",
  pistachio800: "#51690b",
} as const;

/**
 * Per-role syntax colors. Roles map onto both Monaco's Monarch token names and
 * Shiki's TextMate scopes. Shades differ per variant; the role→family mapping
 * does not.
 */
export interface SyntaxRoles {
  comment: string;
  keyword: string;
  string: string;
  escape: string;
  number: string;
  regexp: string;
  type: string;
  punctuation: string;
  variable: string;
  invalid: string;
}

export const darkSyntaxRoles: SyntaxRoles = {
  comment: CODE_PALETTE.zinc500,
  keyword: CODE_PALETTE.violet300,
  string: CODE_PALETTE.pistachio300,
  escape: CODE_PALETTE.fuchsia400,
  number: CODE_PALETTE.amber300,
  regexp: CODE_PALETTE.fuchsia300,
  type: CODE_PALETTE.blue300,
  punctuation: CODE_PALETTE.zinc400,
  variable: CODE_PALETTE.zinc100,
  invalid: CODE_PALETTE.red400,
};

export const lightSyntaxRoles: SyntaxRoles = {
  comment: CODE_PALETTE.zinc500,
  keyword: CODE_PALETTE.violet700,
  string: CODE_PALETTE.pistachio800,
  escape: CODE_PALETTE.fuchsia700,
  number: CODE_PALETTE.amber800,
  regexp: CODE_PALETTE.fuchsia700,
  type: CODE_PALETTE.blue700,
  // Distinct from `comment` (also a gray) so delimiters and trailing comments
  // never collapse to one hue in light mode.
  punctuation: CODE_PALETTE.zinc600,
  variable: CODE_PALETTE.zinc900,
  invalid: CODE_PALETTE.red600,
};

/** Editor/canvas base colors (background + default foreground) per variant. */
export const darkBase = {
  background: CODE_PALETTE.zinc950,
  foreground: CODE_PALETTE.zinc200,
} as const;

export const lightBase = {
  background: CODE_PALETTE.white,
  foreground: CODE_PALETTE.zinc900,
} as const;
