import { Effect } from "effect";
import { Primitive, serializeSchema } from "@voidhash/mimic-core";

import { CollectionHandle } from "./CollectionHandle.ts";
import { RawCollectionHandle } from "./RawCollectionHandle.ts";
import type { MimicSDK } from "./MimicSDK.ts";
import type { CollectionInfo } from "./types.ts";

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
  listCollections(): Effect.Effect<readonly CollectionInfo[], unknown> {
    return this.sdk.runEffect((client) => client.ListCollections({ databaseId: this.id }));
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
}
