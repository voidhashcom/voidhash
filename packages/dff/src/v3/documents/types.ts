import type { Infer, ObjectSchema, Schema } from '../schema';

/**
 * Document metadata stored with the document.
 */
export interface DocumentMeta {
  schemaVersion: number;
  documentType: string;
}

/**
 * Document definition that specifies available node types and their relationships.
 * Uses functional schema-based approach instead of class-based.
 */
export interface DocumentDefinition<
  TNodes extends Record<string, ObjectSchema<any>>
> {
  /** Document type identifier (e.g., 'paywall') */
  readonly type: string;

  /** Schema version for migrations */
  readonly schemaVersion: number;

  /** Map of node type names to their schemas */
  readonly nodes: TNodes;

  /** Map of node types to their allowed child types */
  readonly allowedChildren: {
    [K in keyof TNodes]: readonly (keyof TNodes)[];
  };

  /**
   * Root node types that can exist without a parent.
   * These are typically ['root'] but can be customized.
   */
  readonly rootNodeTypes: readonly (keyof TNodes)[];
}

/**
 * Helper type to extract node data type from a document definition.
 */
export type NodeDataFromDocument<
  TDoc extends DocumentDefinition<any>,
  K extends keyof TDoc['nodes']
> = Infer<TDoc['nodes'][K]>;

/**
 * Union type of all node types in a document.
 */
export type AnyNodeDataFromDocument<TDoc extends DocumentDefinition<any>> =
  NodeDataFromDocument<TDoc, keyof TDoc['nodes']>;
