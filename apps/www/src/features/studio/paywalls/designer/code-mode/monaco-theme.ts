import type * as monaco from "monaco-editor";

/**
 * Voidhash-branded Monaco themes for the paywall code editor.
 *
 * Colors are the sRGB resolutions of the OKLCH brand palette in
 * `packages/ui/styles/brand-theme.css`. Syntax hues follow a fixed role→family
 * mapping (violet keywords, green strings, amber numbers, blue types, fuchsia
 * regex/escapes, red invalids) so the light and dark variants read as the same
 * theme at different lightness.
 *
 * Scope note: monaco-editor's bundled TypeScript mode ships only the Monarch
 * grammar and registers no document-semantic-tokens provider, so identifiers
 * are colored purely lexically — `type.identifier` (any capitalized name: types,
 * classes, JSX components) vs `identifier` (everything else). Distinct colors
 * for functions/properties/parameters would require registering a custom
 * `DocumentSemanticTokensProvider` backed by an extended TS worker that exposes
 * `getEncodedSemanticClassifications` (encoding: `type = value >> 8`,
 * `modifiers = value & 255`); the stock worker proxy does not expose it.
 */

/** Brand palette (subset used by the themes), stored with a leading `#`. */
const P = {
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

export const VOIDHASH_DARK_THEME = "voidhash-dark";
export const VOIDHASH_LIGHT_THEME = "voidhash-light";

/**
 * Per-role syntax colors. Only roles that the Monarch TypeScript grammar
 * actually emits are represented. Shades differ per variant; roles do not.
 */
interface SyntaxRoles {
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

/** Monaco token rules expect `RRGGBB` (no leading `#`). */
const bare = (hex: string): string => hex.replace("#", "");

/**
 * Builds the token-rule table from a variant's role palette. Every token here
 * is emitted by monaco's bundled TypeScript Monarch tokenizer.
 */
function tokenRules(r: SyntaxRoles): monaco.editor.ITokenThemeRule[] {
  const rule = (token: string, color: string, fontStyle?: string) =>
    fontStyle ? { token, foreground: bare(color), fontStyle } : { token, foreground: bare(color) };

  return [
    // Comments
    rule("comment", r.comment, "italic"),
    rule("comment.doc", r.comment, "italic"),
    // Keywords / storage (const, function, import, typeof, namespace, …)
    rule("keyword", r.keyword),
    rule("keyword.other", r.keyword),
    // Strings
    rule("string", r.string),
    rule("string.escape", r.escape),
    rule("string.invalid", r.invalid),
    rule("string.escape.invalid", r.invalid),
    // Numbers
    rule("number", r.number),
    rule("number.hex", r.number),
    rule("number.float", r.number),
    rule("number.binary", r.number),
    rule("number.octal", r.number),
    // Regular expressions
    rule("regexp", r.regexp),
    rule("regexp.escape", r.escape),
    rule("regexp.escape.control", r.escape),
    rule("regexp.invalid", r.invalid),
    // Capitalized identifiers: types, classes, enums, JSX component tags
    rule("type", r.type),
    rule("type.identifier", r.type),
    // Punctuation, operators and brackets (all emitted as `delimiter*`)
    rule("delimiter", r.punctuation),
    rule("delimiter.bracket", r.punctuation),
    // Everything else (variables, function names, props, params)
    rule("identifier", r.variable),
  ];
}

const darkRoles: SyntaxRoles = {
  comment: P.zinc500,
  keyword: P.violet300,
  string: P.pistachio300,
  escape: P.fuchsia400,
  number: P.amber300,
  regexp: P.fuchsia300,
  type: P.blue300,
  punctuation: P.zinc400,
  variable: P.zinc100,
  invalid: P.red400,
};

const lightRoles: SyntaxRoles = {
  comment: P.zinc500,
  keyword: P.violet700,
  string: P.pistachio800,
  escape: P.fuchsia700,
  number: P.amber800,
  regexp: P.fuchsia700,
  type: P.blue700,
  // Distinct from `comment` (also a gray) so delimiters and trailing comments
  // never collapse to one hue in light mode.
  punctuation: P.zinc600,
  variable: P.zinc900,
  invalid: P.red600,
};

const darkTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: tokenRules(darkRoles),
  colors: {
    "editor.background": P.zinc950,
    "editor.foreground": P.zinc200,
    "editorCursor.foreground": P.blue500,
    "editorLineNumber.foreground": P.zinc500,
    "editorLineNumber.activeForeground": P.zinc200,
    "editor.lineHighlightBackground": "#18181880",
    "editor.selectionBackground": "#0d419b66",
    "editor.inactiveSelectionBackground": "#0d419b33",
    "editor.selectionHighlightBackground": "#1e93ff26",
    "editor.wordHighlightBackground": "#1e93ff1f",
    "editor.wordHighlightStrongBackground": "#0673ff33",
    "editor.findMatchBackground": "#ffbf0066",
    "editor.findMatchHighlightBackground": "#ffbf0033",
    "editorIndentGuide.background1": P.zinc800,
    "editorIndentGuide.activeBackground1": P.zinc600,
    "editorWhitespace.foreground": P.zinc800,
    "editorGutter.background": P.zinc950,
    "editorBracketMatch.background": "#1e93ff20",
    "editorBracketMatch.border": P.blue500,
    "editorBracketHighlight.foreground1": P.blue400,
    "editorBracketHighlight.foreground2": P.violet400,
    "editorBracketHighlight.foreground3": P.fuchsia400,
    "editorBracketHighlight.foreground4": P.amber400,
    "editorBracketHighlight.foreground5": P.pistachio400,
    "editorBracketHighlight.foreground6": P.orange400,
    "editorBracketHighlight.unexpectedBracket.foreground": P.red500,
    "editorError.foreground": P.red500,
    "editorWarning.foreground": P.amber500,
    "editorInfo.foreground": P.blue400,
    "editorHint.foreground": P.violet400,
    "editorGutter.modifiedBackground": P.blue500,
    "editorGutter.addedBackground": P.pistachio600,
    "editorGutter.deletedBackground": P.red500,
    "editorWidget.background": P.zinc900,
    "editorWidget.foreground": P.zinc200,
    "editorWidget.border": P.zinc800,
    "editorHoverWidget.background": P.zinc900,
    "editorHoverWidget.border": P.zinc800,
    "editorSuggestWidget.background": P.zinc900,
    "editorSuggestWidget.foreground": P.zinc200,
    "editorSuggestWidget.border": P.zinc800,
    "editorSuggestWidget.selectedBackground": P.blue950,
    "editorSuggestWidget.highlightForeground": P.blue400,
    "list.hoverBackground": P.zinc800,
    "list.focusBackground": P.blue950,
    "input.background": P.zinc800,
    "input.foreground": P.zinc100,
    "input.border": P.zinc700,
    "focusBorder": P.blue600,
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#40404080",
    "scrollbarSlider.hoverBackground": "#535353aa",
    "scrollbarSlider.activeBackground": "#727272aa",
    "minimap.background": P.zinc950,
    "editorOverviewRuler.border": "#00000000",
    "editorOverviewRuler.errorForeground": P.red500,
    "editorOverviewRuler.warningForeground": P.amber500,
  },
};

const lightTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: tokenRules(lightRoles),
  colors: {
    "editor.background": P.white,
    "editor.foreground": P.zinc900,
    "editorCursor.foreground": P.blue600,
    "editorLineNumber.foreground": P.zinc500,
    "editorLineNumber.activeForeground": P.zinc700,
    "editor.lineHighlightBackground": "#f4f4f480",
    "editor.selectionBackground": "#83d1ff66",
    "editor.inactiveSelectionBackground": "#83d1ff33",
    "editor.selectionHighlightBackground": "#0673ff1f",
    "editor.wordHighlightBackground": "#0673ff17",
    "editor.wordHighlightStrongBackground": "#0673ff26",
    "editor.findMatchBackground": "#ffbf0088",
    "editor.findMatchHighlightBackground": "#ffdf1b66",
    "editorIndentGuide.background1": P.zinc200,
    "editorIndentGuide.activeBackground1": P.zinc400,
    "editorWhitespace.foreground": P.zinc300,
    "editorGutter.background": P.white,
    "editorBracketMatch.background": "#0673ff17",
    "editorBracketMatch.border": P.blue500,
    "editorBracketHighlight.foreground1": P.blue700,
    "editorBracketHighlight.foreground2": P.violet700,
    "editorBracketHighlight.foreground3": P.fuchsia700,
    "editorBracketHighlight.foreground4": P.amber800,
    "editorBracketHighlight.foreground5": P.pistachio700,
    "editorBracketHighlight.foreground6": P.orange700,
    "editorBracketHighlight.unexpectedBracket.foreground": P.red600,
    "editorError.foreground": P.red600,
    "editorWarning.foreground": P.amber700,
    "editorInfo.foreground": P.blue600,
    "editorHint.foreground": P.violet700,
    "editorGutter.modifiedBackground": P.blue500,
    "editorGutter.addedBackground": P.pistachio700,
    "editorGutter.deletedBackground": P.red600,
    "editorWidget.background": P.zinc50,
    "editorWidget.foreground": P.zinc900,
    "editorWidget.border": P.zinc200,
    "editorHoverWidget.background": P.white,
    "editorHoverWidget.border": P.zinc200,
    "editorSuggestWidget.background": P.white,
    "editorSuggestWidget.foreground": P.zinc900,
    "editorSuggestWidget.border": P.zinc200,
    "editorSuggestWidget.selectedBackground": P.blue50,
    "editorSuggestWidget.highlightForeground": P.blue600,
    "list.hoverBackground": P.zinc100,
    "list.focusBackground": P.blue50,
    "input.background": P.white,
    "input.foreground": P.zinc900,
    "input.border": P.zinc200,
    "focusBorder": P.blue500,
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#a0a0a066",
    "scrollbarSlider.hoverBackground": "#72727288",
    "scrollbarSlider.activeBackground": "#53535388",
    "minimap.background": P.white,
    "editorOverviewRuler.border": "#00000000",
    "editorOverviewRuler.errorForeground": P.red600,
    "editorOverviewRuler.warningForeground": P.amber700,
  },
};

let themesDefined = false;

/**
 * Registers the Voidhash light/dark Monaco themes. Idempotent — safe to call on
 * every editor mount; the definitions are applied to the shared monaco instance
 * once.
 */
export function defineVoidhashThemes(m: typeof monaco): void {
  if (themesDefined) {
    return;
  }
  themesDefined = true;
  m.editor.defineTheme(VOIDHASH_DARK_THEME, darkTheme);
  m.editor.defineTheme(VOIDHASH_LIGHT_THEME, lightTheme);
}

/**
 * Maps a `next-themes` resolved theme to the matching Voidhash Monaco theme.
 * Defaults to dark (the app's default theme).
 */
export function voidhashThemeFor(resolvedTheme: string | undefined): string {
  return resolvedTheme === "light" ? VOIDHASH_LIGHT_THEME : VOIDHASH_DARK_THEME;
}
