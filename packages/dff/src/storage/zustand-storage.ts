import type { StoreApi } from 'zustand';
import type { DocumentDefinition } from '../documents';
import type { Infer } from '../schema';
import { validate } from '../schema';
import type { DocumentSnapshot, StorageAdapter } from './types';

/** Store interface that ZustandStorage expects */
export interface NodesStore {
  nodes: Record<string, unknown>;
  setNodes: (nodes: Record<string, unknown>) => void;
}

/**
 * Zustand-based storage adapter for React state management.
 * Provides a simple interface to read/write document nodes to a Zustand store
 * with schema validation.
 */
export class ZustandStorage<TDoc extends DocumentDefinition<any>>
  implements StorageAdapter<TDoc>
{
  private readonly store: StoreApi<NodesStore>;
  private readonly document: TDoc;

  constructor(store: StoreApi<NodesStore>, document: TDoc) {
    this.store = store;
    this.document = document;
  }

  load(): DocumentSnapshot {
    const { nodes } = this.store.getState();
    return {
      meta: null, // Zustand store doesn't persist metadata
      nodes
    };
  }

  save(snapshot: DocumentSnapshot): void {
    this.store.getState().setNodes(snapshot.nodes);
  }

  observe(callback: (snapshot: DocumentSnapshot) => void): () => void {
    return this.store.subscribe((state) => {
      callback({
        meta: null,
        nodes: state.nodes
      });
    });
  }

  getNode<K extends keyof TDoc['nodes']>(
    id: string,
    nodeType: K
  ): Infer<TDoc['nodes'][K]> | undefined {
    const { nodes } = this.store.getState();
    const node = nodes[id];
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

    const { nodes, setNodes } = this.store.getState();
    setNodes({ ...nodes, [id]: node });
  }
}

/**
 * Create a Zustand storage adapter with document context.
 */
export function createZustandStorage<TDoc extends DocumentDefinition<any>>(
  store: StoreApi<NodesStore>,
  document: TDoc
): StorageAdapter<TDoc> {
  return new ZustandStorage(store, document);
}
