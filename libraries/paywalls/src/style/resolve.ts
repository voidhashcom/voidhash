import type { CSSProperties } from "react";

import type {
  PaywallBackgroundGradient,
  PaywallBackgroundImage,
  PaywallGradientStop,
  PaywallStyle,
  StyleProp,
} from "../schema/style";

/**
 * Flattens a (possibly nested, possibly falsy) {@link StyleProp} into a single
 * {@link PaywallStyle}. Later entries win, matching React Native's
 * `StyleSheet.flatten` semantics.
 */
export const flattenStyle = (style: StyleProp): PaywallStyle => {
  if (!style) {
    return {};
  }
  if (Array.isArray(style)) {
    let acc: PaywallStyle = {};
    for (const entry of style as ReadonlyArray<StyleProp>) {
      acc = { ...acc, ...flattenStyle(entry) };
    }
    return acc;
  }
  return style as PaywallStyle;
};

/**
 * §3.1 keys that are CSS shorthands on the DOM. Committed later in an inline
 * style object they reset their longhands (`flex` clears `flexGrow`/
 * `flexShrink`/`flexBasis`), whereas React Native gives longhands precedence
 * within one object regardless of declaration order. The vocabulary carries no
 * shorthand spacing/border keys (per-side longhands only), so `flex` and `gap`
 * are the only shorthands that remain — {@link resolveStyle} emits them before
 * everything else.
 */
const CSS_SHORTHAND_KEYS = ["flex", "gap"] as const satisfies ReadonlyArray<keyof PaywallStyle>;

const isCssShorthandKey = (key: string): boolean =>
  (CSS_SHORTHAND_KEYS as ReadonlyArray<string>).includes(key);

const RESIZE_MODE_TO_BACKGROUND_SIZE: Record<PaywallBackgroundImage["resizeMode"], string> = {
  center: "auto",
  contain: "contain",
  cover: "cover",
  stretch: "100% 100%",
};

/**
 * Style keys the DOM renderer consumes to derive the background CSS rather than
 * passing them through. `backgroundColor` is the exception: `solid` (and every
 * disabled/degenerate case) resolves back to it.
 */
const BACKGROUND_DERIVED_KEYS = ["backgroundType", "backgroundGradient", "backgroundImage"] as const;

/**
 * Builds an inline SVG whose gradient uses `objectBoundingBox` units, so the
 * two-point normalized geometry (`0..1` node space) maps exactly onto the
 * element regardless of its aspect ratio. `preserveAspectRatio="none"` lets the
 * 1×1 viewBox stretch to fill. Intentionally byte-compatible with the mono
 * web-core renderer's helper.
 */
const buildGradientSvg = (
  gradient: PaywallBackgroundGradient,
  stops: readonly PaywallGradientStop[],
): string => {
  const stopEls = stops
    .map((stop) => `<stop offset='${stop.position}' stop-color='${stop.color}'/>`)
    .join("");

  const def =
    gradient.kind === "radial"
      ? (() => {
          const r = Math.hypot(gradient.endX - gradient.startX, gradient.endY - gradient.startY);
          return `<radialGradient id='g' cx='${gradient.startX}' cy='${gradient.startY}' r='${r}'>${stopEls}</radialGradient>`;
        })()
      : `<linearGradient id='g' x1='${gradient.startX}' y1='${gradient.startY}' x2='${gradient.endX}' y2='${gradient.endY}'>${stopEls}</linearGradient>`;

  return `<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' viewBox='0 0 1 1'><defs>${def}</defs><rect width='1' height='1' fill='url(#g)'/></svg>`;
};

/**
 * Lowers a node's non-solid background (`gradient` / `image`) onto the CSS
 * background quad. Called only once `resolveStyle` has decided the type is
 * renderable; a type that resolves to nothing renderable falls back to
 * `transparent`.
 *
 * - `gradient` → an SVG data-URI `backgroundImage`, so the two-point normalized
 *   geometry stays exact independent of aspect ratio. Stops are sorted by
 *   position; a single stop degrades to that solid color, zero stops to
 *   `transparent`.
 * - `image` → `backgroundImage: url(...)` with the resize mode mapped to
 *   `backgroundSize`. An empty url resolves to `transparent`.
 *
 * Byte-compatible with the mono web-core renderer's helper (which additionally
 * gates on `backgroundEnabled`, a field the OSS preview-tree style omits).
 */
const buildBackgroundStyles = (style: PaywallStyle): CSSProperties => {
  const type = style.backgroundType ?? "solid";

  if (type === "gradient") {
    const gradient = style.backgroundGradient;
    const stops = (gradient?.stops ?? []).slice().sort((a, b) => a.position - b.position);
    if (!gradient || stops.length === 0) {
      return { backgroundColor: "transparent" };
    }
    if (stops.length === 1) {
      return { backgroundColor: stops[0]!.color };
    }
    const svg = buildGradientSvg(gradient, stops);
    return {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  if (type === "image") {
    const url = style.backgroundImage?.url ?? "";
    if (url === "") {
      return { backgroundColor: "transparent" };
    }
    const resizeMode = style.backgroundImage?.resizeMode ?? "cover";
    // encodeURI leaves the double-quote untouched; escape it too so it cannot
    // break out of the quoted `url("…")` token.
    const safeUrl = encodeURI(url).replace(/"/g, "%22");
    return {
      backgroundImage: `url("${safeUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: RESIZE_MODE_TO_BACKGROUND_SIZE[resizeMode],
    };
  }

  // solid
  return { backgroundColor: style.backgroundColor };
};

/**
 * Lowers a {@link StyleProp} onto the web target as plain
 * {@link CSSProperties}. The vocabulary is the RN-expanded subset (no shorthand
 * spacing/border keys: only `paddingLeft`/`paddingTop`/… and per-edge border
 * widths), so most keys pass through untouched — React appends `px` to unitless
 * length values when committing to the DOM. Three transforms remain:
 *
 * - CSS shorthands (`flex`, `gap`) are emitted before everything else, so
 *   React Native's "longhand wins within one object" semantics hold on the DOM
 *   independent of the author's key order (a later shorthand would otherwise
 *   reset its longhands, e.g. `flex` clobbering `flexGrow`).
 * - numeric `lineHeight` becomes `"<n>px"` (RN treats it as pixels; React
 *   would otherwise emit a unitless multiplier).
 * - `borderStyle: "solid"` is defaulted when a border width/color is set
 *   without one (RN renders solid borders implicitly).
 * - a `backgroundType` of `gradient`/`image` is lowered onto the CSS background
 *   quad (SVG data-URI or `url(...)`); the structured `backgroundGradient` /
 *   `backgroundImage` fields never reach the DOM as raw CSS.
 */
export const resolveStyle = (style: StyleProp): CSSProperties => {
  const flat = flattenStyle(style);
  const { lineHeight, ...rest } = flat;

  const out: Record<string, unknown> = {};

  for (const key of CSS_SHORTHAND_KEYS) {
    if (rest[key] !== undefined) {
      out[key] = rest[key];
    }
  }

  for (const [key, value] of Object.entries(rest)) {
    if (
      value === undefined ||
      isCssShorthandKey(key) ||
      (BACKGROUND_DERIVED_KEYS as ReadonlyArray<string>).includes(key)
    ) {
      continue;
    }
    out[key] = value;
  }

  // A gradient/image background type is lowered onto the CSS background quad,
  // overriding the pass-through `backgroundColor`. A `solid` (or absent) type
  // leaves `backgroundColor` untouched — legacy behavior.
  if (flat.backgroundType === "gradient" || flat.backgroundType === "image") {
    delete out.backgroundColor;
    Object.assign(out, buildBackgroundStyles(flat));
  }

  if (lineHeight !== undefined) {
    out.lineHeight = typeof lineHeight === "number" ? `${lineHeight}px` : lineHeight;
  }
  const hasBorderWidth =
    flat.borderTopWidth !== undefined ||
    flat.borderRightWidth !== undefined ||
    flat.borderBottomWidth !== undefined ||
    flat.borderLeftWidth !== undefined;
  if ((hasBorderWidth || flat.borderColor !== undefined) && flat.borderStyle === undefined) {
    out.borderStyle = "solid";
  }

  return out as CSSProperties;
};
