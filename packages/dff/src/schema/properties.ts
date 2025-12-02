import { Schema } from 'effect';
import { defineProperty } from '../core/define-property';

// ============================================================================
// Base Schema Types (for reference and backwards compatibility)
// ============================================================================

export const JustifyContentSchema = Schema.Literal(
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly'
);

// export type JustifyContent =
//   | 'flex-start'
//   | 'center'
//   | 'flex-end'
//   | 'space-between'
//   | 'space-around'
//   | 'space-evenly';

export const AlignItemsSchema = Schema.Literal(
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline'
);

// export type AlignItems =
//   | 'flex-start'
//   | 'center'
//   | 'flex-end'
//   | 'stretch'
//   | 'baseline';

export const FontWeightSchema = Schema.Literal(
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900'
);

// export type FontWeight =
//   | '100'
//   | '200'
//   | '300'
//   | '400'
//   | '500'
//   | '600'
//   | '700'
//   | '800'
//   | '900';

export const TextAlignSchema = Schema.Literal(
  'left',
  'center',
  'right',
  'justify'
);

// export type TextAlign = 'left' | 'center' | 'right' | 'justify';

// ============================================================================
// Property Definitions (flat/atomic values)
// ============================================================================

// --- Padding Properties ---
export const paddingTop = defineProperty('paddingTop', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

export const paddingRight = defineProperty('paddingRight', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

export const paddingBottom = defineProperty('paddingBottom', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

export const paddingLeft = defineProperty('paddingLeft', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

/** Convenience grouping for all padding properties */
export const paddingProperties = [
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft
] as const;

// --- Safe Area Properties ---
export const safeAreaTop = defineProperty('safeAreaTop', {
  schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  default: () => false
});

export const safeAreaBottom = defineProperty('safeAreaBottom', {
  schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  default: () => false
});

/** Convenience grouping for safe area properties */
export const safeAreaProperties = [safeAreaTop, safeAreaBottom] as const;

// --- Layout Properties ---
export const gap = defineProperty('gap', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

export const justifyContent = defineProperty('justifyContent', {
  schema: Schema.optionalWith(JustifyContentSchema, {
    default: () => 'flex-start' as const
  }),
  default: () => 'flex-start'
});

export const alignItems = defineProperty('alignItems', {
  schema: Schema.optionalWith(AlignItemsSchema, {
    default: () => 'stretch' as const
  }),
  default: () => 'stretch'
});

// --- Position Properties ---
export const x = defineProperty('x', {
  schema: Schema.Number,
  default: () => 0
});

export const y = defineProperty('y', {
  schema: Schema.Number,
  default: () => 0
});

export const width = defineProperty('width', {
  schema: Schema.Number,
  default: () => 375
});

export const height = defineProperty('height', {
  schema: Schema.Number,
  default: () => 812
});

// --- Color Properties ---
export const backgroundColor = defineProperty('backgroundColor', {
  schema: Schema.optionalWith(Schema.String, { default: () => '#ffffff' }),
  default: () => '#ffffff'
});

export const backgroundColorNullable = defineProperty('backgroundColor', {
  schema: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null
  }),
  default: () => null
});

export const color = defineProperty('color', {
  schema: Schema.optionalWith(Schema.String, { default: () => '#000000' }),
  default: () => '#000000'
});

// --- Text Properties ---
export const text = defineProperty('text', {
  schema: Schema.String,
  default: () => 'New Text'
});

export const fontSize = defineProperty('fontSize', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 16 }),
  default: () => 16
});

export const fontWeight = defineProperty('fontWeight', {
  schema: Schema.optionalWith(FontWeightSchema, {
    default: () => '400' as const
  }),
  default: () => '400'
});

export const textAlign = defineProperty('textAlign', {
  schema: Schema.optionalWith(TextAlignSchema, {
    default: () => 'left' as const
  }),
  default: () => 'left'
});

export const lineHeight = defineProperty('lineHeight', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 1.5 }),
  default: () => 1.5
});

export const letterSpacing = defineProperty('letterSpacing', {
  schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  default: () => 0
});

// // ============================================================================
// // Legacy types (for backwards compatibility during migration)
// // ============================================================================

// export const PaddingSchema = Schema.Struct({
//   top: Schema.Number,
//   right: Schema.Number,
//   bottom: Schema.Number,
//   left: Schema.Number
// });

// export interface Padding {
//   top: number;
//   right: number;
//   bottom: number;
//   left: number;
// }

// export const SafeAreaSchema = Schema.Struct({
//   top: Schema.Boolean,
//   bottom: Schema.Boolean
// });

// export interface SafeArea {
//   top: boolean;
//   bottom: boolean;
// }

// export const DEFAULT_PADDING: Padding = {
//   top: 0,
//   right: 0,
//   bottom: 0,
//   left: 0
// };

// export const DEFAULT_SAFE_AREA: SafeArea = {
//   top: false,
//   bottom: false
// };
