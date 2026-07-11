import { queryOptions } from "@tanstack/react-query";
import type { MimicSDK, RawDocumentSnapshot } from "@voidhash/mimic-server";

interface UiDocumentSnapshot {
  readonly id: string;
  readonly collectionId: string;
  readonly version: number;
  readonly flat: unknown;
}

const mapDocumentSnapshot = (snapshot: RawDocumentSnapshot): UiDocumentSnapshot => ({
  id: snapshot.id,
  collectionId: snapshot.collectionId,
  version: snapshot.version,
  // Admin UI stores values under `flat` in its component code — keep
  // the shape stable here to minimize the route diff.
  flat: snapshot.value,
});

interface UiCollectionInfo {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schemaJson: unknown;
  readonly schemaVersion: number;
}

const mapCollection = (collection: {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schema: unknown;
  readonly schemaVersion: number;
}): UiCollectionInfo => ({
  id: collection.id,
  databaseId: collection.databaseId,
  name: collection.name,
  schemaJson: collection.schema,
  schemaVersion: collection.schemaVersion,
});

export interface UiMigrationChange {
  readonly type: "create" | "update";
  readonly collection: string;
  readonly schemaJson: unknown;
  readonly oldSchemaJson?: unknown;
  readonly skipIfExists?: boolean;
  readonly dataMigrationSource?: string;
}

const mapMigrationChange = (change: {
  readonly type: "create" | "update";
  readonly collection: string;
  readonly schema: unknown;
  readonly oldSchema?: unknown;
  readonly skipIfExists?: boolean;
  readonly dataMigrationSource?: string;
}): UiMigrationChange =>
  change.type === "create"
    ? {
        type: "create",
        collection: change.collection,
        schemaJson: change.schema,
        skipIfExists: change.skipIfExists,
      }
    : {
        type: "update",
        collection: change.collection,
        schemaJson: change.schema,
        oldSchemaJson: change.oldSchema,
        dataMigrationSource: change.dataMigrationSource,
      };

export type MigrationRunState = "running" | "succeeded" | "failed" | "replaced" | "unknown";

export interface UiDatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt?: string;
  readonly state: MigrationRunState;
  readonly totalDocuments: number;
  readonly succeededDocuments: number;
  readonly failedDocuments: number;
  readonly changes?: ReadonlyArray<UiMigrationChange>;
}

export interface UiMigrationStatus {
  readonly databaseId: string;
  readonly version: number;
  readonly state: MigrationRunState;
  readonly checksum?: string;
  readonly summary: {
    readonly pending: number;
    readonly running: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly skipped: number;
  };
  readonly failures: ReadonlyArray<{
    readonly documentId: string;
    readonly collectionId: string;
    readonly attempt: number;
    readonly errorCode?: string;
    readonly errorMessage?: string;
  }>;
}

export interface UiMigrationRunReport {
  readonly databaseId: string;
  readonly version: number;
  readonly state: "succeeded" | "failed";
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
  readonly perDocument: ReadonlyArray<{
    readonly collectionId: string;
    readonly documentId: string;
    readonly status: "succeeded" | "failed" | "skipped";
    readonly errorCode?: string;
    readonly errorMessage?: string;
  }>;
  readonly dryRun: boolean;
}

export const databasesQuery = (sdk: MimicSDK) =>
  queryOptions({
    queryKey: ["databases"],
    queryFn: () => sdk.listDatabases(),
  });

export const collectionsQuery = (sdk: MimicSDK, databaseId: string) =>
  queryOptions({
    queryKey: ["collections", databaseId],
    queryFn: () =>
      sdk
        .database(databaseId)
        .listCollectionsRaw()
        .then((collections) => collections.map(mapCollection)),
    enabled: !!databaseId,
  });

export const databaseMigrationsQuery = (sdk: MimicSDK, databaseId: string) =>
  queryOptions({
    queryKey: ["database-migrations", databaseId],
    queryFn: () =>
      sdk
        .database(databaseId)
        .listMigrations()
        .then((migrations) =>
          migrations.map(
            (migration): UiDatabaseMigration => ({
              version: migration.version,
              name: migration.name,
              checksum: migration.checksum,
              appliedAt: migration.appliedAt,
              // Older server versions may not return state/counts; fall
              // back to "succeeded" / 0 so the UI stays well-typed.
              state: (migration.state ?? "succeeded") as MigrationRunState,
              totalDocuments: migration.totalDocuments ?? 0,
              succeededDocuments: migration.succeededDocuments ?? 0,
              failedDocuments: migration.failedDocuments ?? 0,
              changes: migration.changes?.map(mapMigrationChange),
            }),
          ),
        ),
    enabled: !!databaseId,
  });

export const migrationStatusQuery = (sdk: MimicSDK, databaseId: string, version: number | null) =>
  queryOptions({
    queryKey: ["migration-status", databaseId, version],
    queryFn: () =>
      sdk
        .database(databaseId)
        .getMigrationStatus(version!)
        .then(
          (status): UiMigrationStatus => ({
            databaseId: status.databaseId,
            version: status.version,
            state: status.state as MigrationRunState,
            checksum: status.checksum,
            summary: {
              pending: status.summary.pending,
              running: status.summary.running,
              succeeded: status.summary.succeeded,
              failed: status.summary.failed,
              skipped: status.summary.skipped,
            },
            failures: status.failures.map((failure) => ({
              documentId: failure.documentId,
              collectionId: failure.collectionId,
              attempt: failure.attempt,
              errorCode: failure.errorCode,
              errorMessage: failure.errorMessage,
            })),
          }),
        ),
    enabled: !!databaseId && version !== null,
  });

export const documentsQuery = (sdk: MimicSDK, collectionId: string) =>
  queryOptions({
    queryKey: ["documents", collectionId],
    queryFn: () =>
      sdk
        // `databaseId` isn't needed for raw collection RPCs (the server
        // resolves it from `collectionId`); pass empty string so the
        // handle constructor stays well-typed.
        .database("")
        .collectionRaw(collectionId)
        .listDocumentsRaw()
        .then((documents) => documents.map(mapDocumentSnapshot)),
    enabled: !!collectionId,
  });

export const documentQuery = (sdk: MimicSDK, collectionId: string, documentId: string) =>
  queryOptions({
    queryKey: ["document", collectionId, documentId],
    queryFn: () =>
      sdk
        .database("")
        .collectionRaw(collectionId)
        .getDocumentRaw(documentId)
        .then(mapDocumentSnapshot),
    enabled: !!collectionId && !!documentId,
  });

export const usersQuery = (sdk: MimicSDK) =>
  queryOptions({
    queryKey: ["users"],
    queryFn: () => sdk.listUsers(),
  });

export const grantsQuery = (sdk: MimicSDK, userId?: string) =>
  queryOptions({
    queryKey: ["grants", userId],
    queryFn: () => sdk.listGrants(userId),
  });
