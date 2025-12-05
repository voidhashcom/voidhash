import type { StoreApi } from 'zustand';
import type { DocumentSnapshot, StorageProvider } from './types';

/** Store interface that ZustandStorage expects */
export interface NodesStore {
  nodes: Record<string, unknown>;
  setNodes: (nodes: Record<string, unknown>) => void;
}

/**
 * Zustand-based storage provider for React state management.
 * Provides a simple interface to read/write document nodes to a Zustand store.
 */
export class ZustandStorage implements StorageProvider {
  private readonly store: StoreApi<NodesStore>;

  constructor(store: StoreApi<NodesStore>) {
    this.store = store;
  }

  /** Load the current document state from Zustand store */
  load(): DocumentSnapshot {
    const { nodes } = this.store.getState();
    return {
      meta: null, // Zustand store doesn't persist metadata
      nodes
    };
  }

  /** Save document state to Zustand store */
  save(snapshot: DocumentSnapshot): void {
    this.store.getState().setNodes(snapshot.nodes);
  }

  /** Subscribe to Zustand store changes */
  observe(callback: (snapshot: DocumentSnapshot) => void): () => void {
    return this.store.subscribe((state) => {
      callback({
        meta: null,
        nodes: state.nodes
      });
    });
  }
}
