import brandThemeCss from "@voidhash/ui/styles/brand-theme.css?raw";

export type ThemeName = "light" | "dark";

export interface ResolvedToken {
  /** Final color value with every `var()` indirection followed. */
  value: string;
  /** The variable this token points at, when it is defined as an alias. */
  alias?: string;
}

export interface SemanticToken {
  /** Custom property name without the leading dashes, e.g. `primary`. */
  name: string;
  /** What the token is for and when to reach for it. */
  meaning: string;
  /** Tailwind utilities that map onto this token. */
  utilities: string[];
  /** Token used for text/icons placed on top of this one, if there is a pair. */
  on?: string;
}

export interface SemanticGroup {
  title: string;
  description: string;
  tokens: SemanticToken[];
}

export interface BrandScale {
  /** Custom property prefix, e.g. `blue-ribbon` for `--blue-ribbon-500`. */
  prefix: string;
  title: string;
  meaning: string;
}

const SELECTOR_LIGHT = ":root";
const SELECTOR_DARK = ".dark";
const ALIAS_PATTERN = /^var\((--[\w-]+)\)$/;

/**
 * Reads the custom properties declared in a single flat rule block. The brand
 * theme keeps `:root` and `.dark` free of nested rules, so a brace scan is
 * enough — no CSS parser needed.
 */
const readDeclarations = (css: string, selector: string): Record<string, string> => {
  const selectorStart = css.indexOf(`${selector} {`);
  if (selectorStart === -1) {
    return {};
  }

  const blockStart = css.indexOf("{", selectorStart);
  const blockEnd = css.indexOf("}", blockStart);
  const declarations: Record<string, string> = {};

  for (const declaration of css.slice(blockStart + 1, blockEnd).split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const name = declaration.slice(0, separator).trim();
    if (name.startsWith("--")) {
      declarations[name] = declaration.slice(separator + 1).trim();
    }
  }

  return declarations;
};

const LIGHT_DECLARATIONS = readDeclarations(brandThemeCss, SELECTOR_LIGHT);
const DARK_DECLARATIONS = {
  ...LIGHT_DECLARATIONS,
  ...readDeclarations(brandThemeCss, SELECTOR_DARK),
};

const declarationsFor = (theme: ThemeName) =>
  theme === "dark" ? DARK_DECLARATIONS : LIGHT_DECLARATIONS;

const follow = (declarations: Record<string, string>, value: string, depth = 0): string => {
  const alias = ALIAS_PATTERN.exec(value);
  const target = alias ? declarations[alias[1]] : undefined;
  if (!target || depth > 10) {
    return value;
  }

  return follow(declarations, target, depth + 1);
};

/**
 * Resolves a theme token to its literal color, following alias chains such as
 * `--primary` → `--blue-ribbon-600` → `oklch(…)`. Returns `undefined` when the
 * token is not declared for the given theme.
 */
export const resolveToken = (name: string, theme: ThemeName): ResolvedToken | undefined => {
  const declarations = declarationsFor(theme);
  const raw = declarations[`--${name}`];
  if (!raw) {
    return undefined;
  }

  const alias = ALIAS_PATTERN.exec(raw);
  return {
    alias: alias?.[1],
    value: follow(declarations, raw),
  };
};

/** Lists the steps declared for a scale prefix, ordered light to dark. */
export const scaleSteps = (prefix: string): number[] =>
  Object.keys(LIGHT_DECLARATIONS)
    .map((name) => {
      const match = new RegExp(`^--${prefix}-(\\d+)$`).exec(name);
      return match ? Number(match[1]) : undefined;
    })
    .filter((step): step is number => step !== undefined)
    .sort((a, b) => a - b);

/**
 * Estimates whether a color is light enough to need dark text on top. Handles
 * the two literal formats used by the theme: `oklch(L% C H)` and hex.
 */
export const isLightColor = (value: string): boolean => {
  const oklch = /^oklch\(\s*([\d.]+)%/.exec(value);
  if (oklch) {
    return Number(oklch[1]) >= 62;
  }

  const hex = /^#([\da-f]{6})$/i.exec(value);
  if (hex) {
    const int = Number.parseInt(hex[1], 16);
    const luminance =
      (0.2126 * ((int >> 16) & 0xff) + 0.7152 * ((int >> 8) & 0xff) + 0.0722 * (int & 0xff)) / 255;
    return luminance >= 0.55;
  }

  return true;
};

export const SEMANTIC_GROUPS: SemanticGroup[] = [
  {
    description:
      "The stack of neutral surfaces, from the page canvas up to floating layers. Pick the one that matches how far the element is lifted off the page, not the color you want.",
    title: "Surfaces",
    tokens: [
      {
        meaning:
          "The app canvas. Everything else sits on top of it. Set once on `body` — components should not repaint it.",
        name: "background",
        on: "foreground",
        utilities: ["bg-background"],
      },
      {
        meaning:
          "A neutral surface raised off the canvas: toolbars, inspector rails, list rows that need separation without a card border.",
        name: "surface",
        on: "foreground",
        utilities: ["bg-surface"],
      },
      {
        meaning:
          "A recessed surface for wells and tracks — slider rails, progress backgrounds, inset code blocks.",
        name: "surface-muted",
        on: "foreground",
        utilities: ["bg-surface-muted"],
      },
      {
        meaning:
          "Content containers. Use with `--border` for the outline; in dark mode it reads lighter than the canvas so cards float.",
        name: "card",
        on: "card-foreground",
        utilities: ["bg-card"],
      },
      {
        meaning: "Text and icons inside a card.",
        name: "card-foreground",
        utilities: ["text-card-foreground"],
      },
      {
        meaning:
          "App chrome around the workspace — designer and editor panels. Slightly darker than `--card` in dark mode so tooling recedes behind content.",
        name: "panel",
        on: "foreground",
        utilities: ["bg-panel"],
      },
      {
        meaning:
          "Layers that float above the page: dropdowns, menus, tooltips, comboboxes, date pickers.",
        name: "popover",
        on: "popover-foreground",
        utilities: ["bg-popover"],
      },
      {
        meaning: "Text and icons inside a popover layer.",
        name: "popover-foreground",
        utilities: ["text-popover-foreground"],
      },
    ],
  },
  {
    description:
      "Text and icon colors. Body copy is `--foreground`; anything quieter steps down to `--muted-foreground` rather than lowering opacity.",
    title: "Content",
    tokens: [
      {
        meaning: "Default body text, headings, and icons on the canvas.",
        name: "foreground",
        utilities: ["text-foreground"],
      },
      {
        meaning:
          "Secondary text: labels, helper copy, placeholders, timestamps, inactive icons. The lowest-emphasis text that still meets contrast.",
        name: "muted-foreground",
        utilities: ["text-muted-foreground"],
      },
      {
        meaning:
          "Quiet neutral fill for badges, skeletons, disabled controls, and hovered table rows.",
        name: "muted",
        on: "muted-foreground",
        utilities: ["bg-muted"],
      },
    ],
  },
  {
    description:
      "Interactive intent. One primary action per view; everything competing with it drops to secondary or ghost styling.",
    title: "Actions",
    tokens: [
      {
        meaning:
          "The primary action and brand accent — solid buttons, selected states, links, active nav items.",
        name: "primary",
        on: "primary-foreground",
        utilities: ["bg-primary", "text-primary", "border-primary"],
      },
      {
        meaning: "Text and icons on a primary fill. Stays white in both themes.",
        name: "primary-foreground",
        utilities: ["text-primary-foreground"],
      },
      {
        meaning: "Neutral, lower-emphasis actions that sit next to a primary button.",
        name: "secondary",
        on: "secondary-foreground",
        utilities: ["bg-secondary"],
      },
      {
        meaning: "Text and icons on a secondary fill.",
        name: "secondary-foreground",
        utilities: ["text-secondary-foreground"],
      },
      {
        meaning:
          "Hover and highlight state for list-like surfaces: menu items, command results, sidebar rows, ghost buttons.",
        name: "accent",
        on: "accent-foreground",
        utilities: ["bg-accent", "hover:bg-accent"],
      },
      {
        meaning: "Text and icons on an accent highlight.",
        name: "accent-foreground",
        utilities: ["text-accent-foreground"],
      },
    ],
  },
  {
    description:
      "Status colors. Reserved for outcomes and risk — never used decoratively, so their appearance always carries meaning.",
    title: "Feedback",
    tokens: [
      {
        meaning:
          "Destructive and irreversible actions, error states, invalid fields. Pair with a confirmation for anything unrecoverable.",
        name: "destructive",
        on: "destructive-foreground",
        utilities: ["bg-destructive", "text-destructive", "border-destructive"],
      },
      {
        meaning: "Text and icons on a destructive fill.",
        name: "destructive-foreground",
        utilities: ["text-destructive-foreground"],
      },
      {
        meaning: "Successful outcomes and healthy status — completed steps, live deployments.",
        name: "success",
        on: "success-foreground",
        utilities: ["bg-success", "text-success"],
      },
      {
        meaning: "Text and icons on a success fill.",
        name: "success-foreground",
        utilities: ["text-success-foreground"],
      },
    ],
  },
  {
    description:
      "Hairlines, control outlines, and focus. These are the only tokens allowed to draw structure — do not fake borders with a background color.",
    title: "Borders and focus",
    tokens: [
      {
        meaning:
          "Default hairline between surfaces. Applied globally by the base layer, so most elements inherit it without a border utility.",
        name: "border",
        utilities: ["border-border"],
      },
      {
        meaning: "Outline of form controls — inputs, textareas, selects, checkboxes.",
        name: "input",
        utilities: ["border-input"],
      },
      {
        meaning:
          "Keyboard focus ring. The base layer renders it at 50% opacity (`outline-ring/50`), so focus reads clearly without shouting.",
        name: "ring",
        utilities: ["ring-ring", "outline-ring/50"],
      },
    ],
  },
  {
    description:
      "The sidebar runs its own surface stack so navigation can go darker than the app without dragging the rest of the UI with it.",
    title: "Sidebar",
    tokens: [
      {
        meaning: "Sidebar background. Pure black in dark mode, pinning navigation to the far edge.",
        name: "sidebar",
        on: "sidebar-foreground",
        utilities: ["bg-sidebar"],
      },
      {
        meaning: "Sidebar labels and icons.",
        name: "sidebar-foreground",
        utilities: ["text-sidebar-foreground"],
      },
      {
        meaning:
          "Active navigation item. Deliberately neutral rather than brand blue so the sidebar does not compete with in-page primary actions.",
        name: "sidebar-primary",
        on: "sidebar-primary-foreground",
        utilities: ["bg-sidebar-primary"],
      },
      {
        meaning: "Text on an active navigation item.",
        name: "sidebar-primary-foreground",
        utilities: ["text-sidebar-primary-foreground"],
      },
      {
        meaning: "Hovered navigation item.",
        name: "sidebar-accent",
        on: "sidebar-accent-foreground",
        utilities: ["bg-sidebar-accent"],
      },
      {
        meaning: "Text on a hovered navigation item.",
        name: "sidebar-accent-foreground",
        utilities: ["text-sidebar-accent-foreground"],
      },
      {
        meaning: "Dividers inside the sidebar and the seam against the app canvas.",
        name: "sidebar-border",
        utilities: ["border-sidebar-border"],
      },
      {
        meaning: "Focus ring for sidebar controls.",
        name: "sidebar-ring",
        utilities: ["ring-sidebar-ring"],
      },
    ],
  },
  {
    description:
      "Categorical series colors, ordered by how they should be assigned. Use them in sequence so the same series index keeps the same color across charts.",
    title: "Data visualization",
    tokens: [
      {
        meaning: "First series — the metric the chart is about.",
        name: "chart-1",
        utilities: ["fill-chart-1", "stroke-chart-1"],
      },
      {
        meaning: "Second series.",
        name: "chart-2",
        utilities: ["fill-chart-2", "stroke-chart-2"],
      },
      {
        meaning: "Third series.",
        name: "chart-3",
        utilities: ["fill-chart-3", "stroke-chart-3"],
      },
      {
        meaning: "Fourth series.",
        name: "chart-4",
        utilities: ["fill-chart-4", "stroke-chart-4"],
      },
      {
        meaning: "Fifth series. Beyond five categories, group the tail into an “Other” bucket.",
        name: "chart-5",
        utilities: ["fill-chart-5", "stroke-chart-5"],
      },
    ],
  },
];

export const BRAND_SCALES: BrandScale[] = [
  {
    meaning:
      "The Voidhash brand hue. Step 600 is `--primary`, step 500 is `--ring`. Lighter steps back tinted surfaces; darker steps are for text on tinted backgrounds.",
    prefix: "blue-ribbon",
    title: "Blue Ribbon",
  },
  {
    meaning:
      "Secondary brand hue. Used for the second chart series and for AI/agent surfaces that need to read as distinct from primary actions.",
    prefix: "electric-violet",
    title: "Electric Violet",
  },
  {
    meaning: "Third chart series and accent illustrations. Not used for interactive states.",
    prefix: "fuchsia-pink",
    title: "Fuchsia Pink",
  },
  {
    meaning:
      "Danger. Step 600 is `--destructive` in light mode, step 500 in dark mode where the surface is darker.",
    prefix: "radical-red",
    title: "Radical Red",
  },
  {
    meaning:
      "Reserved for high-urgency, non-destructive states. No semantic token maps to it yet, so reference the scale directly and document the usage.",
    prefix: "blaze-orange",
    title: "Blaze Orange",
  },
  {
    meaning:
      "Warnings and pending states — there is no `--warning` token, so use `amber-500`/`amber-600` when you need caution without danger. Also the fourth chart series.",
    prefix: "amber",
    title: "Amber",
  },
  {
    meaning: "Success and healthy status. Step 600 is `--success`; step 500 is the fifth series.",
    prefix: "pistachio",
    title: "Pistachio",
  },
  {
    meaning:
      "The neutral ramp every surface, border, and text token is built from. Light mode maps 50–200 to surfaces and 500–900 to text; dark mode inverts that.",
    prefix: "zinc",
    title: "Zinc",
  },
];
