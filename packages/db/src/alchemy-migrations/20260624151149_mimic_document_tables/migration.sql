-- Hand-written (not drizzle-generated): the mimic document tables are owned by
-- vendored/mimic/apps/mimic-db (see src/core/pg-store.ts, whose `ensureDocumentTables` DDL this
-- mirrors) and are deliberately excluded from the drizzle schema
-- (drizzle.config.ts filters `!mimic_*`). They must be created here because the
-- Worker's Hyperdrive credential may be a least-privilege role that can't run
-- DDL — only the migration pipeline (an admin role) is guaranteed to.
-- `IF NOT EXISTS` keeps this idempotent against dev/local databases that were
-- already bootstrapped by the runtime DDL path.
CREATE TABLE IF NOT EXISTS mimic_documents (
	id VARCHAR(36) NOT NULL PRIMARY KEY,
	collection_id VARCHAR(36) NOT NULL,
	schema_version INTEGER NOT NULL DEFAULT 1,
	migration_version INTEGER,
	current_seq BIGINT NOT NULL DEFAULT 0,
	snapshot_seq BIGINT NOT NULL DEFAULT 0,
	deleted_at BIGINT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mimic_document_snapshots (
	document_id VARCHAR(36) NOT NULL,
	seq BIGINT NOT NULL,
	schema_version INTEGER NOT NULL DEFAULT 1,
	state_json JSONB NOT NULL,
	PRIMARY KEY (document_id, seq)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mimic_document_commands (
	document_id VARCHAR(36) NOT NULL,
	seq BIGINT NOT NULL,
	command_json JSONB NOT NULL,
	tx_id VARCHAR(255) NOT NULL,
	PRIMARY KEY (document_id, seq)
);
