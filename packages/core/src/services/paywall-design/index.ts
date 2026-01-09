/**
 * Paywall Design Persistence Services
 *
 * Provides persistence for the Mimic-based paywall designer:
 * - MySQL: Canonical state storage with soft deletes (via PaywallMimicColdStorageLive)
 * - Redis: WAL for real-time crash recovery (via RedisMimicHotStorageFromEnv from mimic service)
 * - S3: Published versions for CDN delivery
 */

// Error types
export {
  MySqlSnapshotError,
  S3PublishError,
  SchemaMigrationError,
  VersionConflictError,
} from "./errors";

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

// Mimic cold storage (MySQL-based)
export { PaywallMimicColdStorageLive } from "./paywall-mimic-cold-storage";
