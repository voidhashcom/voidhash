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
  readonly migrationVersion: number | null;
}

const mapCollection = (collection: {
  readonly id: string;
  readonly databaseId: string;
  readonly name: string;
  readonly schema: unknown;
  readonly schemaVersion: number;
  readonly migrationVersion: number | null;
}): UiCollectionInfo => ({
  id: collection.id,
  databaseId: collection.databaseId,
  name: collection.name,
  schemaJson: collection.schema,
  schemaVersion: collection.schemaVersion,
  migrationVersion: collection.migrationVersion,
});

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
