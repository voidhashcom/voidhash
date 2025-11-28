/**
 * Yjs WebSocket server using @effect/platform.
 * Provides real-time collaboration over WebSocket connections.
 *
 * @since 1.0.0
 */
/** biome-ignore-all lint/nursery/noBitwiseOperators: We use it */
import type * as Socket from '@effect/platform/Socket';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import type * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
  type AuthError,
  type AuthResult,
  AuthService,
  extractToken
} from './Auth.js';
import { MessageBrokerService } from './MessageBroker.js';
import * as Protocol from './Protocol.js';
import { StorageService } from './Storage.js';

// --- Connection State ---

/**
 * State for a connected client
 *
 * @since 1.0.0
 */
export interface ConnectionState {
  readonly room: string;
  readonly docid: string;
  readonly userid: string;
  readonly hasWriteAccess: boolean;
  readonly awarenessId: Option.Option<number>;
  readonly awarenessLastClock: number;
}

// --- Yjs Server Service ---

/**
 * YjsServer service interface
 *
 * @since 1.0.0
 */
export interface YjsServer {
  /**
   * Handle a WebSocket connection.
   * This processes the Yjs sync protocol and awareness.
   */
  readonly handleConnection: (
    socket: Socket.Socket,
    room: string,
    auth: AuthResult
  ) => Effect.Effect<void, Socket.SocketError, Scope.Scope>;

  /**
   * Get the current document state for a room.
   */
  readonly getDocument: (
    room: string,
    docid?: string
  ) => Effect.Effect<{
    readonly ydoc: Y.Doc;
    readonly awareness: awarenessProtocol.Awareness;
  }>;
}

/**
 * YjsServer service tag.
 *
 * @since 1.0.0
 */
export class YjsServerService extends Context.Tag('@yjs-effect/YjsServer')<
  YjsServerService,
  YjsServer
>() {}

// --- Implementation ---

/**
 * Create the Yjs server implementation.
 *
 * @since 1.0.0
 */
export const makeYjsServer = Effect.gen(function* () {
  const storage = yield* StorageService;
  const broker = yield* MessageBrokerService;

  const getDocument: YjsServer['getDocument'] = (room, docid = 'index') =>
    Effect.gen(function* () {
      const ydoc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(ydoc);
      awareness.setLocalState(null); // Server doesn't have local state

      // Load from storage
      const stored = yield* storage.retrieveDoc(room, docid);
      if (stored) {
        Y.applyUpdateV2(ydoc, stored.doc);
      }

      // Apply messages from broker
      const messages = yield* broker.getAllMessages(room, docid);
      if (messages) {
        for (const msg of messages.messages) {
          const parsed = Protocol.parseMessage(msg);
          if (parsed.type === 'sync' && parsed.syncType === 'update') {
            Y.applyUpdate(ydoc, parsed.update);
          } else if (parsed.type === 'awareness') {
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              parsed.update,
              null
            );
          }
        }
      }

      return { ydoc, awareness };
    });

  const handleConnection: YjsServer['handleConnection'] = (
    socket,
    room,
    auth
  ) =>
    Effect.gen(function* () {
      const docid = 'index';
      const stateRef = yield* Ref.make<ConnectionState>({
        room,
        docid,
        userid: auth.userid,
        hasWriteAccess: auth.hasWriteAccess,
        awarenessId: Option.none(),
        awarenessLastClock: 0
      });

      // Get writer for sending messages
      const write = yield* socket.writer;

      // Load initial document state
      const { ydoc, awareness } = yield* getDocument(room, docid);

      // Send initial sync messages
      const stateVector = Y.encodeStateVector(ydoc);
      yield* write(Protocol.encodeSyncStep1(stateVector));

      const update = Y.encodeStateAsUpdate(ydoc);
      yield* write(Protocol.encodeSyncStep2(update));

      // Send current awareness states
      const awarenessStates = awareness.getStates();
      if (awarenessStates.size > 0) {
        yield* write(
          Protocol.encodeAwarenessUpdate(awareness, [...awarenessStates.keys()])
        );
      }

      // Subscribe to broker for updates from other clients
      const brokerStream = yield* broker.subscribe(room, docid);

      // Fork the broker subscription to forward messages to this client
      const brokerFiber = yield* brokerStream.pipe(
        Stream.tap((msg) => write(msg)),
        Stream.runDrain,
        Effect.fork
      );

      // Handle incoming messages
      yield* socket.run((data) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);

          // Only process write operations if client has write access
          if (!state.hasWriteAccess) {
            return;
          }

          const parsed = Protocol.parseMessage(data);

          if (parsed.type === 'sync') {
            if (parsed.syncType === 'update' || parsed.syncType === 'step2') {
              // Forward update to broker (which will broadcast to all clients)
              const updateMsg =
                parsed.syncType === 'update'
                  ? data
                  : Protocol.encodeSyncUpdate(parsed.diff);
              yield* broker.publish(room, docid, updateMsg);
            }
            // Sync step 1 can be ignored - we send full state on connect
          } else if (parsed.type === 'awareness') {
            // Track awareness state for cleanup on disconnect
            const decoder = { offset: 0 };
            const len = readVarUint(parsed.update, decoder);
            if (len === 1) {
              const clientId = readVarUint(parsed.update, decoder);
              const clock = readVarUint(parsed.update, decoder);
              yield* Ref.update(stateRef, (s) => ({
                ...s,
                awarenessId: Option.some(clientId),
                awarenessLastClock: clock
              }));
            }
            // Forward awareness to broker
            yield* broker.publish(room, docid, data);
          }
        })
      );

      // Cleanup on disconnect
      const finalState = yield* Ref.get(stateRef);
      if (Option.isSome(finalState.awarenessId)) {
        const disconnectMsg = Protocol.encodeAwarenessUserDisconnected(
          finalState.awarenessId.value,
          finalState.awarenessLastClock
        );
        yield* broker.publish(room, docid, disconnectMsg);
      }

      yield* Fiber.interrupt(brokerFiber);
    });

  return {
    handleConnection,
    getDocument
  } satisfies YjsServer;
});

/**
 * Layer providing the Yjs server.
 *
 * @since 1.0.0
 */
export const YjsServerLive: Layer.Layer<
  YjsServerService,
  never,
  StorageService | MessageBrokerService
> = Layer.effect(YjsServerService, makeYjsServer);

// --- WebSocket Server Integration ---

/**
 * Options for creating a Yjs WebSocket endpoint
 *
 * @since 1.0.0
 */
export interface YjsEndpointOptions {
  /**
   * Extract room name from the request.
   * Default: uses first path segment after base path.
   */
  readonly extractRoom?: (url: string) => string;

  /**
   * Extract auth token from the request.
   * Default: uses "yauth" from protocol or query string.
   */
  readonly extractToken?: (
    protocols: string | undefined,
    query: string | undefined
  ) => Effect.Effect<string, AuthError>;

  /**
   * Called when a document is first accessed and has no content.
   * Can be used to initialize the document with default data.
   */
  readonly initDocument?: (room: string, docid: string) => Effect.Effect<void>;
}

/**
 * Create a WebSocket connection handler for Yjs.
 * This can be used with the SocketServer from @effect/platform.
 *
 * @example
 * ```typescript
 * const handler = yield* makeYjsHandler({
 *   extractRoom: (url) => url.split('/')[1]
 * })
 *
 * yield* SocketServer.run(handler)
 * ```
 *
 * @since 1.0.0
 */
export const makeYjsHandler = (options: YjsEndpointOptions = {}) =>
  Effect.gen(function* () {
    const yjsServer = yield* YjsServerService;
    const auth = yield* AuthService;

    const defaultExtractRoom = (url: string): string => {
      const urlPath = url.split('?')[0] ?? '';
      const segments = urlPath.split('/').filter(Boolean);
      return segments[0] ?? 'default';
    };

    const roomExtractor = options.extractRoom ?? defaultExtractRoom;
    const tokenExtractor = options.extractToken ?? extractToken;

    return (
      socket: Socket.Socket,
      url: string,
      protocols?: string,
      query?: string
    ) =>
      Effect.gen(function* () {
        const room = roomExtractor(url);
        const token = yield* tokenExtractor(protocols, query);
        const authResult = yield* auth.authenticate(room, token);

        yield* yjsServer.handleConnection(socket, room, authResult);
      }).pipe(Effect.scoped);
  });

// --- Helper Functions ---

/**
 * Read a variable-length unsigned integer (for awareness parsing)
 */
const readVarUint = (data: Uint8Array, decoder: { offset: number }): number => {
  let num = 0;
  let mult = 1;
  while (decoder.offset < data.length) {
    const byte = data.at(decoder.offset);
    decoder.offset++;
    if (byte === undefined) {
      break;
    }
    num += (byte & 127) * mult;
    if (byte < 128) {
      break;
    }
    mult *= 128;
  }
  return num;
};
