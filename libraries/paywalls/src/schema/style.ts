/**
 * The RN-compatible style subset every paywall primitive accepts — the §3.1
 * vocabulary of the paywall deploy contract. Using this type (instead of
 * `React.CSSProperties`) on primitive props enforces the subset at compile
 * time, so authored paywalls stay renderable on the DOM today and on native
 * views later.
 *
 * The {@link PaywallStyle} interface is hand-written for documentation and DX,
 * but its key set is single-sourced from `./style-registry`: {@link
 * PAYWALL_STYLE_KEY_LIST} is derived from `WIRE_STYLE_ORDER`, and the two
 * compile-time locks at the bottom of this file fail `tsc` if the interface and
 * the registry's wire-field set drift in either direction.
 */
import { WIRE_STYLE_ORDER, type WireStyleKey } from "./style-registry";

/** A length value: device-independent pixels or a string (e.g. `"50%"`). */
export type PaywallDimension = number | string;

export type PaywallFlexDirection = "row" | "row-reverse" | "column" | "column-reverse";

export type PaywallAlignItems = "flex-start" | "flex-end" | "center" | "stretch" | "baseline";

export type PaywallAlignSelf = "auto" | PaywallAlignItems;

export type PaywallJustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly";

/** Which background fill a node renders. `backgroundEnabled` gates all three. */
export type PaywallBackgroundType = "solid" | "gradient" | "image";

/** A single gradient color stop: an RGBA color at a `0..1` position along the line. */
export interface PaywallGradientStop {
  color: string;
  position: number;
}

/**
 * A gradient background. Geometry is a two-point line in normalized node space
 * (`0..1` typical, not clamped): `start` → `end`. Maps directly onto
 * expo-linear-gradient `start`/`end` on native; a radial gradient's radius is
 * the euclidean distance from start to end.
 */
export interface PaywallBackgroundGradient {
  kind: "linear" | "radial";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  stops: PaywallGradientStop[];
}

/** An image background. An empty `url` renders as transparent. */
export interface PaywallBackgroundImage {
  url: string;
  resizeMode: "cover" | "contain" | "stretch" | "center";
}

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
  paddingTop?: PaywallDimension;
  paddingBottom?: PaywallDimension;
  paddingLeft?: PaywallDimension;
  paddingRight?: PaywallDimension;
  marginTop?: PaywallDimension;
  marginBottom?: PaywallDimension;
  marginLeft?: PaywallDimension;
  marginRight?: PaywallDimension;
  aspectRatio?: number | string;

  // Border
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: string;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderStyle?: "solid" | "dotted" | "dashed";

  // Visual
  backgroundColor?: string;
  backgroundType?: PaywallBackgroundType;
  backgroundGradient?: PaywallBackgroundGradient;
  backgroundImage?: PaywallBackgroundImage;
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
  textDecorationLine?: "none" | "underline" | "line-through" | "underline line-through";
  fontFamily?: string;
}

/**
 * The §3.1 style vocabulary as a runtime list, single-sourced from the
 * `./style-registry` `WIRE_STYLE_ORDER` (content AND order). The two locks below
 * tie it to the {@link PaywallStyle} type in both directions — a key added to or
 * removed from either side fails to compile. The `./schema` entry derives its
 * {@link PAYWALL_STYLE_KEYS} `Set` from this list so the runtime key set and the
 * type never drift, and the tree renderer filters serialized styles down to
 * these keys so an out-of-contract key (e.g. smuggled in through a cast) never
 * reaches a preview tree the server would reject.
 */
export const PAYWALL_STYLE_KEY_LIST = WIRE_STYLE_ORDER;

/**
 * A style prop may be a single object, a (possibly nested) array of objects,
 * or a falsy value — mirroring React Native's `StyleProp`. Falsy entries are
 * ignored so `style={[base, condition && override]}` works as expected.
 */
export type StyleProp = PaywallStyle | false | null | undefined | ReadonlyArray<StyleProp>;

// Bidirectional compile-time lock between the hand-written PaywallStyle
// interface and the registry's wire-field set. `AssertKeysEqual<A, B>` resolves
// to `never` (a type error where used) unless A and B are the exact same key
// set: the first mapped type surfaces a key present in A but missing from B, the
// second the reverse. Assigning the result to a `[]` const forces tsc to
// evaluate it, so a key added to or dropped from EITHER the interface or
// `WIRE_STYLE_ORDER` (without matching the other) fails the build here.
type MissingKeys<From, In> = { [K in keyof From]: K extends In ? never : K }[keyof From];
type AssertKeysEqual<A, B> = MissingKeys<A, B> extends never
  ? MissingKeys<Record<B & PropertyKey, unknown>, keyof A> extends never
    ? true
    : never
  : never;

const _wireMatchesInterface: AssertKeysEqual<Required<PaywallStyle>, WireStyleKey> = true;
void _wireMatchesInterface;
