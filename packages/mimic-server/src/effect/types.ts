import type { Primitive, SchemaObject, Value } from "@voidhash/mimic-core";
import type {
  Collection,
  CreateUserResponse,
  Database,
  DocumentAuthenticationSetup as RpcDocumentAuthenticationSetup,
  DocumentSnapshotResponse,
} from "../rpc/index.ts";

// Re-export wire types under the legacy SDK names so consumers don't have
// to update their imports.
export type DatabaseInfo = Database;
export type CollectionInfo = Collection;
export type CreateUserResult = CreateUserResponse;
export type DocumentAuthenticationSetup = RpcDocumentAuthenticationSetup;
export type RawDocumentSnapshot = DocumentSnapshotResponse;

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
// dynamic schema consumers. The type comes from mimic-core.
export type { SchemaObject };
