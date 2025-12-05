import type { DocumentMeta } from '../core';

/** Snapshot of document state for storage operations */
export interface DocumentSnapshot {
  meta: DocumentMeta | null;
  nodes: Record<string, unknown>;
}

/** Interface for storage providers that can load and save document state */
export interface StorageProvider {
  /** Load the current document state from storage */
  load(): DocumentSnapshot;

  /** Save document state to storage */
  save(snapshot: DocumentSnapshot): void;

  /** Subscribe to storage changes (optional) */
  observe?(callback: (snapshot: DocumentSnapshot) => void): () => void;
}
