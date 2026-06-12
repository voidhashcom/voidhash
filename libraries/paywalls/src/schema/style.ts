/**
 * The RN-compatible style subset every paywall primitive accepts — the §3.1
 * vocabulary of the paywall deploy contract. Using this type (instead of
 * `React.CSSProperties`) on primitive props enforces the subset at compile
 * time, so authored paywalls stay renderable on the DOM today and on native
 * views later.
 */

/** A length value: device-independent pixels or a string (e.g. `"50%"`). */
export type PaywallDimension = number | string;

export type PaywallFlexDirection =
  | "row"
  | "row-reverse"
  | "column"
  | "column-reverse";

export type PaywallAlignItems =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline";

export type PaywallAlignSelf = "auto" | PaywallAlignItems;

export type PaywallJustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type PaywallFontWeight =
  | number
  | "normal"
  | "bold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";

/**
 * The §3.1 style subset. Keys are limited to the RN-compatible vocabulary;
 * values are numbers (device-independent pixels) or strings (colors, `"50%"`).
 * No arbitrary CSS.
 */
export interface PaywallStyle {
  // Flexbox
  flex?: number;
  flexDirection?: PaywallFlexDirection;
  alignItems?: PaywallAlignItems;
  alignSelf?: PaywallAlignSelf;
  justifyContent?: PaywallJustifyContent;
  flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
  gap?: PaywallDimension;
  rowGap?: PaywallDimension;
  columnGap?: PaywallDimension;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: PaywallDimension;

  // Box
  width?: PaywallDimension;
  height?: PaywallDimension;
  minWidth?: PaywallDimension;
  minHeight?: PaywallDimension;
  maxWidth?: PaywallDimension;
  maxHeight?: PaywallDimension;
  padding?: PaywallDimension;
  paddingTop?: PaywallDimension;
  paddingBottom?: PaywallDimension;
  paddingLeft?: PaywallDimension;
  paddingRight?: PaywallDimension;
  paddingHorizontal?: PaywallDimension;
  paddingVertical?: PaywallDimension;
  margin?: PaywallDimension;
  marginTop?: PaywallDimension;
  marginBottom?: PaywallDimension;
  marginLeft?: PaywallDimension;
  marginRight?: PaywallDimension;
  marginHorizontal?: PaywallDimension;
  marginVertical?: PaywallDimension;
  aspectRatio?: number | string;

  // Border
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderStyle?: "solid" | "dotted" | "dashed";

  // Visual
  backgroundColor?: string;
  opacity?: number;
  overflow?: "visible" | "hidden" | "scroll";

  // Position
  position?: "absolute" | "relative";
  top?: PaywallDimension;
  right?: PaywallDimension;
  bottom?: PaywallDimension;
  left?: PaywallDimension;
  zIndex?: number;

  // Text-only
  color?: string;
  fontSize?: number;
  fontWeight?: PaywallFontWeight;
  fontStyle?: "normal" | "italic";
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlign?: "auto" | "left" | "right" | "center" | "justify";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecorationLine?:
    | "none"
    | "underline"
    | "line-through"
    | "underline line-through";
  fontFamily?: string;
}

/**
 * Every key allowed by the §3.1 subset, as a runtime value. The tree renderer
 * filters serialized styles down to this list so an out-of-contract key (e.g.
 * smuggled in through a cast) never reaches a preview tree the server would
 * reject.
 */
export const PAYWALL_STYLE_KEYS = [
  "flex",
  "flexDirection",
  "alignItems",
  "alignSelf",
  "justifyContent",
  "flexWrap",
  "gap",
  "rowGap",
  "columnGap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "aspectRatio",
  "borderWidth",
  "borderColor",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderStyle",
  "backgroundColor",
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
] as const satisfies ReadonlyArray<keyof PaywallStyle>;

/**
 * A style prop may be a single object, a (possibly nested) array of objects,
 * or a falsy value — mirroring React Native's `StyleProp`. Falsy entries are
 * ignored so `style={[base, condition && override]}` works as expected.
 */
export type StyleProp =
  | PaywallStyle
  | false
  | null
  | undefined
  | ReadonlyArray<StyleProp>;
