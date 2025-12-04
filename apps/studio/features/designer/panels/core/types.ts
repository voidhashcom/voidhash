import type {
  PropertyDef,
  PropertyDefName,
  PropertyDefType
} from '@voidhash/dff';

/**
 * Helper type to extract a PropertyDef from a union by its name.
 * Used internally to map property names to their definitions.
 */
type ExtractPropertyByName<
  P extends PropertyDef,
  K extends string
> = P extends PropertyDef<K, infer _TSchema, infer _A, infer _H> ? P : never;

/**
 * Converts a union of PropertyDef types into an object type with
 * property names as keys and their value types as values.
 *
 * @example
 * ```ts
 * import type { gap, justifyContent, alignItems } from '@voidhash/dff';
 *
 * type RequiredProperties = typeof gap | typeof justifyContent | typeof alignItems;
 *
 * // NodeWithProperties<RequiredProperties> becomes:
 * // {
 * //   gap: number;
 * //   justifyContent: JustifyContent;
 * //   alignItems: AlignItems;
 * // }
 * ```
 */
export type NodeWithProperties<P extends PropertyDef> = {
  [K in PropertyDefName<P>]: PropertyDefType<ExtractPropertyByName<P, K>>;
};

/**
 * Props for a node editor component that edits specific properties.
 * Use a union of PropertyDef types to specify which properties the editor requires.
 *
 * @example
 * ```tsx
 * import type { gap, justifyContent, alignItems } from '@voidhash/dff';
 *
 * type RequiredProperties = typeof gap | typeof justifyContent | typeof alignItems;
 *
 * export function LayoutSection({
 *   node,
 *   onNodeChange
 * }: NodeEditorProps<RequiredProperties>) {
 *   // node.gap, node.justifyContent, node.alignItems are all typed correctly
 *   return <div>...</div>;
 * }
 * ```
 */
export type NodeEditorProps<P extends PropertyDef> = {
  node: NodeWithProperties<P>;
  onNodeChange: (node: NodeWithProperties<P>) => void;
};
