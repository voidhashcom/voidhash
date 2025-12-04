import type { NodeDef } from './define-node';

/**
 * Create default node data for a new node instance.
 * Combines the node definition's defaults with required id and parent,
 * optionally overriding with initial values.
 *
 * @example
 * ```ts
 * const nodeData = createNodeData(textNode, {
 *   id: createNodeId(),
 *   parent: { id: parentId, index: fractionalIndex }
 * });
 *
 * // With initial values to override defaults:
 * const nodeData = createNodeData(flexNode, {
 *   id: createNodeId(),
 *   parent: { id: parentId, index: fractionalIndex },
 *   initialValues: { flexDirection: 'row', gap: 16 }
 * });
 * ```
 */
export function createNodeData(
  nodeDef: NodeDef,
  options: {
    id: string;
    parent: { id: string; index: string };
    initialValues?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const defaults = nodeDef.getDefaults();
  return {
    ...defaults,
    ...options.initialValues,
    id: options.id,
    parent: options.parent
  };
}

/**
 * Filter out undefined values from an update params object.
 * Useful for building partial update objects in actions.
 *
 * @example
 * ```ts
 * const updates = buildUpdateObject({
 *   fontSize: params.fontSize,      // 16
 *   color: params.color,            // undefined (excluded)
 *   fontWeight: params.fontWeight   // '700'
 * });
 * // Result: { fontSize: 16, fontWeight: '700' }
 * ```
 */
export function buildUpdateObject<T extends Record<string, unknown>>(
  params: T
): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(params)) {
    if (params[key] !== undefined) {
      result[key] = params[key];
    }
  }

  return result as Partial<T>;
}

/**
 * Pick specific properties from an object, filtering undefined values.
 * Useful for selecting only the updatable fields from action params.
 *
 * @example
 * ```ts
 * const updates = pickDefined(params, ['fontSize', 'color', 'fontWeight']);
 * ```
 */
export function pickDefined<
  T extends Record<string, unknown>,
  K extends keyof T
>(obj: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Get the updatable property names from a node definition.
 * Excludes 'id', 'type', 'name', and 'parent' which are handled separately.
 */
export function getUpdatableProperties(nodeDef: NodeDef): readonly string[] {
  return nodeDef.properties.map((p) => p.name);
}
