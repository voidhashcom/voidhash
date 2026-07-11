import { Effect } from "effect";
import type { Value } from "@voidhash/mimic-core";
import { Primitive } from "@voidhash/mimic-core";

import type { MimicSDK } from "./MimicSDK.ts";
import type {
  DocumentAuthenticationSetup,
  DocumentSnapshot,
  RawDocumentSnapshot,
  SetupDocumentAuthenticationOptions,
  SnapshotFor,
} from "./types.ts";

const decodeSnapshot = <TPrimitive extends Primitive.AnyPrimitive>(
  primitive: TPrimitive,
  response: RawDocumentSnapshot,
): DocumentSnapshot<SnapshotFor<TPrimitive>> => ({
  id: response.id,
  collectionId: response.collectionId,
  value: response.value as Value,
  version: response.version,
  snapshot: primitive.decode(response.value as Value) as SnapshotFor<TPrimitive>,
});

/**
 * Typed handle for a collection. Generic in `TPrimitive` so encode/decode
 * round-trips through the user's mimic-core schema.
 */
export class CollectionHandle<TPrimitive extends Primitive.AnyPrimitive> {
  readonly id: string;
  readonly databaseId: string;
  readonly primitive: TPrimitive;
  readonly sdk: MimicSDK;

  constructor(id: string, databaseId: string, primitive: TPrimitive, sdk: MimicSDK) {
    this.id = id;
    this.databaseId = databaseId;
    this.primitive = primitive;
    this.sdk = sdk;
  }

  create(data: Primitive.InferInput<TPrimitive>, options?: { readonly id?: string }) {
    const collectionId = this.id;
    const primitive = this.primitive;
    return this.sdk.runEffect((client) =>
      Effect.map(
        client.CreateDocument({
          collectionId,
          id: options?.id,
          value: primitive.encode(data),
        }) as Effect.Effect<RawDocumentSnapshot, unknown>,
        (response) => decodeSnapshot(primitive, response),
      ),
    );
  }

  get(documentId: string) {
    const collectionId = this.id;
    const primitive = this.primitive;
    return this.sdk.runEffect((client) =>
      Effect.map(
        client.GetDocument({ collectionId, documentId }) as Effect.Effect<
          RawDocumentSnapshot,
          unknown
        >,
        (response) => decodeSnapshot(primitive, response),
      ),
    );
  }

  list() {
    const collectionId = this.id;
    const primitive = this.primitive;
    return this.sdk.runEffect((client) =>
      Effect.map(
        client.ListDocuments({ collectionId }) as Effect.Effect<
          ReadonlyArray<RawDocumentSnapshot>,
          unknown
        >,
        (response) => response.map((snapshot) => decodeSnapshot(primitive, snapshot)),
      ),
    );
  }

  delete(documentId: string) {
    return this.sdk.runEffect((client) =>
      client.DeleteDocument({ collectionId: this.id, documentId }),
    );
  }

  setupDocumentAuthentication(
    options: SetupDocumentAuthenticationOptions,
  ): Effect.Effect<DocumentAuthenticationSetup, unknown> {
    return this.sdk.runEffect(
      (client) =>
        client.SetupDocumentAuthentication({
          collectionId: this.id,
          documentId: options.documentId,
          permission: options.permission,
          origins: options.origins,
          expiresInSeconds: options.expiresInSeconds,
        }) as Effect.Effect<DocumentAuthenticationSetup, unknown>,
    );
  }
}
