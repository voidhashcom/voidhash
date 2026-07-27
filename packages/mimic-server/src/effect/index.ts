export { type MimicClientConfig, makeMimicProtocolLayer } from "./RpcClient.ts";
export { MimicSDK } from "./MimicSDK.ts";
export { DatabaseHandle } from "./DatabaseHandle.ts";
export { CollectionHandle } from "./CollectionHandle.ts";
export {
  RawCollectionHandle,
  type RawConnectedTransactionInput,
  type RawDocumentConnectionInput,
  type RawTransactionInput,
  type RawTransactionResult,
} from "./RawCollectionHandle.ts";
export type {
  CollectionInfo,
  CreateUserResult,
  DatabaseInfo,
  DocumentAuthenticationSetup,
  DocumentSnapshot,
  RawDocumentSnapshot,
  SetupDocumentAuthenticationOptions,
  SnapshotFor,
} from "./types.ts";

// Re-export tagged errors so consumers don't have to import the `./rpc` subpath
// just to catch errors thrown by the SDK.
export {
  ConflictError,
  ForbiddenError,
  InternalError,
  InvalidSchemaError,
  InvalidValueError,
  MigrationFailedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VersionConflictError,
} from "../rpc/index.ts";
export type { DatabasePermission, DocumentPermission, Grant, User } from "../rpc/index.ts";
