/**
 * The single source of truth for the §3.1 deploy wire-contract style keys.
 *
 * `./style.ts` derives {@link WIRE_STYLE_ORDER} → `PAYWALL_STYLE_KEY_LIST`, the
 * §3.1 deploy wire contract (the `PaywallStyle` type is locked against this list
 * in both directions, so a key can be added or removed in exactly one place).
 *
 * This module has ZERO imports and pulls in no react/effect/mimic — it is safe
 * to import from the dependency-free `./schema` entry.
 */

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
