import type { Primitive } from "@voidhash/mimic-core";
import type { DatabasePermission, DocumentAuthenticationSetup, Grant, User } from "../rpc/index.ts";

import { CollectionHandle as EffectCollectionHandle } from "../effect/CollectionHandle.ts";
import { DatabaseHandle as EffectDatabaseHandle } from "../effect/DatabaseHandle.ts";
import { MimicSDK as EffectMimicSDK } from "../effect/MimicSDK.ts";
import { RawCollectionHandle as EffectRawCollectionHandle } from "../effect/RawCollectionHandle.ts";
import type {
  RawConnectedTransactionInput,
  RawDocumentConnectionInput,
  RawTransactionResult,
} from "../effect/RawCollectionHandle.ts";
import type { MimicClientConfig } from "../effect/RpcClient.ts";
import type {
  CollectionInfo,
  CreateUserResult,
  DatabaseInfo,
  DocumentSnapshot,
  RawDocumentSnapshot,
  SetupDocumentAuthenticationOptions,
  SnapshotFor,
} from "../effect/types.ts";

/**
 * Promise-friendly facade over the Effect SDK. Each instance owns the
 * underlying Effect SDK and runs every method through its `ManagedRuntime`
 * so all calls share the SDK's lifecycle (HttpClient, serializer, scope).
 *
 * Handles returned by this facade are wrapped to expose `Promise`-returning
 * methods rather than `Effect`-returning ones — the only behavioral change
 * is that resolved values are unwrapped immediately and rejections carry the
 * tagged errors from the `./rpc` subpath.
 */
export class MimicSDK {
  /** Underlying Effect SDK — exposed for advanced consumers. */
  readonly effect: EffectMimicSDK;

  constructor(config: MimicClientConfig) {
    this.effect = new EffectMimicSDK(config);
  }

  // ---------------------------------------------------------------------
  // Databases
  // ---------------------------------------------------------------------

  listDatabases(): Promise<readonly DatabaseInfo[]> {
    return this.effect.runtime.runPromise(this.effect.listDatabases());
  }

  createDatabase(options: {
    readonly name: string;
    readonly description?: string;
  }): Promise<DatabaseHandle> {
    return this.effect.runtime
      .runPromise(this.effect.createDatabase(options))
      .then((handle) => new DatabaseHandle(handle));
  }

  deleteDatabase(id: string): Promise<void> {
    return this.effect.runtime.runPromise(this.effect.deleteDatabase(id));
  }

  database(id: string, name = "", description = ""): DatabaseHandle {
    return new DatabaseHandle(this.effect.database(id, name, description));
  }

  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------

  listUsers(): Promise<readonly User[]> {
    return this.effect.runtime.runPromise(this.effect.listUsers());
  }

  createUser(options: {
    readonly username: string;
    readonly password: string;
  }): Promise<CreateUserResult> {
    return this.effect.runtime.runPromise(this.effect.createUser(options));
  }

  deleteUser(id: string): Promise<void> {
    return this.effect.runtime.runPromise(this.effect.deleteUser(id));
  }

  // ---------------------------------------------------------------------
  // Grants
  // ---------------------------------------------------------------------

  listGrants(userId?: string): Promise<readonly Grant[]> {
    return this.effect.runtime.runPromise(this.effect.listGrants(userId));
  }

  grantPermission(payload: {
    readonly userId: string;
    readonly databaseId: string;
    readonly permission: DatabasePermission;
  }): Promise<void> {
    return this.effect.runtime.runPromise(this.effect.grantPermission(payload));
  }

  revokePermission(payload: {
    readonly userId: string;
    readonly databaseId: string;
  }): Promise<void> {
    return this.effect.runtime.runPromise(this.effect.revokePermission(payload));
  }

  // ---------------------------------------------------------------------
  // Document auth (top-level convenience)
  // ---------------------------------------------------------------------

  setupDocumentAuthentication(options: {
    readonly collectionId: string;
    readonly documentId: string;
    readonly permission: "read" | "write";
    readonly origins: readonly string[];
    readonly expiresInSeconds?: number;
  }): Promise<DocumentAuthenticationSetup> {
    return this.effect.runtime.runPromise(this.effect.setupDocumentAuthentication(options));
  }

  /** Dispose the underlying runtime — releases any held resources. */
  dispose(): Promise<void> {
    return this.effect.dispose();
  }
}

/**
 * Promise-flavored proxy over `EffectDatabaseHandle`.
 */
export class DatabaseHandle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Underlying Effect handle. */
  readonly effect: EffectDatabaseHandle;

  constructor(effect: EffectDatabaseHandle) {
    this.effect = effect;
    this.id = effect.id;
    this.name = effect.name;
    this.description = effect.description;
  }

  createCollection<TPrimitive extends Primitive.AnyPrimitive>(
    name: string,
    primitive: TPrimitive,
  ): Promise<CollectionHandle<TPrimitive>> {
    return this.effect.sdk.runtime
      .runPromise(this.effect.createCollection(name, primitive))
      .then((handle) => new CollectionHandle(handle));
  }

  listCollections(): Promise<readonly CollectionInfo[]> {
    return this.effect.sdk.runtime.runPromise(this.effect.listCollections());
  }

  deleteCollection(collectionId: string): Promise<void> {
    return this.effect.sdk.runtime.runPromise(this.effect.deleteCollection(collectionId));
  }

  collection<TPrimitive extends Primitive.AnyPrimitive>(
    id: string,
    primitive: TPrimitive,
  ): CollectionHandle<TPrimitive> {
    return new CollectionHandle(this.effect.collection(id, primitive));
  }

  // Raw helpers — for dynamic JSON consumers.

  listCollectionsRaw(): Promise<readonly CollectionInfo[]> {
    return this.effect.sdk.runtime.runPromise(this.effect.listCollectionsRaw());
  }

  collectionRaw(collectionId: string): RawCollectionHandle {
    return new RawCollectionHandle(this.effect.collectionRaw(collectionId));
  }
}

/**
 * Promise-flavored proxy over `EffectCollectionHandle`.
 */
export class CollectionHandle<TPrimitive extends Primitive.AnyPrimitive> {
  readonly id: string;
  readonly databaseId: string;
  readonly primitive: TPrimitive;
  readonly effect: EffectCollectionHandle<TPrimitive>;

  constructor(effect: EffectCollectionHandle<TPrimitive>) {
    this.effect = effect;
    this.id = effect.id;
    this.databaseId = effect.databaseId;
    this.primitive = effect.primitive;
  }

  create(
    data: Primitive.InferInput<TPrimitive>,
    options?: { readonly id?: string },
  ): Promise<DocumentSnapshot<SnapshotFor<TPrimitive>>> {
    return this.effect.sdk.runtime.runPromise(this.effect.create(data, options));
  }

  get(documentId: string): Promise<DocumentSnapshot<SnapshotFor<TPrimitive>>> {
    return this.effect.sdk.runtime.runPromise(this.effect.get(documentId));
  }

  list(): Promise<ReadonlyArray<DocumentSnapshot<SnapshotFor<TPrimitive>>>> {
    return this.effect.sdk.runtime.runPromise(this.effect.list());
  }

  delete(documentId: string): Promise<void> {
    return this.effect.sdk.runtime.runPromise(this.effect.delete(documentId));
  }

  setupDocumentAuthentication(
    options: SetupDocumentAuthenticationOptions,
  ): Promise<DocumentAuthenticationSetup> {
    return this.effect.sdk.runtime.runPromise(this.effect.setupDocumentAuthentication(options));
  }
}

/**
 * Promise-flavored proxy over `EffectRawCollectionHandle`.
 */
export class RawCollectionHandle {
  readonly id: string;
  readonly databaseId: string;
  readonly effect: EffectRawCollectionHandle;

  constructor(effect: EffectRawCollectionHandle) {
    this.effect = effect;
    this.id = effect.id;
    this.databaseId = effect.databaseId;
  }

  createDocumentRaw(
    value: unknown,
    options?: { readonly id?: string },
  ): Promise<RawDocumentSnapshot> {
    return this.effect.sdk.runtime.runPromise(this.effect.createDocumentRaw(value, options));
  }

  getDocumentRaw(documentId: string): Promise<RawDocumentSnapshot> {
    return this.effect.sdk.runtime.runPromise(this.effect.getDocumentRaw(documentId));
  }

  listDocumentsRaw(): Promise<ReadonlyArray<RawDocumentSnapshot>> {
    return this.effect.sdk.runtime.runPromise(this.effect.listDocumentsRaw());
  }

  deleteDocument(documentId: string): Promise<void> {
    return this.effect.sdk.runtime.runPromise(this.effect.deleteDocument(documentId));
  }

  setDocumentRaw(
    documentId: string,
    value: unknown,
  ): Promise<{ readonly id: string; readonly version: number }> {
    return this.effect.sdk.runtime.runPromise(this.effect.setDocumentRaw(documentId, value));
  }

  /** Opens a leased headless participant connection to a document. */
  openDocumentConnection(
    documentId: string,
    input: RawDocumentConnectionInput,
  ): Promise<RawDocumentSnapshot> {
    return this.effect.sdk.runtime.runPromise(
      this.effect.openDocumentConnection(documentId, input),
    );
  }

  /** Reads a document through an active headless connection. */
  getConnectedDocument(
    documentId: string,
    connectionId: string,
    leaseMs?: number,
  ): Promise<RawDocumentSnapshot> {
    return this.effect.sdk.runtime.runPromise(
      this.effect.getConnectedDocument(documentId, connectionId, leaseMs),
    );
  }

  /** Renews an active headless connection lease. */
  heartbeatDocumentConnection(
    documentId: string,
    connectionId: string,
    leaseMs?: number,
  ): Promise<void> {
    return this.effect.sdk.runtime.runPromise(
      this.effect.heartbeatDocumentConnection(documentId, connectionId, leaseMs),
    );
  }

  /** Closes a headless connection and removes its presence. */
  closeDocumentConnection(documentId: string, connectionId: string): Promise<void> {
    return this.effect.sdk.runtime.runPromise(
      this.effect.closeDocumentConnection(documentId, connectionId),
    );
  }

  /** Submits a granular transaction through an active headless connection. */
  submitConnectedTransaction(
    documentId: string,
    input: RawConnectedTransactionInput,
  ): Promise<RawTransactionResult> {
    return this.effect.sdk.runtime.runPromise(
      this.effect.submitConnectedTransaction(documentId, input),
    );
  }

  setupDocumentAuthentication(
    options: SetupDocumentAuthenticationOptions,
  ): Promise<DocumentAuthenticationSetup> {
    return this.effect.sdk.runtime.runPromise(this.effect.setupDocumentAuthentication(options));
  }
}
