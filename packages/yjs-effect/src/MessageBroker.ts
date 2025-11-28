/**
 * MessageBroker service for real-time message distribution.
 * Provides an abstract interface for pub/sub and message streaming
 * that can be implemented with different backends (memory, Redis, etc.)
 *
 * @since 1.0.0
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import type * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';

/**
 * Result of fetching messages from history.
 *
 * @since 1.0.0
 */
export interface GetMessagesResult {
  readonly messages: readonly Uint8Array[];
  readonly lastId: string;
}

/**
 * MessageBroker service interface for real-time message distribution.
 *
 * @since 1.0.0
 */
export interface MessageBroker {
  /**
   * Publish a message to a room/docid channel.
   * The message will be stored in history and broadcast to subscribers.
   */
  readonly publish: (
    room: string,
    docid: string,
    message: Uint8Array
  ) => Effect.Effect<void>;

  /**
   * Subscribe to messages from a room/docid channel.
   * Returns a Stream that emits messages as they arrive.
   */
  readonly subscribe: (
    room: string,
    docid: string
  ) => Effect.Effect<Stream.Stream<Uint8Array>, never, Scope.Scope>;

  /**
   * Get historical messages since a given ID.
   * Returns messages and the new lastId for pagination.
   */
  readonly getMessages: (
    room: string,
    docid: string,
    since: string
  ) => Effect.Effect<GetMessagesResult>;

  /**
   * Get all current messages for a room/docid.
   * Returns null if no messages exist.
   */
  readonly getAllMessages: (
    room: string,
    docid: string
  ) => Effect.Effect<GetMessagesResult | null>;

  /**
   * Trim old messages from history up to a given ID.
   */
  readonly trimMessages: (
    room: string,
    docid: string,
    upToId: string
  ) => Effect.Effect<void>;
}

/**
 * MessageBroker service tag.
 *
 * @since 1.0.0
 */
export class MessageBrokerService extends Context.Tag(
  '@yjs-effect/MessageBroker'
)<MessageBrokerService, MessageBroker>() {}

// --- Memory Message Broker Implementation ---

/**
 * A stored message with its ID
 */
interface StoredMessage {
  readonly id: string;
  readonly data: Uint8Array;
}

/**
 * Channel state for memory broker
 */
interface ChannelState {
  readonly messages: StoredMessage[];
  readonly pubsub: PubSub.PubSub<Uint8Array>;
  nextId: number;
}

/**
 * Key for channel lookup
 */
const channelKey = (room: string, docid: string): string => `${room}:${docid}`;

/**
 * Parse message ID to number (for comparison)
 */
const parseId = (id: string): number => {
  const num = Number.parseInt(id, 10);
  return Number.isNaN(num) ? 0 : num;
};

/**
 * Create a memory-based message broker implementation.
 * Useful for testing and single-server deployments.
 *
 * @since 1.0.0
 */
export const makeMemoryMessageBroker = Effect.gen(function* () {
  const channelsRef = yield* Ref.make<Map<string, ChannelState>>(new Map());

  const getOrCreateChannel = (room: string, docid: string) =>
    Effect.gen(function* () {
      const key = channelKey(room, docid);
      const channels = yield* Ref.get(channelsRef);

      const existing = channels.get(key);
      if (existing) {
        return existing;
      }

      // Create new channel with unbounded pubsub
      const pubsub = yield* PubSub.unbounded<Uint8Array>();
      const channel: ChannelState = {
        messages: [],
        pubsub,
        nextId: 1
      };

      yield* Ref.update(channelsRef, (chs) => {
        const newChs = new Map(chs);
        newChs.set(key, channel);
        return newChs;
      });

      return channel;
    });

  const publish: MessageBroker['publish'] = (room, docid, message) =>
    Effect.gen(function* () {
      const channel = yield* getOrCreateChannel(room, docid);
      const id = String(channel.nextId++);
      channel.messages.push({ id, data: message });
      yield* PubSub.publish(channel.pubsub, message);
    });

  const subscribe: MessageBroker['subscribe'] = (room, docid) =>
    Effect.gen(function* () {
      const channel = yield* getOrCreateChannel(room, docid);
      const queue = yield* PubSub.subscribe(channel.pubsub);
      return Stream.fromQueue(queue);
    });

  const getMessages: MessageBroker['getMessages'] = (room, docid, since) =>
    Effect.gen(function* () {
      const channels = yield* Ref.get(channelsRef);
      const key = channelKey(room, docid);
      const channel = channels.get(key);

      if (!channel || channel.messages.length === 0) {
        return { messages: [], lastId: since };
      }

      const sinceNum = parseId(since);
      const filtered = channel.messages.filter((m) => parseId(m.id) > sinceNum);

      if (filtered.length === 0) {
        return { messages: [], lastId: since };
      }

      const lastMsg = filtered.at(-1);
      return {
        messages: filtered.map((m) => m.data),
        lastId: lastMsg ? lastMsg.id : since
      };
    });

  const getAllMessages: MessageBroker['getAllMessages'] = (room, docid) =>
    Effect.gen(function* () {
      const channels = yield* Ref.get(channelsRef);
      const key = channelKey(room, docid);
      const channel = channels.get(key);

      if (!channel || channel.messages.length === 0) {
        return null;
      }

      const lastMsg = channel.messages.at(-1);
      return {
        messages: channel.messages.map((m) => m.data),
        lastId: lastMsg ? lastMsg.id : '0'
      };
    });

  const trimMessages: MessageBroker['trimMessages'] = (room, docid, upToId) =>
    Effect.gen(function* () {
      const key = channelKey(room, docid);
      yield* Ref.update(channelsRef, (channels) => {
        const channel = channels.get(key);
        if (!channel) {
          return channels;
        }

        const upToNum = parseId(upToId);
        const filtered = channel.messages.filter(
          (m) => parseId(m.id) > upToNum
        );

        const newChannel: ChannelState = {
          ...channel,
          messages: filtered
        };

        const newChannels = new Map(channels);
        newChannels.set(key, newChannel);
        return newChannels;
      });
    });

  return {
    publish,
    subscribe,
    getMessages,
    getAllMessages,
    trimMessages
  } as const satisfies MessageBroker;
});

/**
 * Layer providing a memory-based message broker implementation.
 *
 * @since 1.0.0
 */
export const MemoryMessageBrokerLive: Layer.Layer<MessageBrokerService> =
  Layer.effect(MessageBrokerService, makeMemoryMessageBroker);
