import type {
  PropertiesOfGroup,
  StyleGroup,
  StylePropertyName,
  StylePropertyTypes
} from '@voidhash/dff';

// Re-export for convenience
export type { PropertiesOfGroup, StyleGroup, StylePropertyName };

/**
 * Pick specific style properties from StylePropertyTypes.
 * Use property name literals or PropertiesOfGroup<G> for type-safe selection.
 *
 * @example
 * ```ts
 * // Using explicit property names
 * type MyProps = NodeWithProperties<'gap' | 'paddingTop'>;
 *
 * // Using style groups (recommended)
 * type LayoutProps = NodeWithProperties<PropertiesOfGroup<'layout' | 'padding'>>;
 * ```
 */
export type NodeWithProperties<K extends StylePropertyName> = Pick<
  StylePropertyTypes,
  K
>;

/**
 * Props for a node editor component that edits specific properties.
 * Use PropertiesOfGroup<G> to pick properties from predefined style groups.
 *
 * Available style groups:
 * - 'padding': paddingTop, paddingRight, paddingBottom, paddingLeft
 * - 'margin': marginTop, marginRight, marginBottom, marginLeft
 * - 'layout': gap, justifyContent, alignItems, flexDirection
 * - 'flexChild': flex, flexGrow, flexShrink, flexBasis, alignSelf
 * - 'dimensions': width, height
 * - 'sizeConstraints': minWidth, maxWidth, minHeight, maxHeight
 * - 'size': width, height, minWidth, maxWidth, minHeight, maxHeight
 * - 'position': x, y
 * - 'background': backgroundColor, backgroundEnabled
 * - 'border': borderWidth, borderColor, borderStyle, borderRadius
 * - 'visual': opacity, overflow, zIndex, display
 * - 'shadow': shadowEnabled, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlurRadius, shadowOpacity
 * - 'text': text, fontSize, fontWeight, color, textAlign, lineHeight, letterSpacing
 * - 'safeArea': safeAreaTop, safeAreaBottom
 *
 * @example
 * ```tsx
 * import type { PropertiesOfGroup } from '@voidhash/dff';
 *
 * // Pick properties from style groups
 * type LayoutProperties = PropertiesOfGroup<'layout' | 'padding'>;
 *
 * export function LayoutSection({
 *   node,
 *   onNodeChange
 * }: NodeEditorProps<LayoutProperties>) {
 *   // node.gap, node.justifyContent, node.paddingTop, etc. are all typed correctly
 *   return <div>...</div>;
 * }
 * ```
 */
export type NodeEditorProps<K extends StylePropertyName> = {
  node: NodeWithProperties<K>;
  onNodeChange: (node: NodeWithProperties<K>) => void;
};
