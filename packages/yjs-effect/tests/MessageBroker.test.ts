/**
 * MessageBroker tests
 *
 * @since 1.0.0
 */
import { describe, expect, it } from '@effect/vitest';
import { Chunk, Effect, Fiber, Stream } from 'effect';

import {
  MemoryMessageBrokerLive,
  MessageBrokerService
} from '../src/MessageBroker.js';

describe('MemoryMessageBroker', () => {
  it.effect('publishes and receives messages via subscription', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      // Start subscription
      const stream = yield* broker.subscribe('room1', 'doc1');

      // Publish messages
      yield* broker.publish('room1', 'doc1', new Uint8Array([1, 2, 3]));
      yield* broker.publish('room1', 'doc1', new Uint8Array([4, 5, 6]));

      // Take first two messages from stream
      const messages = yield* stream.pipe(Stream.take(2), Stream.runCollect);

      expect(Chunk.toArray(messages)).toHaveLength(2);
      expect(Chunk.toArray(messages)[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(Chunk.toArray(messages)[1]).toEqual(new Uint8Array([4, 5, 6]));
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );

  it.effect('stores messages in history and retrieves with getMessages', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      // Publish messages
      yield* broker.publish('room1', 'doc1', new Uint8Array([1]));
      yield* broker.publish('room1', 'doc1', new Uint8Array([2]));
      yield* broker.publish('room1', 'doc1', new Uint8Array([3]));

      // Get all messages
      const result = yield* broker.getAllMessages('room1', 'doc1');
      expect(result).not.toBeNull();
      if (result === null) {
        return;
      }
      expect(result.messages.length).toBe(3);

      // Get messages since first
      const sinceResult = yield* broker.getMessages('room1', 'doc1', '1');
      expect(sinceResult.messages.length).toBe(2);
      expect(sinceResult.messages[0]).toEqual(new Uint8Array([2]));
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );

  it.effect('returns null for non-existent channels', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      const result = yield* broker.getAllMessages('nonexistent', 'doc');
      expect(result).toBeNull();
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );

  it.effect('trims old messages correctly', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      // Publish messages
      yield* broker.publish('room1', 'doc1', new Uint8Array([1]));
      yield* broker.publish('room1', 'doc1', new Uint8Array([2]));
      yield* broker.publish('room1', 'doc1', new Uint8Array([3]));

      // Trim messages up to id 2
      yield* broker.trimMessages('room1', 'doc1', '2');

      // Only message 3 should remain
      const result = yield* broker.getAllMessages('room1', 'doc1');
      expect(result).not.toBeNull();
      if (result === null) {
        return;
      }
      expect(result.messages.length).toBe(1);
      expect(result.messages[0]).toEqual(new Uint8Array([3]));
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );

  it.effect('isolates messages between different rooms', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      yield* broker.publish('room1', 'doc1', new Uint8Array([1]));
      yield* broker.publish('room2', 'doc1', new Uint8Array([2]));

      const room1 = yield* broker.getAllMessages('room1', 'doc1');
      const room2 = yield* broker.getAllMessages('room2', 'doc1');

      expect(room1).not.toBeNull();
      expect(room2).not.toBeNull();
      if (room1 === null || room2 === null) {
        return;
      }

      expect(room1.messages.length).toBe(1);
      expect(room1.messages[0]).toEqual(new Uint8Array([1]));

      expect(room2.messages.length).toBe(1);
      expect(room2.messages[0]).toEqual(new Uint8Array([2]));
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );

  it.effect('multiple subscribers receive same messages', () =>
    Effect.gen(function* () {
      const broker = yield* MessageBrokerService;

      // Create two subscribers
      const stream1 = yield* broker.subscribe('room1', 'doc1');
      const stream2 = yield* broker.subscribe('room1', 'doc1');

      // Start collecting in background
      const fiber1 = yield* stream1.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      );
      const fiber2 = yield* stream2.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      );

      // Publish message
      yield* broker.publish('room1', 'doc1', new Uint8Array([42]));

      // Both should receive the message
      const messages1 = yield* Fiber.join(fiber1);
      const messages2 = yield* Fiber.join(fiber2);

      expect(Chunk.toArray(messages1)).toHaveLength(1);
      expect(Chunk.toArray(messages2)).toHaveLength(1);
      expect(Chunk.toArray(messages1)[0]).toEqual(new Uint8Array([42]));
      expect(Chunk.toArray(messages2)[0]).toEqual(new Uint8Array([42]));
    }).pipe(Effect.scoped, Effect.provide(MemoryMessageBrokerLive))
  );
});
