import type {
  DocumentDefinition,
  DocumentMeta,
  NodeDataFromDocument
} from '../documents';
import type { Infer, ObjectSchema } from '../schema';
import type { DocumentSnapshot, StorageAdapter } from '../storage';

/**
 * Handle provides typed access to nested properties with read/write operations.
 * Each Handle represents a path to a value in the document tree.
 */
export interface Handle<T> {
  /** Read the current value (snapshot-based, not reactive) */
  get(): T;

  /** Set the value atomically */
  set(value: T): void;

  /**
   * Update the value by merging partial updates (for objects only).
   * Throws if T is not an object type.
   */
  update(partial: Partial<T>): void;
}

/**
 * Transaction context for batching multiple operations.
 * All operations within a transaction are applied atomically.
 */
export interface Transaction<TDoc extends DocumentDefinition<any>> {
  /** Access nodes collection */
  readonly nodes: NodesAccessor<TDoc>;
}

/**
 * Nodes accessor provides typed access to document nodes.
 */
export interface NodesAccessor<TDoc extends DocumentDefinition<any>> {
  /**
   * Get a node handle by ID.
   * Returns a Handle for the node. The type is inferred from the node's type field at runtime.
   * TypeScript will see this as a union of all possible node types.
   */
  get(id: string): Handle<AnyNodeDataFromDocument<TDoc>> | undefined;

  /**
   * Find nodes matching a predicate.
   * Returns an array of Handles.
   */
  find(
    predicate: (node: Handle<AnyNodeDataFromDocument<TDoc>>) => boolean
  ): Handle<AnyNodeDataFromDocument<TDoc>>[];

  /**
   * Create a new node with defaults merged with provided data.
   */
  create<K extends keyof TDoc['nodes']>(
    nodeType: K,
    data: {
      id: string;
      parent?: { id: string; index: string };
    } & Partial<NodeDataFromDocument<TDoc, K>>
  ): Handle<NodeDataFromDocument<TDoc, K>>;

  /**
   * Delete a node by ID.
   */
  delete(id: string): void;
}

/**
 * Union type of all node data types in a document.
 */
export type AnyNodeDataFromDocument<TDoc extends DocumentDefinition<any>> =
  NodeDataFromDocument<TDoc, keyof TDoc['nodes']>;

/**
 * Editor options for creating an editor instance.
 */
export interface EditorOptions<TDoc extends DocumentDefinition<any>> {
  /** Storage adapter for persistence */
  storage?: StorageAdapter<TDoc>;

  /** Initial nodes to populate (for read-only views) */
  initialNodes?: Record<string, unknown>;
}

/**
 * Main editor interface providing ORM-like access to document data.
 */
export interface Editor<TDoc extends DocumentDefinition<any>> {
  /** Access nodes collection */
  readonly nodes: NodesAccessor<TDoc>;

  /** Get document metadata */
  getMeta(): DocumentMeta | null;

  /** Initialize document with metadata */
  initialize(): void;

  /**
   * Run operations in a transaction.
   * All operations are batched and persisted atomically.
   */
  transaction(fn: (tx: Transaction<TDoc>) => void): void;

  /**
   * Subscribe to changes from storage (if storage supports observation).
   */
  observeStorage(
    callback: (nodes: Record<string, unknown>) => void
  ): () => void;
}

// Re-export types from storage for convenience
export type {
  DocumentMeta,
  DocumentSnapshot,
  StorageAdapter
} from '../storage';

/**
 * Helper type to extract property handle from an object schema.
 * This enables nested property access like `node.style.fontSize`.
 */
export type PropertyHandle<
  TSchema extends ObjectSchema<any>,
  K extends keyof Infer<TSchema>
> = Handle<Infer<TSchema>[K]>;
