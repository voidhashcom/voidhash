import {
  type SyntaxRoles,
  darkBase,
  darkSyntaxRoles,
  lightBase,
  lightSyntaxRoles,
} from "../../../lib/code-theme.ts";

/**
 * Voidhash Shiki themes for documentation code blocks.
 *
 * These mirror the paywall designer's Monaco editor themes: both derive their
 * palette and per-role mapping from `@/lib/code-theme`, so a snippet in the docs
 * is colored exactly as it would be in the in-app code editor. This module maps
 * those roles onto Shiki's TextMate scopes.
 *
 * The mapping is deliberately coarse to match Monaco's lexical coloring: types
 * and other capitalized names are blue, everything else (functions, properties,
 * parameters, variables) falls back to the default foreground rather than
 * getting its own hue. Operators and template/brace punctuation are grouped with
 * delimiters (gray), while `new`/`typeof`/`instanceof` stay keyword-violet —
 * TextMate resolves these by scope specificity.
 */

interface ThemeInput {
  name: string;
  type: "light" | "dark";
  roles: SyntaxRoles;
  base: { background: string; foreground: string };
}

interface TokenColor {
  scope: string[];
  settings: { foreground?: string; fontStyle?: string };
}

function tokenColors(r: SyntaxRoles): TokenColor[] {
  return [
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: r.comment, fontStyle: "italic" },
    },
    {
      // Keywords and storage. `constant.language` (true/false/null/undefined)
      // and `variable.language` (this/super) read as keywords in Monaco too.
      scope: [
        "keyword",
        "keyword.control",
        "keyword.other",
        "keyword.operator.new",
        "keyword.operator.expression",
        "keyword.operator.logical",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language",
        "constant.language",
      ],
      settings: { foreground: r.keyword },
    },
    {
      scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"],
      settings: { foreground: r.string },
    },
    {
      scope: ["constant.character.escape", "constant.other.placeholder"],
      settings: { foreground: r.escape },
    },
    {
      scope: ["constant.numeric"],
      settings: { foreground: r.number },
    },
    {
      scope: ["string.regexp"],
      settings: { foreground: r.regexp },
    },
    {
      // Types, classes, enums, interfaces, primitive type annotations and tags
      // (JSX component + HTML) — any capitalized/type-position name.
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.other.inherited-class",
        "support.type",
        "support.class",
        "entity.name.tag",
        "support.class.component",
      ],
      settings: { foreground: r.type },
    },
    {
      // Delimiters and operators. More specific than the bare `keyword`/`storage`
      // rules above, so `=>`, `${…}`, braces and arithmetic/assignment operators
      // resolve to gray while `new`/`typeof` stay keyword-colored.
      scope: [
        "punctuation",
        "meta.brace",
        "meta.delimiter",
        "keyword.operator",
        "storage.type.function.arrow",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.accessor",
        "punctuation.definition.template-expression",
        "punctuation.definition.tag",
      ],
      settings: { foreground: r.punctuation },
    },
    {
      // Identifiers Monaco leaves at the default foreground: variables, function
      // names, parameters, object/JSON/YAML keys and properties. Kept explicit
      // (rather than relying on fallback) so `support.type.property-name` does
      // not inherit the blue `support.type` rule.
      scope: [
        "variable",
        "variable.other",
        "variable.parameter",
        "entity.name.function",
        "support.function",
        "meta.object-literal.key",
        "support.variable.property",
        "variable.other.property",
        "support.type.property-name",
      ],
      settings: { foreground: r.variable },
    },
    {
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: r.invalid },
    },
  ];
}

function buildTheme({ name, type, roles, base }: ThemeInput) {
  return {
    name,
    type,
    colors: {
      "editor.background": base.background,
      "editor.foreground": base.foreground,
    },
    // Shiki reads these top-level fields for the container fallback color.
    bg: base.background,
    fg: base.foreground,
    tokenColors: tokenColors(roles),
  };
}

export const voidhashShikiDark = buildTheme({
  name: "voidhash-dark",
  type: "dark",
  roles: darkSyntaxRoles,
  base: darkBase,
});

export const voidhashShikiLight = buildTheme({
  name: "voidhash-light",
  type: "light",
  roles: lightSyntaxRoles,
  base: lightBase,
});
