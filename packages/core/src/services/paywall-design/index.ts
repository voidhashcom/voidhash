/**
 * Paywall Design Persistence Services
 *
 * Provides a 3-tier persistence layer for the Mimic-based paywall designer:
 * - Redis: Safety buffer for real-time crash recovery
 * - MySQL: Canonical state storage with soft deletes
 * - S3: Published versions for CDN delivery
 */

// Error types
export * from "./errors";

// Schema migration
export {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  migrateState,
  migrateStateSync,
  needsMigration,
  wrapWithVersion,
  type VersionedState,
} from "./schema-migration";

// Redis operations log
export {
  Default as RedisOperationsLogDefault,
  layer as redisOperationsLogLayer,
  layerFromEnv as redisOperationsLogLayerFromEnv,
  RedisOperationsLogTag,
  type RedisConfig,
  type RedisOperationsLog,
  type RedisStateSnapshot,
} from "./redis-operations-log";

// MySQL snapshot store
export {
  Default as MySqlSnapshotStoreDefault,
  layer as mysqlSnapshotStoreLayer,
  MySqlSnapshotStoreTag,
  type DesignStateRecord,
  type MySqlSnapshotStore,
  type SaveDesignStateInput,
  type SaveDesignStateResult,
} from "./mysql-snapshot-store";

// Debounce manager
export {
  Default as DebounceManagerDefault,
  DebounceManagerTag,
  layer as debounceManagerLayer,
  type DebounceManager,
  type FlushFn,
} from "./debounce-manager";

// S3 publish store
export {
  Default as S3PublishStoreDefault,
  layer as s3PublishStoreLayer,
  layerFromEnv as s3PublishStoreLayerFromEnv,
  makeS3ClientLayer,
  S3ClientLayer,
  S3ClientLayerTest,
  S3PublishStoreTag,
  type PublishedVersionRecord,
  type PublishInput,
  type PublishResult,
  type S3Config,
  type S3PublishStore,
} from "./s3-publish-store";

// Main storage adapter
export {
  FullStorageLayerFromEnv,
  makeFullStorageLayer,
  PaywallDesignStorageLayer,
} from "./mimic-storage-adapter";
