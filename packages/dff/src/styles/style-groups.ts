import type { StylePropertyName } from './style-properties';

/** Property groups for easy composition */
export const STYLE_GROUPS = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  layout: ['gap', 'justifyContent', 'alignItems', 'flexDirection'],
  flexChild: ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf'],
  /** Size dimensions (width/height) - typically for root nodes */
  dimensions: ['width', 'height'],
  /** Size constraints (min/max) - for constraining flexible elements */
  sizeConstraints: ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'],
  /** Full size (dimensions + constraints) - typically for screen nodes */
  size: ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'],
  position: ['x', 'y'],
  background: ['backgroundColor', 'backgroundEnabled'],
  border: [
    'borderWidthTop',
    'borderWidthRight',
    'borderWidthBottom',
    'borderWidthLeft',
    'borderColor',
    'borderStyle',
    'borderEnabled'
  ],
  visual: ['opacity', 'overflow', 'zIndex', 'display'],
  shadow: [
    'shadowEnabled',
    'shadowColor',
    'shadowOffsetX',
    'shadowOffsetY',
    'shadowBlurRadius',
    'shadowOpacity'
  ],
  text: [
    'text',
    'fontSize',
    'fontWeight',
    'color',
    'textAlign',
    'lineHeight',
    'letterSpacing'
  ],
  safeArea: ['safeAreaTop', 'safeAreaBottom']
} as const satisfies Record<string, readonly StylePropertyName[]>;

export type StyleGroup = keyof typeof STYLE_GROUPS;

/** Get properties for a single group */
export type PropertiesOfGroup<G extends StyleGroup> =
  (typeof STYLE_GROUPS)[G][number];

/** Helper to get all properties from multiple groups */
export function getPropertiesFromGroups<G extends StyleGroup>(
  groups: readonly G[]
): PropertiesOfGroup<G>[] {
  const result: StylePropertyName[] = [];
  for (const group of groups) {
    result.push(...STYLE_GROUPS[group]);
  }
  return result as PropertiesOfGroup<G>[];
}
