import type { Primitive, SchemaObject, Value } from "@voidhash/mimic-core";
import type {
  Collection,
  CreateUserResponse,
  Database,
  DatabaseMigration,
  DocumentAuthenticationSetup as RpcDocumentAuthenticationSetup,
  DocumentSnapshotResponse,
  MigrationChange,
  MigrationDryRunOptions,
  MigrationRunReport,
  MigrationStatus,
} from "../rpc/index.ts";

// Re-export wire types under the legacy SDK names so consumers don't have
// to update their imports.
export type DatabaseInfo = Database;
export type CollectionInfo = Collection;
export type CreateUserResult = CreateUserResponse;
export type DatabaseMigrationChange = MigrationChange;
export type DatabaseMigrationInfo = DatabaseMigration;
export type DocumentAuthenticationSetup = RpcDocumentAuthenticationSetup;
export type RawDocumentSnapshot = DocumentSnapshotResponse;
export type DatabaseMigrationRunReport = MigrationRunReport;
export type DatabaseMigrationStatus = MigrationStatus;
export type DatabaseMigrationDryRunOptions = MigrationDryRunOptions;

export interface DocumentSnapshot<TSnapshot = unknown> {
  readonly id: string;
  readonly collectionId: string;
  readonly value: Value;
  readonly version: number;
  readonly snapshot: TSnapshot;
}

export interface SetupDocumentAuthenticationOptions {
  readonly documentId: string;
  readonly permission: "read" | "write";
  readonly origins: readonly string[];
  readonly expiresInSeconds?: number;
}

export type SnapshotFor<TPrimitive extends Primitive.AnyPrimitive> =
  Primitive.InferSnapshot<TPrimitive>;

// Re-export for downstream consumers that build SchemaObject values
// (e.g. mimic-cli, mimic-example-server). The type comes from mimic-core.
export type { SchemaObject };
