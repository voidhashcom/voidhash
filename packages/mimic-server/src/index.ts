export {
  CollectionHandle,
  DatabaseHandle,
  MimicSDK,
  RawCollectionHandle,
} from "./promise/MimicSDK.ts";
export type {
  CollectionInfo,
  CreateUserResult,
  DatabaseInfo,
  DatabaseMigrationChange,
  DatabaseMigrationInfo,
  DocumentAuthenticationSetup,
  DocumentSnapshot,
  RawDocumentSnapshot,
  SetupDocumentAuthenticationOptions,
  SnapshotFor,
} from "./effect/types.ts";
export type { MimicClientConfig } from "./effect/RpcClient.ts";

// Re-export tagged errors so consumers can `instanceof`-check them.
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
} from "./rpc/index.ts";
export type { DatabasePermission, DocumentPermission, Grant, User } from "./rpc/index.ts";
