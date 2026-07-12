import type { Primitive } from "@voidhash/mimic-core";

import type * as properties from "./properties.ts";

import type {
  alignItems,
  alignSelf,
  borderStyle,
  display,
  flexBasis,
  flexDirection,
  fontWeight,
  justifyContent,
  overflow,
  textAlign,
} from "./properties.ts";

/** Literal types for constrained properties - inferred from schema definitions */
export type JustifyContent = Primitive.InferSnapshot<typeof justifyContent>;
export type AlignItems = Primitive.InferSnapshot<typeof alignItems>;
export type FlexDirection = Primitive.InferSnapshot<typeof flexDirection>;
export type FlexBasis = Primitive.InferSnapshot<typeof flexBasis>;
export type AlignSelf = Primitive.InferSnapshot<typeof alignSelf>;
export type Overflow = Primitive.InferSnapshot<typeof overflow>;
export type Display = Primitive.InferSnapshot<typeof display>;
export type BorderStyle = Primitive.InferSnapshot<typeof borderStyle>;
export type FontWeight = Primitive.InferSnapshot<typeof fontWeight>;
export type TextAlign = Primitive.InferSnapshot<typeof textAlign>;

export type AvailableStyleProperties = keyof typeof properties;

/** Maps each style property name to its inferred value type */
export type StylePropertyTypes = {
  [K in AvailableStyleProperties]: (typeof properties)[K] extends Primitive.AnyPrimitive
    ? Primitive.InferSnapshot<(typeof properties)[K]>
    : (typeof properties)[K];
};
