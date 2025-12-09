import type {
	AvailableStyleProperties,
	StylePropertyTypes,
} from "@voidhash/dff";

/**
 * All style property names defined in @voidhash/dff/src/styles/properties.ts
 * that are actually used in node types. This ensures type safety by using the actual
 * property names from the source, filtered to only include properties that exist on nodes.
 */
export type StylePropertyName = Extract<
	AvailableStyleProperties,
	keyof StylePropertyTypes
>;

/**
 * Pick specific style properties from StylePropertyTypes.
 * Use property name literals for type-safe selection.
 *
 * @example
 * ```ts
 * // Using explicit property names
 * type MyProps = NodeWithProperties<'gap' | 'paddingTop'>;
 *
 * // Combining multiple properties
 * type LayoutProps = NodeWithProperties<'gap' | 'justifyContent' | 'alignItems' | 'flexDirection' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'>;
 * ```
 */
export type NodeWithProperties<K extends StylePropertyName> = Pick<
	StylePropertyTypes,
	K
>;

/**
 * Props for a node editor component that edits specific properties.
 * Use property name literals to pick individual style properties.
 *
 * Common property combinations:
 * - Layout: 'gap' | 'justifyContent' | 'alignItems' | 'flexDirection'
 * - Padding: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'
 * - Margin: 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft'
 * - Dimensions: 'width' | 'height'
 * - Flex Child: 'flex' | 'flexGrow' | 'flexShrink' | 'flexBasis' | 'alignSelf'
 * - Background: 'backgroundColor' | 'backgroundEnabled'
 * - Border: 'borderWidthTop' | 'borderWidthRight' | 'borderWidthBottom' | 'borderWidthLeft' | 'borderColor' | 'borderStyle' | 'borderEnabled'
 * - Border Radius: 'borderRadiusTopLeft' | 'borderRadiusTopRight' | 'borderRadiusBottomRight' | 'borderRadiusBottomLeft'
 *
 * @example
 * ```tsx
 * // Pick individual properties
 * type LayoutProperties = 'gap' | 'justifyContent' | 'alignItems' | 'flexDirection' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft';
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
