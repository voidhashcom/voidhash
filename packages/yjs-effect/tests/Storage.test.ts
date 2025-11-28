/**
 * Storage tests - ported from y-redis storage.tests.js
 *
 * @since 1.0.0
 */
import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import * as Y from 'yjs';

import { MemoryStorageLive, StorageService } from '../src/Storage.js';

describe('MemoryStorage', () => {
  it.effect('persists and retrieves documents with correct state vector', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;

      // Create and persist first document
      const ydoc1 = new Y.Doc();
      ydoc1.getMap().set('a', 1);

      yield* storage.persistDoc('room', 'index', ydoc1);

      // Verify state vector matches
      const sv1 = yield* storage.retrieveStateVector('room', 'index');
      expect(sv1).not.toBeNull();
      if (sv1 === null) {
        return;
      }
      expect(new Uint8Array(sv1)).toEqual(Y.encodeStateVector(ydoc1));
    }).pipe(Effect.provide(MemoryStorageLive))
  );

  it.effect('stores multiple versions and merges them on retrieval', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;

      // First doc with change a=1
      const ydoc1 = new Y.Doc();
      ydoc1.getMap().set('a', 1);
      yield* storage.persistDoc('room', 'index', ydoc1);

      // Second doc with different change b=1 (same index key)
      const ydoc2 = new Y.Doc();
      ydoc2.getMap().set('b', 1);
      yield* storage.persistDoc('room', 'index', ydoc2);

      // Third doc stored under different key
      const ydoc3 = new Y.Doc();
      ydoc3.getMap().set('a', 2);
      yield* storage.persistDoc('room', 'doc3', ydoc3);

      // Verify state vector for doc3
      const sv2 = yield* storage.retrieveStateVector('room', 'doc3');
      expect(sv2).not.toBeNull();
      if (sv2 === null) {
        return;
      }
      expect(new Uint8Array(sv2)).toEqual(Y.encodeStateVector(ydoc3));

      // Retrieve and verify merged document
      const r1 = yield* storage.retrieveDoc('room', 'index');
      expect(r1).not.toBeNull();
      if (r1 === null) {
        return;
      }
      expect(r1.references.length).toBe(2); // Two versions stored

      const mergedDoc = new Y.Doc();
      Y.applyUpdateV2(mergedDoc, r1.doc);
      // Should have merged both changes
      expect(mergedDoc.getMap().get('a')).toBe(1);
      expect(mergedDoc.getMap().get('b')).toBe(1);

      // Retrieve doc3 and verify
      const r3 = yield* storage.retrieveDoc('room', 'doc3');
      expect(r3).not.toBeNull();
      if (r3 === null) {
        return;
      }
      expect(r3.references.length).toBe(1);

      const doc3 = new Y.Doc();
      Y.applyUpdateV2(doc3, r3.doc);
      expect(doc3.getMap().get('a')).toBe(2);
    }).pipe(Effect.provide(MemoryStorageLive))
  );

  it.effect('deletes references correctly', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;

      // Create two versions
      const ydoc1 = new Y.Doc();
      ydoc1.getMap().set('a', 1);
      yield* storage.persistDoc('room', 'index', ydoc1);

      const ydoc2 = new Y.Doc();
      ydoc2.getMap().set('b', 1);
      yield* storage.persistDoc('room', 'index', ydoc2);

      // Get initial state with 2 references
      const r1 = yield* storage.retrieveDoc('room', 'index');
      expect(r1).not.toBeNull();
      if (r1 === null) {
        return;
      }
      expect(r1.references.length).toBe(2);

      // Delete first reference
      yield* storage.deleteReferences('room', 'index', [r1.references[0]]);

      const r1v2 = yield* storage.retrieveDoc('room', 'index');
      expect(r1v2).not.toBeNull();
      if (r1v2 === null) {
        return;
      }
      expect(r1v2.references.length).toBe(1);

      // Delete second reference
      yield* storage.deleteReferences('room', 'index', [r1.references[1]]);

      const r1v3 = yield* storage.retrieveDoc('room', 'index');
      expect(r1v3).toBeNull();
    }).pipe(Effect.provide(MemoryStorageLive))
  );

  it.effect('returns null for non-existent documents', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;

      const sv = yield* storage.retrieveStateVector(
        'nonexistent',
        'nonexistent'
      );
      expect(sv).toBeNull();

      const doc = yield* storage.retrieveDoc('nonexistent', 'nonexistent');
      expect(doc).toBeNull();
    }).pipe(Effect.provide(MemoryStorageLive))
  );
});
