/** Literal types for constrained properties */
export type JustifyContent =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type AlignItems =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'baseline';

export type FlexDirection = 'row' | 'column';

export type AlignSelf =
  | 'auto'
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'baseline';

export type Overflow = 'visible' | 'hidden' | 'scroll';

export type Display = 'flex' | 'none';

export type BorderStyle = 'solid' | 'dashed' | 'dotted';

export type FontWeight =
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export type FlexBasis = number | 'auto';

/** Type definitions for each property */
export interface StylePropertyTypes {
  // Spacing
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gap: number;

  // Layout
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  flexDirection: FlexDirection;

  // Flex child
  flex: number | null;
  flexGrow: number;
  flexShrink: number;
  flexBasis: FlexBasis;
  alignSelf: AlignSelf;

  // Size
  width: number | null;
  height: number | null;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;

  // Position (for root nodes on canvas)
  x: number;
  y: number;

  // Background
  backgroundColor: string;
  backgroundEnabled: boolean;

  // Border
  borderWidthTop: number;
  borderWidthRight: number;
  borderWidthBottom: number;
  borderWidthLeft: number;
  borderColor: string;
  borderStyle: BorderStyle;
  borderRadius: number;
  borderRadiusTopLeft: number;
  borderRadiusTopRight: number;
  borderRadiusBottomRight: number;
  borderRadiusBottomLeft: number;
  borderEnabled: boolean;

  // Visual
  opacity: number;
  overflow: Overflow;
  zIndex: number;
  display: Display;

  // Shadow
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlurRadius: number;
  shadowOpacity: number;

  // Typography
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;

  // Safe area
  safeAreaTop: boolean;
  safeAreaBottom: boolean;
}

/** Global default values for all properties */
export const STYLE_DEFAULTS: StylePropertyTypes = {
  // Spacing
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  gap: 0,

  // Layout
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  flexDirection: 'column',

  // Flex child
  flex: null,
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: 'auto',
  alignSelf: 'auto',

  // Size
  width: 100,
  height: 100,
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null,

  // Position
  x: 0,
  y: 0,

  // Background
  backgroundColor: 'rgba(255, 255, 255, 1)',
  backgroundEnabled: false,

  // Border
  borderWidthTop: 0,
  borderWidthRight: 0,
  borderWidthBottom: 0,
  borderWidthLeft: 0,
  borderColor: 'rgba(0, 0, 0, 1)',
  borderStyle: 'solid',
  borderRadius: 0,
  borderRadiusTopLeft: 0,
  borderRadiusTopRight: 0,
  borderRadiusBottomRight: 0,
  borderRadiusBottomLeft: 0,
  borderEnabled: false,

  // Visual
  opacity: 1,
  overflow: 'visible',
  zIndex: 0,
  display: 'flex',

  // Shadow
  shadowEnabled: false,
  shadowColor: 'rgba(0, 0, 0, 1)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlurRadius: 0,
  shadowOpacity: 1,

  // Typography
  fontSize: 16,
  fontWeight: '400',
  color: 'rgba(0, 0, 0, 1)',
  textAlign: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,

  // Safe area
  safeAreaTop: false,
  safeAreaBottom: false
};

export type StylePropertyName = keyof StylePropertyTypes;
