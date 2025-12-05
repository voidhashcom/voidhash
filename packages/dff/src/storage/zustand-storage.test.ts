import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreApi } from 'zustand';
import type { NodesStore } from './zustand-storage';
import { ZustandStorage } from './zustand-storage';

type StateListener = (state: NodesStore, prevState: NodesStore) => void;

/** Create a mock Zustand store for testing */
function createMockStore(): StoreApi<NodesStore> & {
  getLatestNodes: () => Record<string, unknown>;
  listeners: Set<StateListener>;
} {
  let state: NodesStore = {
    nodes: {},
    setNodes: (nodes) => {
      const prevState = state;
      state = { ...state, nodes };
      // Notify listeners
      for (const listener of listeners) {
        listener(state, prevState);
      }
    }
  };

  const listeners = new Set<StateListener>();

  return {
    getState: () => state,
    setState: (partial) => {
      const prevState = state;
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
      for (const listener of listeners) {
        listener(state, prevState);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getInitialState: () => state,
    getLatestNodes: () => state.nodes,
    listeners
  };
}

describe('ZustandStorage', () => {
  let store: ReturnType<typeof createMockStore>;
  let storage: ZustandStorage;

  beforeEach(() => {
    store = createMockStore();
    storage = new ZustandStorage(store);
  });

  describe('load', () => {
    it('should return empty snapshot when store is empty', () => {
      const snapshot = storage.load();

      expect(snapshot.meta).toBeNull();
      expect(snapshot.nodes).toEqual({});
    });

    it('should return nodes from store', () => {
      store.getState().setNodes({
        root: { type: 'root', id: 'root' },
        'screen-1': { type: 'screen', id: 'screen-1' }
      });

      const snapshot = storage.load();

      expect(snapshot.nodes).toEqual({
        root: { type: 'root', id: 'root' },
        'screen-1': { type: 'screen', id: 'screen-1' }
      });
    });

    it('should always return null for meta (Zustand doesnt persist metadata)', () => {
      store.getState().setNodes({
        root: { type: 'root', id: 'root' }
      });

      const snapshot = storage.load();

      expect(snapshot.meta).toBeNull();
    });
  });

  describe('save', () => {
    it('should save nodes to store', () => {
      storage.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1' }
        }
      });

      expect(store.getLatestNodes()).toEqual({
        root: { type: 'root', id: 'root' },
        'screen-1': { type: 'screen', id: 'screen-1' }
      });
    });

    it('should overwrite existing nodes', () => {
      store.getState().setNodes({
        root: { type: 'root', id: 'root' },
        'screen-1': { type: 'screen', id: 'screen-1' }
      });

      storage.save({
        meta: null,
        nodes: {
          root: { type: 'root', id: 'root' }
        }
      });

      expect(store.getLatestNodes()).toEqual({
        root: { type: 'root', id: 'root' }
      });
      expect(store.getLatestNodes()['screen-1']).toBeUndefined();
    });
  });

  describe('observe', () => {
    it('should call callback when store changes', () => {
      const callback = vi.fn();
      storage.observe(callback);

      store.getState().setNodes({ root: { type: 'root', id: 'root' } });

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls.at(0)?.[0];
      expect(snapshot?.nodes).toEqual({ root: { type: 'root', id: 'root' } });
      expect(snapshot?.meta).toBeNull();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = storage.observe(callback);

      store.getState().setNodes({ root: { type: 'root', id: 'root' } });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.getState().setNodes({
        root: { type: 'root', id: 'root' },
        'screen-1': { type: 'screen', id: 'screen-1' }
      });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle multiple observers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      storage.observe(callback1);
      storage.observe(callback2);

      store.getState().setNodes({ root: { type: 'root', id: 'root' } });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with save', () => {
    it('should notify observers when save is called', () => {
      const callback = vi.fn();
      storage.observe(callback);

      storage.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: { root: { type: 'root', id: 'root' } }
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('round-trip', () => {
    it('should load what was saved', () => {
      const original = {
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1', name: 'Main Screen' }
        }
      };

      storage.save(original);
      const loaded = storage.load();

      // Meta is always null for Zustand
      expect(loaded.meta).toBeNull();
      expect(loaded.nodes).toEqual(original.nodes);
    });
  });
});
