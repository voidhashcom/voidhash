import type { CSSProperties } from "react";

import type { PaywallStyle, StyleProp } from "../schema/style";

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
 * style object they reset their longhands (`padding` clears `paddingLeft`,
 * `gap` clears `rowGap`, …), whereas React Native gives longhands precedence
 * within one object regardless of declaration order. {@link resolveStyle}
 * therefore emits these keys before everything else.
 */
const CSS_SHORTHAND_KEYS = [
  "flex",
  "gap",
  "padding",
  "margin",
  "borderRadius",
] as const satisfies ReadonlyArray<keyof PaywallStyle>;

const isCssShorthandKey = (key: string): boolean =>
  (CSS_SHORTHAND_KEYS as ReadonlyArray<string>).includes(key);

/**
 * Lowers a {@link StyleProp} onto the web target as plain
 * {@link CSSProperties}. Transforms applied:
 *
 * - keys are emitted in deterministic specificity order — CSS shorthands
 *   (`flex`, `gap`, `padding`, `margin`, `borderRadius`) first, then the
 *   `paddingHorizontal`/`paddingVertical`/`marginHorizontal`/`marginVertical`
 *   expansions into their physical edges, then explicit edges/corners — so
 *   React Native's "longhand wins within one object" semantics hold on the
 *   DOM independent of the author's key order.
 * - numeric `lineHeight` becomes `"<n>px"` (RN treats it as pixels; React
 *   would otherwise emit a unitless multiplier).
 * - `borderStyle: "solid"` is defaulted when a border width/color is set
 *   without one (RN renders solid borders implicitly).
 *
 * Everything else passes through untouched — React appends `px` to unitless
 * length values when committing to the DOM.
 */
export const resolveStyle = (style: StyleProp): CSSProperties => {
  const flat = flattenStyle(style);
  const {
    paddingHorizontal,
    paddingVertical,
    marginHorizontal,
    marginVertical,
    lineHeight,
    ...rest
  } = flat;

  const out: Record<string, unknown> = {};

  for (const key of CSS_SHORTHAND_KEYS) {
    if (rest[key] !== undefined) {
      out[key] = rest[key];
    }
  }

  if (paddingHorizontal !== undefined) {
    out.paddingLeft = paddingHorizontal;
    out.paddingRight = paddingHorizontal;
  }
  if (paddingVertical !== undefined) {
    out.paddingTop = paddingVertical;
    out.paddingBottom = paddingVertical;
  }
  if (marginHorizontal !== undefined) {
    out.marginLeft = marginHorizontal;
    out.marginRight = marginHorizontal;
  }
  if (marginVertical !== undefined) {
    out.marginTop = marginVertical;
    out.marginBottom = marginVertical;
  }

  // Explicit edges/corners (and every other longhand) land last, so they win
  // over both the shorthands above and the Horizontal/Vertical expansions.
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || isCssShorthandKey(key)) {
      continue;
    }
    out[key] = value;
  }

  if (lineHeight !== undefined) {
    out.lineHeight = typeof lineHeight === "number" ? `${lineHeight}px` : lineHeight;
  }
  if (
    (flat.borderWidth !== undefined || flat.borderColor !== undefined) &&
    flat.borderStyle === undefined
  ) {
    out.borderStyle = "solid";
  }

  return out as CSSProperties;
};
