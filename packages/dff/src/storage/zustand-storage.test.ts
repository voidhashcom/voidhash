import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreApi } from 'zustand';
import {
  createTestRootNode,
  createTestScreenNode,
  testDocument
} from './test-fixtures';
import type { NodesStore } from './zustand-storage';
import { createZustandStorage } from './zustand-storage';

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
  let storage: ReturnType<typeof createZustandStorage>;

  beforeEach(() => {
    store = createMockStore();
    storage = createZustandStorage(store, testDocument);
  });

  describe('load', () => {
    it('should return empty snapshot when store is empty', () => {
      const snapshot = storage.load();

      expect(snapshot.meta).toBeNull();
      expect(snapshot.nodes).toEqual({});
    });

    it('should return nodes from store', () => {
      store.getState().setNodes({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });

      const snapshot = storage.load();

      expect(snapshot.nodes).toEqual({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });
    });

    it('should always return null for meta (Zustand doesnt persist metadata)', () => {
      store.getState().setNodes({
        root: createTestRootNode()
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
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1')
        }
      });

      expect(store.getLatestNodes()).toEqual({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });
    });

    it('should overwrite existing nodes', () => {
      store.getState().setNodes({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });

      storage.save({
        meta: null,
        nodes: {
          root: createTestRootNode()
        }
      });

      expect(store.getLatestNodes()).toEqual({
        root: createTestRootNode()
      });
      expect(store.getLatestNodes()['screen-1']).toBeUndefined();
    });
  });

  describe('observe', () => {
    it('should call callback when store changes', () => {
      const callback = vi.fn();
      storage?.observe?.(callback);

      store.getState().setNodes({ root: createTestRootNode() });

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls.at(0)?.[0];
      expect(snapshot?.nodes).toEqual({ root: createTestRootNode() });
      expect(snapshot?.meta).toBeNull();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = storage?.observe?.(callback);

      store.getState().setNodes({ root: createTestRootNode() });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe?.();

      store.getState().setNodes({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle multiple observers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      storage?.observe?.(callback1);
      storage?.observe?.(callback2);

      store.getState().setNodes({ root: createTestRootNode() });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNode', () => {
    it('should return node when valid and matches schema', () => {
      const rootNode = createTestRootNode();
      store.getState().setNodes({ root: rootNode });

      const result = storage.getNode('root', 'root');

      expect(result).toEqual(rootNode);
    });

    it('should return undefined when node does not exist', () => {
      const result = storage.getNode('nonexistent', 'root');

      expect(result).toBeUndefined();
    });

    it('should return undefined when node does not match schema', () => {
      // Set invalid node data (missing required 'id' field)
      store.getState().setNodes({ root: { type: 'root' } });

      const result = storage.getNode('root', 'root');

      expect(result).toBeUndefined();
    });

    it('should return undefined when node type does not match', () => {
      const screenNode = createTestScreenNode();
      store.getState().setNodes({ 'screen-1': screenNode });

      // Try to get screen node as root type
      const result = storage.getNode('screen-1', 'root');

      expect(result).toBeUndefined();
    });
  });

  describe('setNode', () => {
    it('should save node when valid', () => {
      const rootNode = createTestRootNode();

      storage.setNode('root', 'root', rootNode);

      expect(store.getLatestNodes().root).toEqual(rootNode);
    });

    it('should throw error when node does not match schema', () => {
      // Invalid node (missing required 'id' field)
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const invalidNode = { type: 'root' } as any;

      expect(() => {
        storage.setNode('root', 'root', invalidNode);
      }).toThrow('does not match schema');
    });

    it('should update existing node', () => {
      const rootNode1 = createTestRootNode('root-1');
      storage.setNode('root', 'root', createTestRootNode());

      storage.setNode('root', 'root', rootNode1);

      expect(store.getLatestNodes().root).toEqual(rootNode1);
    });

    it('should merge with existing nodes', () => {
      store.getState().setNodes({
        'screen-1': createTestScreenNode('screen-1')
      });

      storage.setNode('root', 'root', createTestRootNode());

      expect(store.getLatestNodes()).toEqual({
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1')
      });
    });
  });

  describe('integration with save', () => {
    it('should notify observers when save is called', () => {
      const callback = vi.fn();
      storage?.observe?.(callback);

      storage.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: { root: createTestRootNode() }
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('round-trip', () => {
    it('should load what was saved', () => {
      const original = {
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1', 'Main Screen')
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
