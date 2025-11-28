/**
 * Yjs WebSocket route handler for real-time collaboration
 *
 * @since 1.0.0
 */
import {
  HttpLayerRouter,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform';
import {
  AllowAllAuthLive,
  AuthService,
  extractToken,
  MemoryMessageBrokerLive,
  MemoryStorageLive,
  YjsServerLive,
  YjsServerService
} from '@voidhash/yjs-effect';
import { Effect, Layer } from 'effect';

// Regex for extracting room from URL path
const ROOM_PATH_REGEX = /^\/yjs\/(.+)$/;

/**
 * Handle WebSocket upgrade for Yjs collaboration
 */
const handleYjsConnection = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const yjsServer = yield* YjsServerService;
  const auth = yield* AuthService;

  // Extract room from URL path (e.g., /yjs/my-room -> my-room)
  const urlPath = request.url;
  const roomMatch = ROOM_PATH_REGEX.exec(urlPath);
  const room = roomMatch?.[1] ?? 'default';

  // Extract auth token from headers or query
  const protocols = request.headers['sec-websocket-protocol'];
  const queryString = request.originalUrl.split('?')[1];

  // Get token - for now allow anonymous if no token provided
  const tokenResult = yield* extractToken(protocols, queryString).pipe(
    Effect.catchAll(() => Effect.succeed('anonymous'))
  );

  // Authenticate
  const authResult = yield* auth.authenticate(room, tokenResult);

  // Upgrade to WebSocket
  const socket = yield* request.upgrade;

  // Handle the Yjs connection
  yield* yjsServer.handleConnection(socket, room, authResult);

  // Return empty response (upgrade handles the connection)
  return HttpServerResponse.empty();
});

/**
 * Yjs services layer - provides all Yjs-related services
 */
const YjsServicesLayer = Layer.mergeAll(
  YjsServerLive.pipe(
    Layer.provide(MemoryStorageLive),
    Layer.provide(MemoryMessageBrokerLive)
  ),
  AllowAllAuthLive
);

/**
 * Create the route registration effect with services provided
 */
const registerYjsRoutes = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;

  // Handle GET /yjs/:room - WebSocket upgrade
  yield* router.add(
    'GET',
    '/yjs/*',
    handleYjsConnection.pipe(
      Effect.provide(YjsServicesLayer),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('Yjs connection error', error);
          return HttpServerResponse.text('WebSocket upgrade failed', {
            status: 400
          });
        })
      )
    )
  );
});

/**
 * Yjs WebSocket route layer
 *
 * Handles WebSocket connections at /yjs/:room
 */
export const YjsRouteLayer = Layer.effectDiscard(registerYjsRoutes);
