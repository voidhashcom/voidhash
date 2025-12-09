import type { Infer, Schema } from '../schema';
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
export type JustifyContent = Infer<typeof justifyContent>;
export type AlignItems = Infer<typeof alignItems>;
export type FlexDirection = Infer<typeof flexDirection>;
export type FlexBasis = Infer<typeof flexBasis>;
export type AlignSelf = Infer<typeof alignSelf>;
export type Overflow = Infer<typeof overflow>;
export type Display = Infer<typeof display>;
export type BorderStyle = Infer<typeof borderStyle>;
export type FontWeight = Infer<typeof fontWeight>;
export type TextAlign = Infer<typeof textAlign>;

export type AvailableStyleProperties = keyof typeof properties;

/** Maps each style property name to its inferred value type */
export type StylePropertyTypes = {
  [K in AvailableStyleProperties]: (typeof properties)[K] extends Schema<unknown>
    ? Infer<(typeof properties)[K]>
    : (typeof properties)[K];
};
