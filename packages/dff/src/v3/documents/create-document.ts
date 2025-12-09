import type { ObjectSchema } from '../schema';
import type { DocumentDefinition } from './types';

/**
 * Configuration for creating a document definition.
 */
export interface CreateDocumentConfig<
  TNodes extends Record<string, ObjectSchema<any>>
> {
  /** Document type identifier (e.g., 'paywall') */
  type: string;

  /** Schema version for migrations */
  schemaVersion: number;

  /** Map of node type names to their schemas */
  nodes: TNodes;

  /** Map of node types to their allowed child types */
  allowedChildren: {
    [K in keyof TNodes]: readonly (keyof TNodes)[];
  };

  /** Root node types (defaults to ['root'] if not provided) */
  rootNodeTypes?: readonly (keyof TNodes)[];
}

/**
 * Create a document definition with type safety.
 *
 * @example
 * ```ts
 * const paywallDoc = createDocument({
 *   type: 'paywall',
 *   schemaVersion: 1,
 *   nodes: { root: rootNode, screen: screenNode },
 *   allowedChildren: { root: ['screen'], screen: [] },
 *   rootNodeTypes: ['root']
 * });
 * ```
 */
export function createDocument<
  TNodes extends Record<string, ObjectSchema<any>>
>(config: CreateDocumentConfig<TNodes>): DocumentDefinition<TNodes> {
  // Validate that all node types in allowedChildren exist in nodes
  for (const nodeType of Object.keys(config.allowedChildren)) {
    if (!(nodeType in config.nodes)) {
      throw new Error(
        `Node type '${nodeType}' in allowedChildren not found in nodes`
      );
    }
  }

  // Validate that all child types in allowedChildren exist in nodes
  for (const [parentType, childTypes] of Object.entries(
    config.allowedChildren
  ) as [string, readonly (keyof TNodes)[]][]) {
    for (const childType of childTypes) {
      if (!(childType in config.nodes)) {
        throw new Error(
          `Child type '${String(childType)}' for parent '${parentType}' not found in nodes`
        );
      }
    }
  }

  // Validate rootNodeTypes exist in nodes
  const rootNodeTypes = config.rootNodeTypes ?? (['root'] as const);
  for (const rootType of rootNodeTypes) {
    if (!(rootType in config.nodes)) {
      throw new Error(
        `Root node type '${String(rootType)}' not found in nodes`
      );
    }
  }

  return {
    type: config.type,
    schemaVersion: config.schemaVersion,
    nodes: config.nodes,
    allowedChildren: config.allowedChildren,
    rootNodeTypes
  };
}
