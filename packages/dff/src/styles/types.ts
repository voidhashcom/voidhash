// import type { z } from 'zod';
// import type * as properties from './properties';
// import type {
//   alignItems,
//   alignSelf,
//   borderStyle,
//   display,
//   flexBasis,
//   flexDirection,
//   fontWeight,
//   justifyContent,
//   overflow,
//   textAlign
// } from './properties';

// /** Literal types for constrained properties - inferred from schema definitions */
// export type JustifyContent = z.infer<typeof justifyContent>;
// export type AlignItems = z.infer<typeof alignItems>;
// export type FlexDirection = z.infer<typeof flexDirection>;
// export type FlexBasis = z.infer<typeof flexBasis>;
// export type AlignSelf = z.infer<typeof alignSelf>;
// export type Overflow = z.infer<typeof overflow>;
// export type Display = z.infer<typeof display>;
// export type BorderStyle = z.infer<typeof borderStyle>;
// export type FontWeight = z.infer<typeof fontWeight>;
// export type TextAlign = z.infer<typeof textAlign>;

// export type AvailableStyleProperties = keyof typeof properties;

// /** Maps each style property name to its inferred value type */
// export type StylePropertyTypes = {
//   [K in AvailableStyleProperties]: (typeof properties)[K] extends z.ZodTypeAny
//     ? z.infer<(typeof properties)[K]>
//     : (typeof properties)[K];
// };
