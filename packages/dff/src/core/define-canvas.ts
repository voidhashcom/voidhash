import { Schema } from 'effect';
import type { NodeDef } from './define-node';

/**
 * Configuration for defining a canvas type
 */
interface CanvasConfig {
  /** All node types available in this canvas */
  nodes: readonly NodeDef[];
}

/**
 * Canvas definition with all node types and their schemas.
 */
export interface CanvasDef<Type extends string = string> {
  readonly _tag: 'CanvasDef';
  readonly type: Type;
  readonly nodes: readonly NodeDef[];
  /** Nodes that can be root nodes (have isRoot: true) */
  readonly rootNodes: readonly NodeDef[];
  /** Union schema of all node types in this canvas */
  readonly nodeSchema: unknown;
}

/**
 * Define a canvas type that groups related nodes.
 * Different canvas types can have completely different node sets.
 *
 * @example
 * ```ts
 * // Design canvas for UI design
 * export const designCanvas = defineCanvas('design', {
 *   nodes: [screenNode, textNode, columnNode, rowNode]
 * });
 *
 * // Automation canvas for workflows
 * export const automationCanvas = defineCanvas('automation', {
 *   nodes: [workflowNode, actionNode, conditionNode]
 * });
 * ```
 */
export function defineCanvas<Type extends string>(
  type: Type,
  config: CanvasConfig
): CanvasDef<Type> {
  const { nodes } = config;

  // Filter nodes that can be roots
  const rootNodes = nodes.filter((n) => n.isRoot);

  // Build union schema from all node schemas
  const schemas = nodes.map((n) => n.schema) as Schema.Schema<
    unknown,
    unknown,
    never
  >[];

  let nodeSchema: unknown;
  if (schemas.length === 0) {
    // Empty canvas - use never schema
    nodeSchema = Schema.Never;
  } else if (schemas.length === 1) {
    nodeSchema = schemas[0];
  } else {
    // Create union of all schemas - we know there are at least 2
    const first = schemas[0] as Schema.Schema<unknown, unknown, never>;
    const second = schemas[1] as Schema.Schema<unknown, unknown, never>;
    const rest = schemas.slice(2) as Schema.Schema<unknown, unknown, never>[];
    nodeSchema = Schema.Union(first, second, ...rest);
  }

  return {
    _tag: 'CanvasDef' as const,
    type,
    nodes,
    rootNodes,
    nodeSchema
  };
}

/**
 * Type guard to check if a value is a CanvasDef
 */
export function isCanvasDef(value: unknown): value is CanvasDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    value._tag === 'CanvasDef'
  );
}

/**
 * Get a node definition by type from a canvas
 */
export function getNodeDef(
  canvas: CanvasDef,
  type: string
): NodeDef | undefined {
  return canvas.nodes.find((n) => n.type === type);
}
