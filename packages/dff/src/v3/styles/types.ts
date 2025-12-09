import type { Infer } from '../schema';
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
