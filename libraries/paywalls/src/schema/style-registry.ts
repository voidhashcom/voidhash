/**
 * The single source of truth for the paywall style vocabulary.
 *
 * Consumers derive their tables from the ordered lists + descriptors below so
 * they can never drift apart or from this registry:
 *
 * - `./style.ts` derives {@link WIRE_STYLE_ORDER} → `PAYWALL_STYLE_KEY_LIST`,
 *   the §3.1 deploy wire contract (the `PaywallStyle` type is locked against
 *   this list in both directions, so a key can be added or removed in exactly
 *   one place).
 * - `../compose/grammar.ts` derives the per-node ordered lists →
 *   `NODE_STYLE_VOCABULARY`, the printer-significant compose grammar (field
 *   ORDER and default VALUES both change the printed source, so each is pinned
 *   here).
 * - `../compose/style-attr-types.ts` derives the precise static TS types of the
 *   compose author surface (`<Screen>`/`<View>`/`<Text>` `style={{ … }}` objects), and
 *   `../compose/generate-dts.ts` renders the same descriptors to the ambient
 *   `.d.ts` strings Monaco loads — both from {@link STYLE_FIELD_TYPES}, so a
 *   field's accepted value type is single-sourced too.
 *
 * The two sets are intentionally different: the compose grammar mirrors the
 * closed mimic designer-document node schemas (which carry designer-only fields
 * such as `x`/`y`, `backgroundEnabled`, `shadow*`, `safeArea*`, `display`),
 * while the wire contract carries RN layout fields the grammar does not yet
 * round-trip (`position`/`top`/`right`/`bottom`/`left`, `aspectRatio`,
 * `flexWrap`, `fontStyle`, `textTransform`, `textDecorationLine`, `fontFamily`).
 *
 * This module has ZERO imports and pulls in no react/effect/mimic — it is safe
 * to import from the dependency-free `./schema` entry and the mimic-free
 * `../compose` grammar alike.
 */

/**
 * A per-node style field with its printer default. `default` is omitted for the
 * few fields that appear in a node's style vocabulary but carry no schema
 * default (`minWidth`/`maxWidth`/`minHeight`/`maxHeight`/`flex`); their presence
 * in the ordered list still fixes their printer position.
 */
export interface StyleFieldEntry {
  readonly field: string;
  readonly default?: unknown;
}

/**
 * A runtime value-type descriptor for a style field. It is the single source
 * that drives BOTH the static TS types of the compose author surface
 * (`../compose/style-attr-types`) and the `.d.ts` strings the Monaco editor
 * consumes (`../compose/generate-dts`). Descriptors are chosen to be at least as
 * wide as the closed mimic node schema accepts (`packages/mimic-schema` style
 * properties) — a too-narrow type would reject a legal document, so where a
 * field is stored as a plain number in the schema but the §3.1 wire contract
 * widens it (e.g. `gap`), the descriptor takes the wider form.
 *
 * - `number` — a numeric value (device-independent pixels, opacity, weight, …).
 * - `color` — an RGBA color string (rendered as `string`; kept distinct so the
 *   surface can be tightened later without touching call sites).
 * - `string` — an arbitrary string (e.g. `fontFamily`).
 * - `boolean` — a bare-flag boolean (`safeAreaTop`, `backgroundEnabled`, …).
 * - `dimension` — `number | "auto"` (the closed `width`/`height`/`flexBasis`).
 * - `enum` — one of a fixed set of string literals.
 * - `gradient` / `image` — the structured background shapes.
 */
export type StyleValueDescriptor =
  | { readonly kind: "number" }
  | { readonly kind: "color" }
  | { readonly kind: "string" }
  | { readonly kind: "boolean" }
  | { readonly kind: "dimension" }
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "gradient" }
  | { readonly kind: "image" };

/**
 * The value-type descriptor for every style field the compose grammar accepts,
 * keyed by field name. A field name maps to ONE descriptor across all node types
 * (verified against the mimic node schemas), so a single map is sufficient; the
 * per-node entry lists reference these by field name. `width`/`height` take the
 * `dimension` form because the `view` schema accepts `number | "auto"` — the
 * `screen` schema stores plain numbers, so `dimension` is conservatively wide
 * there (a legal screen width is still a number).
 *
 * ZERO imports: rendered to both TS types and d.ts strings downstream.
 */
export const STYLE_FIELD_TYPES = {
  // Position (compose-only; plain numbers in the schema)
  x: { kind: "number" },
  y: { kind: "number" },

  // Spacing
  paddingTop: { kind: "number" },
  paddingRight: { kind: "number" },
  paddingBottom: { kind: "number" },
  paddingLeft: { kind: "number" },
  marginTop: { kind: "number" },
  marginRight: { kind: "number" },
  marginBottom: { kind: "number" },
  marginLeft: { kind: "number" },
  gap: { kind: "number" },

  // Layout enums
  justifyContent: {
    kind: "enum",
    values: [
      "flex-start",
      "center",
      "flex-end",
      "space-between",
      "space-around",
      "space-evenly",
    ],
  },
  alignItems: {
    kind: "enum",
    values: ["flex-start", "center", "flex-end", "stretch", "baseline"],
  },
  flexDirection: { kind: "enum", values: ["row", "column"] },
  alignSelf: {
    kind: "enum",
    values: ["auto", "flex-start", "center", "flex-end", "stretch", "baseline"],
  },

  // Flex child
  flex: { kind: "number" },
  flexGrow: { kind: "number" },
  flexShrink: { kind: "number" },
  flexBasis: { kind: "dimension" },

  // Dimensions + constraints
  width: { kind: "dimension" },
  height: { kind: "dimension" },
  minWidth: { kind: "number" },
  maxWidth: { kind: "number" },
  minHeight: { kind: "number" },
  maxHeight: { kind: "number" },

  // Background
  backgroundColor: { kind: "color" },
  backgroundEnabled: { kind: "boolean" },
  backgroundType: { kind: "enum", values: ["solid", "gradient", "image"] },
  backgroundGradient: { kind: "gradient" },
  backgroundImage: { kind: "image" },

  // Border
  borderTopWidth: { kind: "number" },
  borderRightWidth: { kind: "number" },
  borderBottomWidth: { kind: "number" },
  borderLeftWidth: { kind: "number" },
  borderColor: { kind: "color" },
  borderStyle: { kind: "enum", values: ["solid", "dashed", "dotted"] },
  borderEnabled: { kind: "boolean" },
  borderTopLeftRadius: { kind: "number" },
  borderTopRightRadius: { kind: "number" },
  borderBottomRightRadius: { kind: "number" },
  borderBottomLeftRadius: { kind: "number" },

  // Visual
  opacity: { kind: "number" },
  overflow: { kind: "enum", values: ["visible", "hidden", "scroll"] },
  zIndex: { kind: "number" },
  display: { kind: "enum", values: ["flex", "none"] },

  // Position (RN absolute/relative flow; offsets are `number | "auto"`)
  position: { kind: "enum", values: ["absolute", "relative"] },
  top: { kind: "dimension" },
  right: { kind: "dimension" },
  bottom: { kind: "dimension" },
  left: { kind: "dimension" },

  // Shadow (compose-only)
  shadowEnabled: { kind: "boolean" },
  shadowColor: { kind: "color" },
  shadowOffsetX: { kind: "number" },
  shadowOffsetY: { kind: "number" },
  shadowRadius: { kind: "number" },
  shadowOpacity: { kind: "number" },

  // Safe area (compose-only)
  safeAreaTop: { kind: "boolean" },
  safeAreaBottom: { kind: "boolean" },

  // Typography (text)
  fontSize: { kind: "number" },
  fontWeight: {
    kind: "enum",
    values: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  },
  color: { kind: "color" },
  textAlign: { kind: "enum", values: ["left", "center", "right", "justify"] },
  lineHeight: { kind: "number" },
  letterSpacing: { kind: "number" },
} as const satisfies Readonly<Record<string, StyleValueDescriptor>>;

/** The set of style field names carrying a descriptor. */
export type StyleFieldName = keyof typeof STYLE_FIELD_TYPES;

/**
 * The §3.1 wire-contract style keys, in `PaywallStyle` declaration order. This
 * is the exact content and order `PAYWALL_STYLE_KEY_LIST` exposes.
 */
export const WIRE_STYLE_ORDER = [
  "flex",
  "flexDirection",
  "alignItems",
  "alignSelf",
  "justifyContent",
  "flexWrap",
  "gap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "aspectRatio",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderColor",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderStyle",
  "backgroundColor",
  "backgroundType",
  "backgroundGradient",
  "backgroundImage",
  "opacity",
  "overflow",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "color",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecorationLine",
  "fontFamily",
] as const;

/** The wire-contract style key type, derived from {@link WIRE_STYLE_ORDER}. */
export type WireStyleKey = (typeof WIRE_STYLE_ORDER)[number];

/**
 * The canonical designer gradient default shared by the screen and view node
 * schemas (a top-to-bottom white→transparent linear gradient).
 */
const DEFAULT_GRADIENT = {
  kind: "linear",
  startX: 0.5,
  startY: 0,
  endX: 0.5,
  endY: 1,
  stops: [
    { color: "rgba(255, 255, 255, 1)", position: 0 },
    { color: "rgba(255, 255, 255, 0)", position: 1 },
  ],
} as const;

/** The canonical designer image-background default (empty, cover). */
const DEFAULT_IMAGE = { url: "", resizeMode: "cover" } as const;

/**
 * The `screen` node style vocabulary, in mimic-schema field order with per-field
 * defaults. The order and defaults are printer-significant (see the module doc).
 */
export const SCREEN_STYLE_ENTRIES = [
  { field: "x", default: 0 },
  { field: "y", default: 0 },
  { field: "width", default: 375 },
  { field: "height", default: 812 },
  { field: "minWidth" },
  { field: "maxWidth" },
  { field: "minHeight" },
  { field: "maxHeight" },
  { field: "paddingTop", default: 0 },
  { field: "paddingRight", default: 0 },
  { field: "paddingBottom", default: 0 },
  { field: "paddingLeft", default: 0 },
  { field: "marginTop", default: 0 },
  { field: "marginRight", default: 0 },
  { field: "marginBottom", default: 0 },
  { field: "marginLeft", default: 0 },
  { field: "gap", default: 0 },
  { field: "justifyContent", default: "flex-start" },
  { field: "alignItems", default: "flex-start" },
  { field: "flexDirection", default: "column" },
  { field: "backgroundColor", default: "rgba(255, 255, 255, 1)" },
  { field: "backgroundEnabled", default: true },
  { field: "backgroundType", default: "solid" },
  { field: "backgroundGradient", default: DEFAULT_GRADIENT },
  { field: "backgroundImage", default: DEFAULT_IMAGE },
  { field: "borderTopWidth", default: 0 },
  { field: "borderRightWidth", default: 0 },
  { field: "borderBottomWidth", default: 0 },
  { field: "borderLeftWidth", default: 0 },
  { field: "borderColor", default: "rgba(0, 0, 0, 1)" },
  { field: "borderStyle", default: "solid" },
  { field: "borderEnabled", default: false },
  { field: "opacity", default: 1 },
  { field: "overflow", default: "visible" },
  { field: "zIndex", default: 0 },
  { field: "display", default: "flex" },
  { field: "shadowEnabled", default: false },
  { field: "shadowColor", default: "rgba(0, 0, 0, 1)" },
  { field: "shadowOffsetX", default: 0 },
  { field: "shadowOffsetY", default: 0 },
  { field: "shadowRadius", default: 0 },
  { field: "shadowOpacity", default: 1 },
  { field: "safeAreaTop", default: false },
  { field: "safeAreaBottom", default: false },
  { field: "flex" },
  { field: "flexGrow", default: 0 },
  { field: "flexShrink", default: 1 },
  { field: "flexBasis", default: "auto" },
  { field: "alignSelf", default: "auto" },
] as const satisfies readonly StyleFieldEntry[];

/**
 * The `view` node style vocabulary, in mimic-schema field order with per-field
 * defaults. Order and defaults are printer-significant.
 */
export const VIEW_STYLE_ENTRIES = [
  { field: "paddingTop", default: 0 },
  { field: "paddingRight", default: 0 },
  { field: "paddingBottom", default: 0 },
  { field: "paddingLeft", default: 0 },
  { field: "marginTop", default: 0 },
  { field: "marginRight", default: 0 },
  { field: "marginBottom", default: 0 },
  { field: "marginLeft", default: 0 },
  { field: "gap", default: 0 },
  { field: "justifyContent", default: "flex-start" },
  { field: "alignItems", default: "flex-start" },
  { field: "flexDirection", default: "column" },
  { field: "width", default: 100 },
  { field: "height", default: 100 },
  { field: "minWidth" },
  { field: "maxWidth" },
  { field: "minHeight" },
  { field: "maxHeight" },
  { field: "backgroundColor", default: "rgba(255, 255, 255, 1)" },
  { field: "backgroundEnabled", default: false },
  { field: "backgroundType", default: "solid" },
  { field: "backgroundGradient", default: DEFAULT_GRADIENT },
  { field: "backgroundImage", default: DEFAULT_IMAGE },
  { field: "borderTopWidth", default: 0 },
  { field: "borderRightWidth", default: 0 },
  { field: "borderBottomWidth", default: 0 },
  { field: "borderLeftWidth", default: 0 },
  { field: "borderColor", default: "rgba(0, 0, 0, 1)" },
  { field: "borderStyle", default: "solid" },
  { field: "borderEnabled", default: false },
  { field: "borderTopLeftRadius", default: 0 },
  { field: "borderTopRightRadius", default: 0 },
  { field: "borderBottomRightRadius", default: 0 },
  { field: "borderBottomLeftRadius", default: 0 },
  { field: "opacity", default: 1 },
  { field: "overflow", default: "visible" },
  { field: "zIndex", default: 0 },
  { field: "position", default: "relative" },
  { field: "left", default: "auto" },
  { field: "top", default: "auto" },
  { field: "right", default: "auto" },
  { field: "bottom", default: "auto" },
  { field: "display", default: "flex" },
  { field: "shadowEnabled", default: false },
  { field: "shadowColor", default: "rgba(0, 0, 0, 1)" },
  { field: "shadowOffsetX", default: 0 },
  { field: "shadowOffsetY", default: 0 },
  { field: "shadowRadius", default: 0 },
  { field: "shadowOpacity", default: 1 },
  { field: "safeAreaTop", default: false },
  { field: "safeAreaBottom", default: false },
  { field: "flex" },
  { field: "flexGrow", default: 0 },
  { field: "flexShrink", default: 1 },
  { field: "flexBasis", default: "auto" },
  { field: "alignSelf", default: "auto" },
] as const satisfies readonly StyleFieldEntry[];

/**
 * The `text` node style vocabulary, in mimic-schema field order with per-field
 * defaults. Order and defaults are printer-significant.
 */
export const TEXT_STYLE_ENTRIES = [
  { field: "marginTop", default: 0 },
  { field: "marginRight", default: 0 },
  { field: "marginBottom", default: 0 },
  { field: "marginLeft", default: 0 },
  { field: "minWidth" },
  { field: "maxWidth" },
  { field: "minHeight" },
  { field: "maxHeight" },
  { field: "fontSize", default: 16 },
  { field: "fontWeight", default: "400" },
  { field: "color", default: "rgba(0, 0, 0, 1)" },
  { field: "textAlign", default: "left" },
  { field: "lineHeight", default: 1.5 },
  { field: "letterSpacing", default: 0 },
  { field: "borderTopWidth", default: 0 },
  { field: "borderRightWidth", default: 0 },
  { field: "borderBottomWidth", default: 0 },
  { field: "borderLeftWidth", default: 0 },
  { field: "borderColor", default: "rgba(0, 0, 0, 1)" },
  { field: "borderStyle", default: "solid" },
  { field: "borderEnabled", default: false },
  { field: "opacity", default: 1 },
  { field: "overflow", default: "visible" },
  { field: "zIndex", default: 0 },
  { field: "position", default: "relative" },
  { field: "left", default: "auto" },
  { field: "top", default: "auto" },
  { field: "right", default: "auto" },
  { field: "bottom", default: "auto" },
  { field: "display", default: "flex" },
  { field: "shadowEnabled", default: false },
  { field: "shadowColor", default: "rgba(0, 0, 0, 1)" },
  { field: "shadowOffsetX", default: 0 },
  { field: "shadowOffsetY", default: 0 },
  { field: "shadowRadius", default: 0 },
  { field: "shadowOpacity", default: 1 },
  { field: "flex" },
  { field: "flexGrow", default: 0 },
  { field: "flexShrink", default: 1 },
  { field: "flexBasis", default: "auto" },
  { field: "alignSelf", default: "auto" },
] as const satisfies readonly StyleFieldEntry[];

/** The per-node ordered style-field registries, keyed by composition node type. */
export const NODE_STYLE_ENTRIES = {
  screen: SCREEN_STYLE_ENTRIES,
  view: VIEW_STYLE_ENTRIES,
  text: TEXT_STYLE_ENTRIES,
} as const;

/** The default display name emitted for each composition node type. */
export const NODE_DEFAULT_NAMES = {
  screen: "Screen",
  view: "View",
  text: "Text",
} as const;

// ---- descriptor → static type derivation --------------------------------

/**
 * The structured gradient background value shape (mirrors the mimic
 * `backgroundGradient` schema). Exposed for the compose author surface so a
 * `backgroundGradient={…}` attribute type-checks against the real shape.
 */
export interface StyleGradientValue {
  readonly kind: "linear" | "radial";
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly stops: readonly { readonly color: string; readonly position: number }[];
}

/** The structured image background value shape (mirrors the mimic schema). */
export interface StyleImageValue {
  readonly url: string;
  readonly resizeMode: "cover" | "contain" | "stretch" | "center";
}

/** Map a value-type descriptor to the static TS type it accepts. */
export type StyleValueTypeOf<D extends StyleValueDescriptor> = D extends { kind: "number" }
  ? number
  : D extends { kind: "color" }
    ? string
    : D extends { kind: "string" }
      ? string
      : D extends { kind: "boolean" }
        ? boolean
        : D extends { kind: "dimension" }
          ? number | "auto"
          : D extends { kind: "enum"; values: readonly (infer V)[] }
            ? V
            : D extends { kind: "gradient" }
              ? StyleGradientValue
              : D extends { kind: "image" }
                ? StyleImageValue
                : never;

/** The accepted static value type for a style field, by field name. */
export type StyleFieldValue<K extends StyleFieldName> = StyleValueTypeOf<(typeof STYLE_FIELD_TYPES)[K]>;

// ---- compile-time locks --------------------------------------------------

/** Resolves to `T` only when it is exactly `true`; forces a compile error otherwise. */
type AssertTrue<T extends true> = T;

/**
 * Every field named in the per-node entry lists must carry a descriptor in
 * {@link STYLE_FIELD_TYPES}; otherwise the compose author surface would have no
 * type for it. This resolves to `true` only when the union of all entry field
 * names is a subset of the descriptor key set.
 */
type _AllEntryFieldsHaveDescriptor = AssertTrue<
  (typeof NODE_STYLE_ENTRIES)[keyof typeof NODE_STYLE_ENTRIES][number]["field"] extends StyleFieldName
    ? true
    : false
>;

/**
 * Every per-field `default` in the entry lists must satisfy that field's own
 * descriptor-derived type, so the registry can never ship a default the author
 * surface would reject. `EntryDefaultOk` is `true` for an entry with no default
 * (its type-position is fixed but it carries no value) or one whose default is
 * assignable to {@link StyleFieldValue}. Distributing over the entry union and
 * requiring the whole distribution to be exactly `true` fails the assert if any
 * single entry's default is off.
 */
type EntryDefaultOk<E> = E extends { field: infer F; default: infer D }
  ? F extends StyleFieldName
    ? D extends StyleFieldValue<F>
      ? true
      : false
    : false
  : true;
type AllEntries = (typeof NODE_STYLE_ENTRIES)[keyof typeof NODE_STYLE_ENTRIES][number];
type _AllDefaultsSatisfyDescriptor = AssertTrue<
  EntryDefaultOk<AllEntries> extends true ? true : false
>;

// Force tsc to evaluate the locks (unused type aliases are otherwise erased).
export type _StyleRegistryLocks = [_AllEntryFieldsHaveDescriptor, _AllDefaultsSatisfyDescriptor];
