/**
 * yjs-effect - Effect-based Yjs collaboration backend
 *
 * @since 1.0.0
 */

// Auth
export {
  type AccessLevel,
  AllowAllAuthLive,
  type Auth,
  AuthError,
  type AuthErrorReason,
  type AuthResult,
  AuthService,
  type CustomAuthConfig,
  extractToken,
  extractTokenFromProtocol,
  extractTokenFromQuery,
  makeAllowAllAuth,
  makeCustomAuth,
  type Permission
} from './Auth.js';

// MessageBroker
export {
  type GetMessagesResult,
  MemoryMessageBrokerLive,
  type MessageBroker,
  MessageBrokerService,
  makeMemoryMessageBroker
} from './MessageBroker.js';

// Protocol
export {
  convertSyncStep2ToUpdate,
  encodeAwarenessUpdate,
  encodeAwarenessUserDisconnected,
  encodeSyncStep1,
  encodeSyncStep2,
  encodeSyncUpdate,
  isAwarenessUpdate,
  isSyncUpdate,
  MESSAGE_AUTH,
  MESSAGE_AWARENESS,
  MESSAGE_QUERY_AWARENESS,
  MESSAGE_SYNC,
  MESSAGE_SYNC_STEP1,
  MESSAGE_SYNC_STEP2,
  MESSAGE_SYNC_UPDATE,
  mergeMessages,
  type ParsedMessage,
  parseMessage
} from './Protocol.js';
// Storage
export {
  MemoryStorageLive,
  makeMemoryStorage,
  type RetrieveDocResult,
  type Storage,
  StorageService
} from './Storage.js';

// YjsServer
export {
  type ConnectionState,
  makeYjsHandler,
  makeYjsServer,
  type YjsEndpointOptions,
  type YjsServer,
  YjsServerLive,
  YjsServerService
} from './YjsServer.js';
