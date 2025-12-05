import type * as Y from 'yjs';
import type { DocumentSnapshot, StorageProvider } from './types';

/**
 * Yjs-based storage provider for collaborative document editing.
 * Uses Y.Map for both nodes and metadata storage.
 */
export class YjsStorage implements StorageProvider {
  private readonly nodesMap: Y.Map<unknown>;
  private readonly metaMap: Y.Map<unknown>;
  readonly ydoc: Y.Doc;

  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc;
    this.nodesMap = ydoc.getMap('nodes');
    this.metaMap = ydoc.getMap('meta');
  }

  /** Load the current document state from Yjs */
  load(): DocumentSnapshot {
    const schemaVersion = this.metaMap.get('schemaVersion');
    const documentType = this.metaMap.get('documentType');

    const meta =
      typeof schemaVersion === 'number' && typeof documentType === 'string'
        ? { schemaVersion, documentType }
        : null;

    const nodes: Record<string, unknown> = {};
    for (const [id, value] of this.nodesMap.entries()) {
      nodes[id] = value;
    }

    return { meta, nodes };
  }

  /** Save document state to Yjs in a single transaction */
  save(snapshot: DocumentSnapshot): void {
    this.ydoc.transact(() => {
      // Update metadata
      if (snapshot.meta) {
        this.metaMap.set('schemaVersion', snapshot.meta.schemaVersion);
        this.metaMap.set('documentType', snapshot.meta.documentType);
      }

      // Get current node IDs to detect deletions
      const existingIds = new Set(this.nodesMap.keys());
      const newIds = new Set(Object.keys(snapshot.nodes));

      // Delete removed nodes
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          this.nodesMap.delete(id);
        }
      }

      // Add/update nodes
      for (const [id, node] of Object.entries(snapshot.nodes)) {
        this.nodesMap.set(id, node);
      }
    });
  }

  /** Subscribe to Yjs document changes */
  observe(callback: (snapshot: DocumentSnapshot) => void): () => void {
    const handler = () => {
      callback(this.load());
    };

    this.nodesMap.observe(handler);
    this.metaMap.observe(handler);

    return () => {
      this.nodesMap.unobserve(handler);
      this.metaMap.unobserve(handler);
    };
  }

  /** Get the number of nodes in storage */
  get size(): number {
    return this.nodesMap.size;
  }
}
