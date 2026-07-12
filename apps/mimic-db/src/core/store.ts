import type { Command, SchemaObject, Value } from "@voidhash/mimic-core";
import type { DatabasePermission, DocumentPermission } from "@voidhash/mimic-server/rpc";
import { Context, type Effect } from "effect";

// =============================================================================
// Control-plane records — owned by the configured control entity store.
// =============================================================================

export interface DatabaseRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface CollectionRecord {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schemaJson: SchemaObject;
  readonly schemaVersion: number;
  readonly migrationVersion: number | null;
}

/** A persisted legacy schema version retained for source-free reconciliation. */
export interface SchemaVersionRecord {
  readonly collectionId: string;
  readonly version: number;
  readonly schemaJson: SchemaObject;
  readonly dataMigrationSource: string | null;
}

export interface UserRecord {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly isSuperuser: boolean;
}

export interface GrantRecord {
  readonly id: string;
  readonly userId: string;
  readonly databaseId: string;
  readonly permission: DatabasePermission;
}

export interface TokenRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly collectionId: string;
  readonly documentId: string;
  readonly permission: DocumentPermission;
  readonly origins: readonly string[];
  readonly expiresAtMs: number;
  readonly usedAt: number | null;
}

/** Lightweight index of which documents exist in which collection. */
export interface DocumentIndexRecord {
  readonly documentId: string;
  readonly collectionId: string;
  readonly deletedAt: number | null;
}

/**
 * Control-plane persistence contract. Platform adapters provide SQL or
 * in-memory implementations. Methods do not declare a typed error channel;
 * storage failures surface as defects, mirroring the `SqlStorage` style used
 * elsewhere in the repo.
 */
export interface ControlStoreApi {
  // databases
  readonly createDatabase: (record: DatabaseRecord) => Effect.Effect<void>;
  readonly findDatabaseById: (id: string) => Effect.Effect<DatabaseRecord | undefined>;
  readonly findDatabaseByName: (name: string) => Effect.Effect<DatabaseRecord | undefined>;
  readonly listDatabases: () => Effect.Effect<readonly DatabaseRecord[]>;
  readonly deleteDatabase: (id: string) => Effect.Effect<void>;
  // collections
  readonly createCollection: (record: CollectionRecord) => Effect.Effect<void>;
  readonly findCollectionById: (id: string) => Effect.Effect<CollectionRecord | undefined>;
  readonly findCollectionByName: (
    databaseId: string,
    name: string,
  ) => Effect.Effect<CollectionRecord | undefined>;
  readonly listCollectionsByDatabase: (
    databaseId: string,
  ) => Effect.Effect<readonly CollectionRecord[]>;
  readonly updateCollectionSchema: (
    collectionId: string,
    schemaJson: SchemaObject,
    version: number,
  ) => Effect.Effect<void>;
  readonly updateCollectionMigration: (
    collectionId: string,
    schemaJson: SchemaObject,
    migrationVersion: number,
  ) => Effect.Effect<void>;
  readonly deleteCollection: (id: string) => Effect.Effect<void>;
  // schema versions
  readonly addSchemaVersion: (record: SchemaVersionRecord) => Effect.Effect<void>;
  readonly findSchemaVersion: (
    collectionId: string,
    version: number,
  ) => Effect.Effect<SchemaVersionRecord | undefined>;
  readonly listSchemaVersions: (
    collectionId: string,
  ) => Effect.Effect<readonly SchemaVersionRecord[]>;
  // users
  readonly createUser: (record: UserRecord) => Effect.Effect<void>;
  readonly findUserById: (id: string) => Effect.Effect<UserRecord | undefined>;
  readonly findUserByUsername: (username: string) => Effect.Effect<UserRecord | undefined>;
  readonly listUsers: () => Effect.Effect<readonly UserRecord[]>;
  readonly deleteUser: (id: string) => Effect.Effect<void>;
  readonly updateUserPasswordHash: (id: string, passwordHash: string) => Effect.Effect<void>;
  // grants
  readonly createGrant: (record: GrantRecord) => Effect.Effect<void>;
  readonly findGrant: (
    userId: string,
    databaseId: string,
  ) => Effect.Effect<GrantRecord | undefined>;
  readonly removeGrant: (userId: string, databaseId: string) => Effect.Effect<void>;
  readonly listGrants: () => Effect.Effect<readonly GrantRecord[]>;
  readonly listGrantsByUser: (userId: string) => Effect.Effect<readonly GrantRecord[]>;
  // document tokens
  readonly createToken: (record: TokenRecord) => Effect.Effect<void>;
  readonly findTokenByHash: (tokenHash: string) => Effect.Effect<TokenRecord | undefined>;
  readonly markTokenUsed: (id: string, usedAt: number) => Effect.Effect<void>;
  // document index
  readonly registerDocument: (documentId: string, collectionId: string) => Effect.Effect<void>;
  readonly findDocumentIndex: (
    documentId: string,
  ) => Effect.Effect<DocumentIndexRecord | undefined>;
  readonly listDocumentsByCollection: (
    collectionId: string,
  ) => Effect.Effect<readonly DocumentIndexRecord[]>;
  readonly markDocumentDeleted: (documentId: string, deletedAt: number) => Effect.Effect<void>;
}

export class ControlStore extends Context.Service<ControlStore, ControlStoreApi>()(
  "@voidhash/mimic-db/ControlStore",
) {}

// =============================================================================
// Document-plane records — owned by each document entity store.
// =============================================================================

export interface DocumentMeta {
  readonly collectionId: string;
  readonly schemaVersion: number;
  readonly migrationVersion: number | null;
  readonly currentSeq: number;
  readonly snapshotSeq: number;
  readonly deletedAt: number | null;
}

export interface SnapshotRow {
  readonly seq: number;
  readonly value: Value;
  readonly schemaVersion: number;
}

export interface CommandRow {
  readonly seq: number;
  readonly command: Command;
  readonly txId: string;
}

/**
 * Per-document persistence contract. Platform adapters provide persistent or
 * in-memory implementations without changing the document engine.
 */
export interface DocumentStoreApi {
  readonly readMeta: () => Effect.Effect<DocumentMeta | undefined>;
  readonly initialize: (
    collectionId: string,
    value: Value,
    schemaVersion: number,
    migrationVersion: number | null,
  ) => Effect.Effect<void>;
  readonly loadLatestSnapshot: () => Effect.Effect<SnapshotRow | undefined>;
  readonly listCommandsAfter: (seq: number) => Effect.Effect<readonly CommandRow[]>;
  readonly appendCommands: (
    fromSeq: number,
    commands: readonly Command[],
    txId: string,
  ) => Effect.Effect<void>;
  readonly writeSnapshot: (seq: number, value: Value, schemaVersion: number) => Effect.Effect<void>;
  readonly commitMigration: (
    seq: number,
    value: Value,
    schemaVersion: number,
    migrationVersion: number | null,
  ) => Effect.Effect<void>;
  readonly setMeta: (
    patch: Partial<
      Pick<DocumentMeta, "currentSeq" | "snapshotSeq" | "schemaVersion" | "deletedAt">
    >,
  ) => Effect.Effect<void>;
}

export class DocumentStore extends Context.Service<DocumentStore, DocumentStoreApi>()(
  "@voidhash/mimic-db/DocumentStore",
) {}
