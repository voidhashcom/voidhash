import * as Schema from "effect/Schema";

/**
 * Wire schema for arbitrary JSON-encoded values produced by mimic-core
 * primitives. We intentionally use `Schema.Unknown` here so that arbitrary
 * shapes (including dynamic schemas defined at runtime) can round-trip
 * across the wire without server-side decoding loss.
 */
export const ValueRpc = Schema.Unknown;
export type ValueRpc = typeof ValueRpc.Type;

/**
 * Wire schema for collection-schema JSON. Same rationale as `ValueRpcSchema` —
 * `SchemaObject` from mimic-core has dynamic shape and is normalized
 * server-side.
 */
export const SchemaObjectRpc = Schema.Unknown;
export type SchemaObjectRpc = typeof SchemaObjectRpc.Type;

export const DatabasePermissionCodec = Schema.Literals(["read", "write", "admin"]);
export type DatabasePermissionCodec = typeof DatabasePermissionCodec.Type;
export const DocumentPermissionCodec = Schema.Literals(["read", "write"]);
export type DocumentPermissionCodec = typeof DocumentPermissionCodec.Type;

export const DatabaseCodec = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
});
export type DatabaseCodec = typeof DatabaseCodec.Type;

export const CollectionCodec = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  schema: SchemaObjectRpc,
  schemaVersion: Schema.Number,
  migrationVersion: Schema.NullOr(Schema.Number),
});
export type CollectionCodec = typeof CollectionCodec.Type;

export const CreateCollectionResponseCodec = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
});
export type CreateCollectionResponseCodec = typeof CreateCollectionResponseCodec.Type;

export const UserCodec = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  isSuperuser: Schema.Boolean,
});
export type UserCodec = typeof UserCodec.Type;

export const CreateUserResponseCodec = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
});
export type CreateUserResponseCodec = typeof CreateUserResponseCodec.Type;

export const GrantCodec = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  databaseId: Schema.String,
  permission: Schema.String,
});
export type GrantCodec = typeof GrantCodec.Type;

export const DocumentSnapshotResponseCodec = Schema.Struct({
  id: Schema.String,
  collectionId: Schema.String,
  value: ValueRpc,
  version: Schema.Number,
});
export type DocumentSnapshotResponseCodec = typeof DocumentSnapshotResponseCodec.Type;

export const TransactionEnvelopeCodec = Schema.Struct({
  id: Schema.String,
  baseVersion: Schema.Number,
  commands: Schema.Array(Schema.Unknown),
  submittedAt: Schema.optional(Schema.String),
  actor: Schema.optional(
    Schema.Struct({
      userId: Schema.optional(Schema.String),
      connectionId: Schema.optional(Schema.String),
    }),
  ),
});
export type TransactionEnvelopeCodec = typeof TransactionEnvelopeCodec.Type;

export const SubmitTransactionResponseCodec = Schema.Struct({
  isAccepted: Schema.Boolean,
  version: Schema.Number,
  transactionId: Schema.String,
  reason: Schema.optional(Schema.String),
}).pipe(Schema.encodeKeys({ isAccepted: "accepted" }));
export type SubmitTransactionResponseCodec = typeof SubmitTransactionResponseCodec.Type;

export const DocumentAuthenticationSetupCodec = Schema.Struct({
  token: Schema.String,
  url: Schema.String,
});
export type DocumentAuthenticationSetupCodec = typeof DocumentAuthenticationSetupCodec.Type;

// Type aliases for consumers — derived from the schemas so they stay in sync.

export type Database = Schema.Schema.Type<typeof DatabaseCodec>;
export type Collection = Schema.Schema.Type<typeof CollectionCodec>;
export type CreateCollectionResponse = Schema.Schema.Type<typeof CreateCollectionResponseCodec>;
export type User = Schema.Schema.Type<typeof UserCodec>;
export type CreateUserResponse = Schema.Schema.Type<typeof CreateUserResponseCodec>;
export type Grant = Schema.Schema.Type<typeof GrantCodec>;
export type DocumentSnapshotResponse = Schema.Schema.Type<typeof DocumentSnapshotResponseCodec>;
export type TransactionEnvelope = Schema.Schema.Type<typeof TransactionEnvelopeCodec>;
export type SubmitTransactionResponse = Schema.Schema.Type<typeof SubmitTransactionResponseCodec>;
export type DocumentAuthenticationSetup = Schema.Schema.Type<
  typeof DocumentAuthenticationSetupCodec
>;
export type DatabasePermission = Schema.Schema.Type<typeof DatabasePermissionCodec>;
export type DocumentPermission = Schema.Schema.Type<typeof DocumentPermissionCodec>;

export { ValueRpc as ValueRpcSchema };
export { SchemaObjectRpc as SchemaObjectRpcSchema };
export { DatabasePermissionCodec as DatabasePermissionSchema };
export { DocumentPermissionCodec as DocumentPermissionSchema };
export { DatabaseCodec as DatabaseSchema };
export { CollectionCodec as CollectionSchema };
export { CreateCollectionResponseCodec as CreateCollectionResponseSchema };
export { UserCodec as UserSchema };
export { CreateUserResponseCodec as CreateUserResponseSchema };
export { GrantCodec as GrantSchema };
export { DocumentSnapshotResponseCodec as DocumentSnapshotResponseSchema };
export { TransactionEnvelopeCodec as TransactionEnvelopeSchema };
export { SubmitTransactionResponseCodec as SubmitTransactionResponseSchema };
export { DocumentAuthenticationSetupCodec as DocumentAuthenticationSetupSchema };
