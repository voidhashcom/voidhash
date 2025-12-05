import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { YjsStorage } from './yjs-storage';

describe('YjsStorage', () => {
  let ydoc: Y.Doc;
  let storage: YjsStorage;

  beforeEach(() => {
    ydoc = new Y.Doc();
    storage = new YjsStorage(ydoc);
  });

  describe('constructor', () => {
    it('should expose the ydoc', () => {
      expect(storage.ydoc).toBe(ydoc);
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
      nodesMap.set('root', { type: 'root', id: 'root' });
      nodesMap.set('screen-1', {
        type: 'screen',
        id: 'screen-1',
        name: 'Screen'
      });

      const snapshot = storage.load();

      expect(Object.keys(snapshot.nodes)).toHaveLength(2);
      expect(snapshot.nodes.root).toEqual({ type: 'root', id: 'root' });
      expect(snapshot.nodes['screen-1']).toEqual({
        type: 'screen',
        id: 'screen-1',
        name: 'Screen'
      });
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
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1' }
        }
      });

      const nodesMap = ydoc.getMap('nodes');
      expect(nodesMap.get('root')).toEqual({ type: 'root', id: 'root' });
      expect(nodesMap.get('screen-1')).toEqual({
        type: 'screen',
        id: 'screen-1'
      });
    });

    it('should delete removed nodes', () => {
      // Initial save with two nodes
      storage.save({
        meta: null,
        nodes: {
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1' }
        }
      });

      // Save again without screen-1
      storage.save({
        meta: null,
        nodes: {
          root: { type: 'root', id: 'root' }
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
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1' }
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
      nodesMap.set('root', { type: 'root', id: 'root' });

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls.at(0)?.[0];
      expect(snapshot?.nodes.root).toEqual({ type: 'root', id: 'root' });
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
      nodesMap.set('root', { type: 'root', id: 'root' });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      nodesMap.set('screen-1', { type: 'screen', id: 'screen-1' });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('size', () => {
    it('should return 0 when no nodes exist', () => {
      expect(storage.size).toBe(0);
    });

    it('should return the number of nodes', () => {
      storage.save({
        meta: null,
        nodes: {
          root: { type: 'root', id: 'root' },
          'screen-1': { type: 'screen', id: 'screen-1' }
        }
      });

      expect(storage.size).toBe(2);
    });
  });

  describe('Yjs collaboration', () => {
    it('should sync between two Y.Doc instances', () => {
      const ydoc1 = new Y.Doc();
      const ydoc2 = new Y.Doc();
      const storage1 = new YjsStorage(ydoc1);
      const storage2 = new YjsStorage(ydoc2);

      // Save to first storage
      storage1.save({
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: { root: { type: 'root', id: 'root' } }
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
      expect(snapshot.nodes.root).toEqual({ type: 'root', id: 'root' });
    });
  });
});
