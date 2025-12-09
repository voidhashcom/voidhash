import type { DocumentDefinition } from '../documents';
import type { Infer } from '../schema';

/**
 * Document metadata stored with the document.
 */
export interface DocumentMeta {
  schemaVersion: number;
  documentType: string;
}

/**
 * Snapshot of document state for storage operations.
 */
export interface DocumentSnapshot {
  meta: DocumentMeta | null;
  nodes: Record<string, unknown>;
}

/**
 * Schema-aware storage adapter interface.
 * Provides load/save/observe operations with schema validation support.
 */
export interface StorageAdapter<TDoc extends DocumentDefinition<any>> {
  /** Load the current document state from storage */
  load(): DocumentSnapshot;

  /** Save document state to storage */
  save(snapshot: DocumentSnapshot): void;

  /** Subscribe to storage changes (optional, for reactive updates) */
  observe?(callback: (snapshot: DocumentSnapshot) => void): () => void;

  /**
   * Get a node by ID with schema validation.
   * Returns undefined if node doesn't exist or doesn't match schema.
   */
  getNode<K extends keyof TDoc['nodes']>(
    id: string,
    nodeType: K
  ): Infer<TDoc['nodes'][K]> | undefined;

  /**
   * Set a node with schema validation.
   * Throws if node doesn't match the specified schema.
   */
  setNode<K extends keyof TDoc['nodes']>(
    id: string,
    nodeType: K,
    node: Infer<TDoc['nodes'][K]>
  ): void;
}
