import { Effect } from "effect";
import { Primitive, serializeSchema } from "@voidhash/mimic-core";

import { CollectionHandle } from "./CollectionHandle.ts";
import { RawCollectionHandle } from "./RawCollectionHandle.ts";
import type { MimicSDK } from "./MimicSDK.ts";
import type { CollectionInfo, DatabaseMigrationChange, DatabaseMigrationInfo } from "./types.ts";

/**
 * Typed handle for a database. Methods that depend on a known schema use
 * the `Primitive` taken in by `collection`/`createCollection`. For admin-
 * style flows where the schema is dynamic JSON, see `collectionRaw` and
 * `listCollectionsRaw`.
 */
export class DatabaseHandle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Internal: back-reference to the SDK for transport. */
  readonly sdk: MimicSDK;

  constructor(id: string, name: string, description: string, sdk: MimicSDK) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.sdk = sdk;
  }

  // ---------------------------------------------------------------------
  // Typed collection operations — require a `Primitive` schema for safe
  // encode/decode.
  // ---------------------------------------------------------------------

  createCollection<TPrimitive extends Primitive.AnyPrimitive>(name: string, primitive: TPrimitive) {
    const databaseId = this.id;
    const sdk = this.sdk;
    return sdk.runEffect((client) =>
      Effect.map(
        client.CreateCollection({
          databaseId,
          name,
          schema: serializeSchema(primitive.schema),
        }),
        (response) => new CollectionHandle(response.id, response.databaseId, primitive, sdk),
      ),
    );
  }

  /**
   * Lists collections with their stored schema JSON. Same response as
   * `listCollectionsRaw`, included on the typed handle for convenience.
   */
  listCollections() {
    return this.sdk.runEffect(
      (client) =>
        client.ListCollections({ databaseId: this.id }) as Effect.Effect<
          readonly CollectionInfo[],
          unknown
        >,
    );
  }

  deleteCollection(collectionId: string) {
    return this.sdk.runEffect((client) => client.DeleteCollection({ collectionId }));
  }

  collection<TPrimitive extends Primitive.AnyPrimitive>(
    id: string,
    primitive: TPrimitive,
  ): CollectionHandle<TPrimitive> {
    return new CollectionHandle(id, this.id, primitive, this.sdk);
  }

  /**
   * Update a collection's schema by passing in a typed `Primitive`. Note:
   * the `dataMigrationSource` parameter is preserved on the wire but the
   * server's ad-hoc `updateCollectionSchema` path doesn't apply bundled
   * data migrations — `applyMigration` is the only path that does. This
   * mirrors the previous SDK behavior.
   */
  updateCollectionSchema<TPrimitive extends Primitive.AnyPrimitive>(
    collectionId: string,
    primitive: TPrimitive,
    dataMigrationSource?: string,
  ) {
    return this.sdk.runEffect((client) =>
      client.UpdateCollectionSchema({
        collectionId,
        schema: serializeSchema(primitive.schema),
        dataMigrationSource,
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Raw helpers — for consumers that work with dynamic JSON values
  // (admin app, tooling). These bypass `Primitive` encode/decode.
  // ---------------------------------------------------------------------

  /** Same as `listCollections` — kept under the explicit `Raw` name for clarity. */
  listCollectionsRaw() {
    return this.listCollections();
  }

  /**
   * Returns a `RawCollectionHandle` that exposes value-based document CRUD
   * without requiring a typed `Primitive`. Use in dynamic-schema scenarios
   * (admin UI, generic tooling).
   */
  collectionRaw(collectionId: string): RawCollectionHandle {
    return new RawCollectionHandle(collectionId, this.id, this.sdk);
  }

  /**
   * Update a collection's schema using raw schema JSON. Identical wire shape
   * as `updateCollectionSchema` but skips `Primitive`-based serialization.
   */
  updateCollectionSchemaRaw(collectionId: string, schema: unknown, dataMigrationSource?: string) {
    return this.sdk.runEffect((client) =>
      client.UpdateCollectionSchema({
        collectionId,
        schema,
        dataMigrationSource,
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Migrations
  // ---------------------------------------------------------------------

  listMigrations() {
    return this.sdk.runEffect(
      (client) =>
        client.ListDatabaseMigrations({ databaseId: this.id }) as Effect.Effect<
          readonly DatabaseMigrationInfo[],
          unknown
        >,
    );
  }

  applyMigration(options: {
    readonly version: number;
    readonly name: string;
    readonly checksum: string;
    readonly changes: readonly DatabaseMigrationChange[];
    readonly mode?: "apply" | "rerun" | "replace";
    readonly dryRun?: { readonly limit?: number; readonly samplePercent?: number };
    readonly batchSize?: number;
    readonly redoSucceededOnReplace?: boolean;
  }) {
    return this.sdk.runEffect((client) =>
      client.ApplyDatabaseMigration({
        databaseId: this.id,
        version: options.version,
        name: options.name,
        checksum: options.checksum,
        changes: options.changes,
        mode: options.mode,
        dryRun: options.dryRun,
        batchSize: options.batchSize,
        redoSucceededOnReplace: options.redoSucceededOnReplace,
      }),
    );
  }

  getMigrationStatus(version: number) {
    return this.sdk.runEffect((client) =>
      client.GetMigrationStatus({
        databaseId: this.id,
        version,
      }),
    );
  }
}
