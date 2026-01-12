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

// Mimic cold storage (MySQL-based)
export { PaywallMimicColdStorageLive } from "./paywall-mimic-cold-storage";
export { RedisMimicHotStorageLive } from "./redis-mimic-hot-storage";
