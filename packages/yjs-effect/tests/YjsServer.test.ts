/**
 * YjsServer tests
 *
 * @since 1.0.0
 */
import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import * as Y from 'yjs';

import { AllowAllAuthLive } from '../src/Auth.js';
import { MemoryMessageBrokerLive } from '../src/MessageBroker.js';
import * as Protocol from '../src/Protocol.js';
import { MemoryStorageLive, StorageService } from '../src/Storage.js';
import { YjsServerLive, YjsServerService } from '../src/YjsServer.js';

// Create a test layer with all dependencies
const TestLayer = Layer.mergeAll(
  YjsServerLive.pipe(
    Layer.provide(MemoryStorageLive),
    Layer.provide(MemoryMessageBrokerLive)
  ),
  MemoryStorageLive,
  AllowAllAuthLive
);

describe('YjsServer', () => {
  it.effect('getDocument returns empty doc for new room', () =>
    Effect.gen(function* () {
      const server = yield* YjsServerService;

      const { ydoc, awareness } = yield* server.getDocument('new-room');

      // Should have empty doc
      expect(ydoc.store.clients.size).toBe(0);
      // Awareness should be set up but with no local state
      expect(awareness.getLocalState()).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('getDocument loads document from storage', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService;
      const server = yield* YjsServerService;

      // Pre-populate storage
      const initialDoc = new Y.Doc();
      initialDoc.getMap('data').set('key', 'value');
      yield* storage.persistDoc('test-room', 'index', initialDoc);

      // Get document through server
      const { ydoc } = yield* server.getDocument('test-room');

      expect(ydoc.getMap('data').get('key')).toBe('value');
    }).pipe(Effect.provide(TestLayer))
  );
});

describe('Protocol', () => {
  it('encodes and parses sync step 1', () => {
    const stateVector = new Uint8Array([1, 2, 3]);
    const encoded = Protocol.encodeSyncStep1(stateVector);
    const parsed = Protocol.parseMessage(encoded);

    expect(parsed.type).toBe('sync');
    if (parsed.type === 'sync') {
      expect(parsed.syncType).toBe('step1');
      if (parsed.syncType === 'step1') {
        expect(parsed.stateVector).toEqual(stateVector);
      }
    }
  });

  it('encodes and parses sync step 2', () => {
    const diff = new Uint8Array([4, 5, 6]);
    const encoded = Protocol.encodeSyncStep2(diff);
    const parsed = Protocol.parseMessage(encoded);

    expect(parsed.type).toBe('sync');
    if (parsed.type === 'sync') {
      expect(parsed.syncType).toBe('step2');
      if (parsed.syncType === 'step2') {
        expect(parsed.diff).toEqual(diff);
      }
    }
  });

  it('encodes and parses sync update', () => {
    const update = new Uint8Array([7, 8, 9]);
    const encoded = Protocol.encodeSyncUpdate(update);
    const parsed = Protocol.parseMessage(encoded);

    expect(parsed.type).toBe('sync');
    if (parsed.type === 'sync') {
      expect(parsed.syncType).toBe('update');
      if (parsed.syncType === 'update') {
        expect(parsed.update).toEqual(update);
      }
    }
  });

  it('identifies sync updates correctly', () => {
    const update = Protocol.encodeSyncUpdate(new Uint8Array([1]));
    const step1 = Protocol.encodeSyncStep1(new Uint8Array([1]));
    const step2 = Protocol.encodeSyncStep2(new Uint8Array([1]));

    expect(Protocol.isSyncUpdate(update)).toBe(true);
    expect(Protocol.isSyncUpdate(step1)).toBe(false);
    expect(Protocol.isSyncUpdate(step2)).toBe(true);
  });

  it('converts sync step 2 to update', () => {
    const diff = new Uint8Array([1, 2, 3]);
    const step2 = Protocol.encodeSyncStep2(diff);
    const update = Protocol.convertSyncStep2ToUpdate(step2);

    expect(update).not.toBeNull();
    if (update) {
      const parsed = Protocol.parseMessage(update);
      expect(parsed.type).toBe('sync');
      if (parsed.type === 'sync') {
        expect(parsed.syncType).toBe('update');
      }
    }
  });

  it('merges multiple updates from same doc', () => {
    // Create a doc and make changes
    const doc = new Y.Doc();

    // Capture updates
    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => {
      updates.push(update);
    });

    doc.getMap().set('a', 1);
    doc.getMap().set('b', 2);

    // Create protocol messages from updates
    const messages = updates.map((u) => Protocol.encodeSyncUpdate(u));
    const merged = Protocol.mergeMessages(messages);

    // Should produce merged updates
    expect(merged.length).toBeGreaterThanOrEqual(1);

    // Apply all merged updates to new doc
    const resultDoc = new Y.Doc();
    for (const msg of merged) {
      const parsed = Protocol.parseMessage(msg);
      if (parsed.type === 'sync' && parsed.syncType === 'update') {
        Y.applyUpdate(resultDoc, parsed.update);
      }
    }
    expect(resultDoc.getMap().get('a')).toBe(1);
    expect(resultDoc.getMap().get('b')).toBe(2);
  });

  it('handles empty message array', () => {
    const merged = Protocol.mergeMessages([]);
    expect(merged.length).toBe(0);
  });

  it('handles single message array', () => {
    const update = Protocol.encodeSyncUpdate(new Uint8Array([1, 2, 3]));
    const merged = Protocol.mergeMessages([update]);
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual(update);
  });
});
