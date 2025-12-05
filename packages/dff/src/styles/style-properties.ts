/** All possible style property names */
export type StylePropertyName =
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'gap'
  | 'justifyContent'
  | 'alignItems'
  | 'flexDirection'
  | 'flex'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexBasis'
  | 'alignSelf'
  | 'width'
  | 'height'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'
  | 'backgroundColor'
  | 'backgroundEnabled'
  | 'borderWidth'
  | 'borderColor'
  | 'borderStyle'
  | 'borderRadius'
  | 'opacity'
  | 'overflow'
  | 'zIndex'
  | 'display'
  | 'shadowEnabled'
  | 'shadowColor'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
  | 'shadowBlurRadius'
  | 'shadowOpacity'
  | 'text'
  | 'fontSize'
  | 'fontWeight'
  | 'color'
  | 'textAlign'
  | 'lineHeight'
  | 'letterSpacing'
  | 'safeAreaTop'
  | 'safeAreaBottom'
  | 'x'
  | 'y';

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
  width: number;
  height: number;
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
  borderWidth: number;
  borderColor: string | null;
  borderStyle: BorderStyle;
  borderRadius: number;

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

  // Text
  text: string;
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
  backgroundColor: '#ffffff',
  backgroundEnabled: false,

  // Border
  borderWidth: 0,
  borderColor: null,
  borderStyle: 'solid',
  borderRadius: 0,

  // Visual
  opacity: 1,
  overflow: 'visible',
  zIndex: 0,
  display: 'flex',

  // Shadow
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlurRadius: 0,
  shadowOpacity: 1,

  // Text
  text: 'New Text',
  fontSize: 16,
  fontWeight: '400',
  color: '#000000',
  textAlign: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,

  // Safe area
  safeAreaTop: false,
  safeAreaBottom: false
};
