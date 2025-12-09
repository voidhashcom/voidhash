import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  createTestRootNode,
  createTestScreenNode,
  testDocument
} from './test-fixtures';
import { createYjsStorage } from './yjs-storage';

describe('YjsStorage', () => {
  let ydoc: Y.Doc;
  let storage: ReturnType<typeof createYjsStorage>;

  beforeEach(() => {
    ydoc = new Y.Doc();
    storage = createYjsStorage(ydoc, testDocument);
  });

  describe('constructor', () => {
    it('should expose the ydoc', () => {
      expect(storage?.ydoc).toBe(ydoc);
    });
  });

  describe('load', () => {
    it('should return empty snapshot when storage is empty', () => {
      const snapshot = storage.load();

      expect(snapshot.meta).toBeNull();
      expect(snapshot.nodes).toEqual({});
    });

    it('should return meta when metadata is set', () => {
      const metaMap = ydoc.getMap('meta');
      metaMap.set('schemaVersion', 1);
      metaMap.set('documentType', 'paywall');

      const snapshot = storage.load();

      expect(snapshot.meta).toEqual({
        schemaVersion: 1,
        documentType: 'paywall'
      });
    });

    it('should return null meta when metadata is incomplete', () => {
      const metaMap = ydoc.getMap('meta');
      metaMap.set('schemaVersion', 1);
      // Missing documentType

      const snapshot = storage.load();

      expect(snapshot.meta).toBeNull();
    });

    it('should return all nodes', () => {
      const nodesMap = ydoc.getMap('nodes');
      nodesMap.set('root', createTestRootNode());
      nodesMap.set('screen-1', createTestScreenNode('screen-1', 'Screen'));

      const snapshot = storage.load();

      expect(Object.keys(snapshot.nodes)).toHaveLength(2);
      expect(snapshot.nodes.root).toEqual(createTestRootNode());
      expect(snapshot.nodes['screen-1']).toEqual(
        createTestScreenNode('screen-1', 'Screen')
      );
    });
  });

  describe('save', () => {
    it('should save metadata', () => {
      storage.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {}
      });

      const metaMap = ydoc.getMap('meta');
      expect(metaMap.get('schemaVersion')).toBe(1);
      expect(metaMap.get('documentType')).toBe('paywall');
    });

    it('should save nodes', () => {
      storage.save({
        meta: null,
        nodes: {
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1')
        }
      });

      const nodesMap = ydoc.getMap('nodes');
      expect(nodesMap.get('root')).toEqual(createTestRootNode());
      expect(nodesMap.get('screen-1')).toEqual(
        createTestScreenNode('screen-1')
      );
    });

    it('should delete removed nodes', () => {
      // Initial save with two nodes
      storage.save({
        meta: null,
        nodes: {
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1')
        }
      });

      // Save again without screen-1
      storage.save({
        meta: null,
        nodes: {
          root: createTestRootNode()
        }
      });

      const nodesMap = ydoc.getMap('nodes');
      expect(nodesMap.has('screen-1')).toBe(false);
      expect(nodesMap.has('root')).toBe(true);
    });

    it('should save in a single transaction', () => {
      const transactSpy = vi.spyOn(ydoc, 'transact');

      storage.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1')
        }
      });

      expect(transactSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('observe', () => {
    it('should call callback when nodes change', () => {
      const callback = vi.fn();
      storage.observe(callback);

      const nodesMap = ydoc.getMap('nodes');
      nodesMap.set('root', createTestRootNode());

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls.at(0)?.[0];
      expect(snapshot?.nodes.root).toEqual(createTestRootNode());
    });

    it('should call callback when metadata changes', () => {
      const callback = vi.fn();
      storage.observe(callback);

      const metaMap = ydoc.getMap('meta');
      metaMap.set('schemaVersion', 1);

      expect(callback).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = storage.observe(callback);

      const nodesMap = ydoc.getMap('nodes');
      nodesMap.set('root', createTestRootNode());
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      nodesMap.set('screen-1', createTestScreenNode('screen-1'));
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('getNode', () => {
    it('should return node when valid and matches schema', () => {
      const rootNode = createTestRootNode();
      storage.save({
        meta: null,
        nodes: { root: rootNode }
      });

      const result = storage.getNode('root', 'root');

      expect(result).toEqual(rootNode);
    });

    it('should return undefined when node does not exist', () => {
      const result = storage.getNode('nonexistent', 'root');

      expect(result).toBeUndefined();
    });

    it('should return undefined when node does not match schema', () => {
      const nodesMap = ydoc.getMap('nodes');
      // Set invalid node data (missing required 'id' field)
      nodesMap.set('root', { type: 'root' });

      const result = storage.getNode('root', 'root');

      expect(result).toBeUndefined();
    });

    it('should return undefined when node type does not match', () => {
      const screenNode = createTestScreenNode();
      storage.save({
        meta: null,
        nodes: { 'screen-1': screenNode }
      });

      // Try to get screen node as root type
      const result = storage.getNode('screen-1', 'root');

      expect(result).toBeUndefined();
    });
  });

  describe('setNode', () => {
    it('should save node when valid', () => {
      const rootNode = createTestRootNode();

      storage.setNode('root', 'root', rootNode);

      const nodesMap = ydoc.getMap('nodes');
      expect(nodesMap.get('root')).toEqual(rootNode);
    });

    it('should throw error when node does not match schema', () => {
      // Invalid node (missing required 'id' field)
      // biome-ignore lint/suspicious/noExplicitAny: ok
      const invalidNode = { type: 'root' } as any;

      expect(() => {
        storage.setNode('root', 'root', invalidNode);
      }).toThrow('does not match schema');
    });

    it('should update existing node', () => {
      const rootNode1 = createTestRootNode('root-1');
      storage.setNode('root', 'root', createTestRootNode());

      storage.setNode('root', 'root', rootNode1);

      const nodesMap = ydoc.getMap('nodes');
      expect(nodesMap.get('root')).toEqual(rootNode1);
    });

    it('should save in a transaction', () => {
      const transactSpy = vi.spyOn(ydoc, 'transact');
      const rootNode = createTestRootNode();

      storage.setNode('root', 'root', rootNode);

      expect(transactSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Yjs collaboration', () => {
    it('should sync between two Y.Doc instances', () => {
      const ydoc1 = new Y.Doc();
      const ydoc2 = new Y.Doc();
      const storage1 = createYjsStorage(ydoc1, testDocument);
      const storage2 = createYjsStorage(ydoc2, testDocument);

      // Save to first storage
      storage1.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: { root: createTestRootNode() }
      });

      // Sync state from ydoc1 to ydoc2
      const stateVector = Y.encodeStateAsUpdate(ydoc1);
      Y.applyUpdate(ydoc2, stateVector);

      // Load from second storage
      const snapshot = storage2.load();

      expect(snapshot.meta).toEqual({
        schemaVersion: 1,
        documentType: 'paywall'
      });
      expect(snapshot.nodes.root).toEqual(createTestRootNode());
    });
  });
});
