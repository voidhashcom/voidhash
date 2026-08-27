import { Effect, Predicate } from "effect";
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

const VALUE_KINDS: ReadonlySet<string> = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "tree",
]);

/**
 * Wire document values cross the RPC boundary as `unknown` (see
 * `ValueRpcSchema`). mimic-core `Value`s are a union discriminated by `kind`,
 * so checking the discriminant is enough to narrow an incoming payload.
 */
const isValue = (value: unknown): value is Value =>
  Predicate.hasProperty(value, "kind") &&
  Predicate.isString(value.kind) &&
  VALUE_KINDS.has(value.kind);

const toValue = (value: unknown): Value => {
  if (isValue(value)) return value;
  return Effect.runSync(Effect.die(new Error("Document value is not a mimic value")));
};

const decodeSnapshot = <TPrimitive extends Primitive.AnyPrimitive>(
  primitive: TPrimitive,
  response: RawDocumentSnapshot,
): DocumentSnapshot<SnapshotFor<TPrimitive>> => {
  const value = toValue(response.value);
  return {
    id: response.id,
    collectionId: response.collectionId,
    value,
    version: response.version,
    snapshot: primitive.decode(value),
  };
};

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
        }),
        (response) => decodeSnapshot(primitive, response),
      ),
    );
  }

  get(documentId: string) {
    const collectionId = this.id;
    const primitive = this.primitive;
    return this.sdk.runEffect((client) =>
      Effect.map(client.GetDocument({ collectionId, documentId }), (response) =>
        decodeSnapshot(primitive, response),
      ),
    );
  }

  list() {
    const collectionId = this.id;
    const primitive = this.primitive;
    return this.sdk.runEffect((client) =>
      Effect.map(client.ListDocuments({ collectionId }), (response) =>
        response.map((snapshot) => decodeSnapshot(primitive, snapshot)),
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
    return this.sdk.runEffect((client) =>
      client.SetupDocumentAuthentication({
        collectionId: this.id,
        documentId: options.documentId,
        permission: options.permission,
        origins: options.origins,
        expiresInSeconds: options.expiresInSeconds,
      }),
    );
  }
}
