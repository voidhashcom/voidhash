import { type SchemaObject, type Value } from "@voidhash/mimic-core";
import type {
  MigrationDryRunOptions,
  MigrationRunReport,
  MigrationStatus,
} from "@voidhash/mimic-server/rpc";
import { Context, type Effect, Schema } from "effect";

import type { DocumentSnapshotResponse } from "../document/snapshot.ts";
import type { SubmitTransactionResponse, TransactionEnvelope } from "../document/transaction.ts";

export type DatabasePermission = "read" | "write" | "admin";
export type DocumentPermission = "read" | "write";

export interface MigrationChangeCreate {
  readonly type: "create";
  readonly collection: string;
  readonly schema: SchemaObject;
  readonly skipIfExists?: boolean;
}

export interface MigrationChangeUpdate {
  readonly type: "update";
  readonly collection: string;
  readonly schema: SchemaObject;
  readonly oldSchema?: SchemaObject;
  readonly dataMigrationSource?: string;
}

export type MigrationChange = MigrationChangeCreate | MigrationChangeUpdate;

export interface ApplyMigrationOptions {
  readonly batchSize?: number;
  readonly dryRun?: false | MigrationDryRunOptions;
}

export interface PresenceEntry {
  readonly data: Value;
  readonly userId?: string;
}

export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly isSuperuser: boolean;
}

/**
 * The public façade consumed by the RPC handlers, the Basic-auth middleware,
 * and the WebSocket connection handler. Platform entry points provide either
 * the local `DurableEntityHost` composition or a cloud adapter over the same
 * control and document engines.
 */
export interface HostService {
  readonly authenticateBasic: (
    username: string,
    password: string,
  ) => Effect.Effect<AuthenticatedUser, any>;
  readonly authenticateDocumentToken: (
    token: string,
    collectionId: string,
    documentId: string,
    origin: string | null,
  ) => Effect.Effect<
    { readonly tokenId: string; readonly permission: DocumentPermission },
    any
  >;
  readonly createDatabase: (
    name: string,
    description: string,
  ) => Effect.Effect<
    { readonly id: string; readonly name: string; readonly description: string },
    any
  >;
  readonly listDatabases: () => Effect.Effect<
    readonly { readonly id: string; readonly name: string; readonly description: string }[],
    any
  >;
  readonly deleteDatabase: (databaseId: string) => Effect.Effect<void, any>;
  readonly createCollection: (
    databaseId: string,
    name: string,
    schemaInput: unknown,
  ) => Effect.Effect<
    {
      readonly id: string;
      readonly databaseId: string;
      readonly name: string;
      readonly schema: SchemaObject;
      readonly schemaVersion: number;
    },
    any
  >;
  readonly listCollections: (databaseId: string) => Effect.Effect<
    readonly {
      readonly id: string;
      readonly databaseId: string;
      readonly name: string;
      readonly schema: SchemaObject;
      readonly schemaVersion: number;
    }[],
    any
  >;
  readonly updateCollectionSchema: (
    collectionId: string,
    schemaInput: unknown,
    dataMigrationSource?: string,
  ) => Effect.Effect<
    {
      readonly id: string;
      readonly databaseId: string;
      readonly name: string;
      readonly schema: SchemaObject;
      readonly schemaVersion: number;
    },
    any
  >;
  readonly deleteCollection: (collectionId: string) => Effect.Effect<void, any>;
  readonly listMigrations: (databaseId: string) => Effect.Effect<
    readonly {
      readonly databaseId: string;
      readonly version: number;
      readonly name: string;
      readonly checksum: string;
      readonly appliedAt: string;
      readonly state: "running" | "succeeded" | "failed" | "replaced";
      readonly totalDocuments: number;
      readonly succeededDocuments: number;
      readonly failedDocuments: number;
      readonly changes?: readonly MigrationChange[];
    }[],
    any
  >;
  readonly applyMigration: (
    databaseId: string,
    version: number,
    name: string,
    checksum: string,
    changes: readonly MigrationChange[],
    options?: ApplyMigrationOptions,
  ) => Effect.Effect<MigrationRunReport, any>;
  readonly rerunMigration: (
    databaseId: string,
    version: number,
    name: string,
    checksum: string,
    changes: readonly MigrationChange[],
    options?: ApplyMigrationOptions,
  ) => Effect.Effect<MigrationRunReport, any>;
  readonly replaceMigration: (
    databaseId: string,
    version: number,
    name: string,
    checksum: string,
    changes: readonly MigrationChange[],
    options?: ApplyMigrationOptions & { readonly redoSucceeded?: boolean },
  ) => Effect.Effect<MigrationRunReport, any>;
  readonly getMigrationStatus: (
    databaseId: string,
    version: number,
  ) => Effect.Effect<MigrationStatus, any>;
  readonly createUser: (
    username: string,
    password: string,
  ) => Effect.Effect<
    { readonly id: string; readonly username: string; readonly isSuperuser: boolean },
    any
  >;
  readonly listUsers: () => Effect.Effect<
    readonly { readonly id: string; readonly username: string; readonly isSuperuser: boolean }[],
    any
  >;
  readonly deleteUser: (userId: string) => Effect.Effect<void, any>;
  readonly grantPermission: (
    userId: string,
    databaseId: string,
    permission: DatabasePermission,
  ) => Effect.Effect<void, any>;
  readonly revokePermission: (userId: string, databaseId: string) => Effect.Effect<void, any>;
  readonly listGrants: (userId?: string) => Effect.Effect<
    readonly {
      readonly id: string;
      readonly userId: string;
      readonly databaseId: string;
      readonly permission: DatabasePermission;
    }[],
    any
  >;
  readonly createDocumentAuthToken: (
    collectionId: string,
    documentId: string,
    permission: DocumentPermission,
    origins: readonly string[],
    expiresInSeconds?: number,
  ) => Effect.Effect<{ readonly token: string }, any>;
  readonly createDocument: (
    collectionId: string,
    id: string | undefined,
    value: unknown,
  ) => Effect.Effect<DocumentSnapshotResponse, any>;
  readonly getDocument: (
    collectionId: string,
    documentId: string,
  ) => Effect.Effect<DocumentSnapshotResponse, any>;
  readonly listDocuments: (
    collectionId: string,
  ) => Effect.Effect<readonly DocumentSnapshotResponse[], any>;
  readonly deleteDocument: (
    collectionId: string,
    documentId: string,
  ) => Effect.Effect<void, any>;
  readonly submitTransaction: (
    collectionId: string,
    documentId: string,
    transaction: TransactionEnvelope,
  ) => Effect.Effect<SubmitTransactionResponse, any>;
  readonly attachConnection: (
    collectionId: string,
    documentId: string,
    connectionId: string,
    permission: DocumentPermission,
    userId?: string,
  ) => Effect.Effect<
    {
      readonly value: Value;
      readonly version: number;
      readonly presences: Record<string, PresenceEntry>;
    },
    any
  >;
  readonly heartbeatConnection: (
    collectionId: string,
    documentId: string,
    connectionId: string,
  ) => Effect.Effect<void, any>;
  readonly detachConnection: (
    collectionId: string,
    documentId: string,
    connectionId: string,
  ) => Effect.Effect<void, any>;
  readonly getPresenceSnapshot: (
    collectionId: string,
    documentId: string,
  ) => Effect.Effect<{ readonly presences: Record<string, PresenceEntry> }, any>;
  readonly setPresence: (
    collectionId: string,
    documentId: string,
    connectionId: string,
    entry: PresenceEntry,
  ) => Effect.Effect<void, any>;
  readonly removePresence: (
    collectionId: string,
    documentId: string,
    connectionId: string,
  ) => Effect.Effect<void, any>;
  readonly ensureDatabasePermission: (
    userId: string,
    isSuperuser: boolean,
    databaseId: string,
    required: DatabasePermission,
  ) => Effect.Effect<void, any>;
  readonly databaseIdForCollection: (collectionId: string) => Effect.Effect<string, any>;
}

export class HostServiceTag extends Context.Service<HostServiceTag, HostService>()(
  "@voidhash/mimic-db/HostService",
) {}

export const DatabasePermissionSchema = Schema.Union([
  Schema.Literal("read"),
  Schema.Literal("write"),
  Schema.Literal("admin"),
]);

export const DocumentPermissionSchema = Schema.Union([
  Schema.Literal("read"),
  Schema.Literal("write"),
]);
