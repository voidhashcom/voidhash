import type { Primitive } from '@voidhash/mimic';
import type * as properties from './properties';
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
  textAlign
} from './properties';

/** Literal types for constrained properties - inferred from schema definitions */
export type JustifyContent = Primitive.InferState<typeof justifyContent>;
export type AlignItems = Primitive.InferState<typeof alignItems>;
export type FlexDirection = Primitive.InferState<typeof flexDirection>;
export type FlexBasis = Primitive.InferState<typeof flexBasis>;
export type AlignSelf = Primitive.InferState<typeof alignSelf>;
export type Overflow = Primitive.InferState<typeof overflow>;
export type Display = Primitive.InferState<typeof display>;
export type BorderStyle = Primitive.InferState<typeof borderStyle>;
export type FontWeight = Primitive.InferState<typeof fontWeight>;
export type TextAlign = Primitive.InferState<typeof textAlign>;

export type AvailableStyleProperties = keyof typeof properties;

/** Maps each style property name to its inferred value type */
export type StylePropertyTypes = {
  [K in AvailableStyleProperties]: (typeof properties)[K] extends Primitive.AnyPrimitive
    ? Primitive.InferState<(typeof properties)[K]>
    : (typeof properties)[K];
};
