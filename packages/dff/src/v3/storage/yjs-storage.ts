/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import type * as Y from 'yjs';
import type { DocumentDefinition } from '../documents';
import type { Infer } from '../schema';
import { validate } from '../schema';
import type { DocumentSnapshot, StorageAdapter } from './types';

/**
 * Yjs-based storage adapter for collaborative document editing.
 * Uses Y.Map for both nodes and metadata storage with schema validation.
 */
export class YjsStorage<TDoc extends DocumentDefinition<any>>
  implements StorageAdapter<TDoc>
{
  private readonly nodesMap: Y.Map<unknown>;
  private readonly metaMap: Y.Map<unknown>;
  readonly ydoc: Y.Doc;
  private readonly document: TDoc;

  constructor(ydoc: Y.Doc, document: TDoc) {
    this.ydoc = ydoc;
    this.document = document;
    this.nodesMap = ydoc.getMap('nodes');
    this.metaMap = ydoc.getMap('meta');
  }

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

  getNode<K extends keyof TDoc['nodes']>(
    id: string,
    nodeType: K
  ): Infer<TDoc['nodes'][K]> | undefined {
    const node = this.nodesMap.get(id);
    if (node === undefined) {
      return;
    }

    const schema = this.document.nodes[nodeType];
    if (!validate(schema, node)) {
      return;
    }

    return node as Infer<TDoc['nodes'][K]>;
  }

  setNode<K extends keyof TDoc['nodes']>(
    id: string,
    nodeType: K,
    node: Infer<TDoc['nodes'][K]>
  ): void {
    const schema = this.document.nodes[nodeType];
    if (!validate(schema, node)) {
      throw new Error(
        `Node ${id} does not match schema for type ${String(nodeType)}`
      );
    }

    this.ydoc.transact(() => {
      this.nodesMap.set(id, node);
    });
  }
}

/**
 * Create a Yjs storage adapter with document context.
 */
export function createYjsStorage<TDoc extends DocumentDefinition<any>>(
  ydoc: Y.Doc,
  document: TDoc
) {
  return new YjsStorage(ydoc, document);
}
