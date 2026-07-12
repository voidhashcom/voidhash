import { Schema } from "effect";

/**
 * Wire schema for arbitrary JSON-encoded values produced by mimic-core
 * primitives. We intentionally use `Schema.Unknown` here so that arbitrary
 * shapes (including dynamic schemas defined at runtime) can round-trip
 * across the wire without server-side decoding loss.
 */
export const ValueRpcSchema = Schema.Unknown;

/**
 * Wire schema for collection-schema JSON. Same rationale as `ValueRpcSchema` —
 * `SchemaObject` from mimic-core has dynamic shape and is normalized
 * server-side.
 */
export const SchemaObjectRpcSchema = Schema.Unknown;

export const DatabasePermissionSchema = Schema.Literals(["read", "write", "admin"]);
export const DocumentPermissionSchema = Schema.Literals(["read", "write"]);

export const DatabaseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
});

export const CollectionSchema = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  schema: SchemaObjectRpcSchema,
  schemaVersion: Schema.Number,
  migrationVersion: Schema.NullOr(Schema.Number),
});

export const CreateCollectionResponseSchema = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
});

export const UserSchema = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  isSuperuser: Schema.Boolean,
});

export const CreateUserResponseSchema = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
});

export const GrantSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  databaseId: Schema.String,
  permission: Schema.String,
});

export const DocumentSnapshotResponseSchema = Schema.Struct({
  id: Schema.String,
  collectionId: Schema.String,
  value: ValueRpcSchema,
  version: Schema.Number,
});

export const TransactionEnvelopeSchema = Schema.Struct({
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

export const SubmitTransactionResponseSchema = Schema.Struct({
  accepted: Schema.Boolean,
  version: Schema.Number,
  transactionId: Schema.String,
  reason: Schema.optional(Schema.String),
});

export const DocumentAuthenticationSetupSchema = Schema.Struct({
  token: Schema.String,
  url: Schema.String,
});

// Type aliases for consumers — derived from the schemas so they stay in sync.

export type Database = Schema.Schema.Type<typeof DatabaseSchema>;
export type Collection = Schema.Schema.Type<typeof CollectionSchema>;
export type CreateCollectionResponse = Schema.Schema.Type<typeof CreateCollectionResponseSchema>;
export type User = Schema.Schema.Type<typeof UserSchema>;
export type CreateUserResponse = Schema.Schema.Type<typeof CreateUserResponseSchema>;
export type Grant = Schema.Schema.Type<typeof GrantSchema>;
export type DocumentSnapshotResponse = Schema.Schema.Type<typeof DocumentSnapshotResponseSchema>;
export type TransactionEnvelope = Schema.Schema.Type<typeof TransactionEnvelopeSchema>;
export type SubmitTransactionResponse = Schema.Schema.Type<typeof SubmitTransactionResponseSchema>;
export type DocumentAuthenticationSetup = Schema.Schema.Type<
  typeof DocumentAuthenticationSetupSchema
>;
export type DatabasePermission = Schema.Schema.Type<typeof DatabasePermissionSchema>;
export type DocumentPermission = Schema.Schema.Type<typeof DocumentPermissionSchema>;
