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
});

export const CreateCollectionResponseSchema = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
});

export const UpdateCollectionSchemaResponseSchema = Schema.Struct({
  id: Schema.String,
  schemaVersion: Schema.Number,
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

export const MigrationChangeSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("create"),
    collection: Schema.String,
    schema: SchemaObjectRpcSchema,
    skipIfExists: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    type: Schema.Literal("update"),
    collection: Schema.String,
    schema: SchemaObjectRpcSchema,
    oldSchema: Schema.optional(SchemaObjectRpcSchema),
    dataMigrationSource: Schema.optional(Schema.String),
  }),
]);

export const DatabaseMigrationSchema = Schema.Struct({
  version: Schema.Number,
  name: Schema.String,
  checksum: Schema.String,
  appliedAt: Schema.optional(Schema.String),
  state: Schema.optional(Schema.Literals(["running", "succeeded", "failed", "replaced"])),
  totalDocuments: Schema.optional(Schema.Number),
  succeededDocuments: Schema.optional(Schema.Number),
  failedDocuments: Schema.optional(Schema.Number),
  changes: Schema.optional(Schema.Array(MigrationChangeSchema)),
});

export const MigrationDryRunOptionsSchema = Schema.Struct({
  limit: Schema.optional(Schema.Number),
  samplePercent: Schema.optional(Schema.Number),
});

export const DocumentRunStatusSchema = Schema.Literals(["succeeded", "failed", "skipped"]);

export const DocumentRunReportSchema = Schema.Struct({
  collectionId: Schema.String,
  documentId: Schema.String,
  status: DocumentRunStatusSchema,
  errorCode: Schema.optional(Schema.String),
  errorMessage: Schema.optional(Schema.String),
});

export const MigrationRunReportSchema = Schema.Struct({
  databaseId: Schema.String,
  version: Schema.Number,
  state: Schema.Literals(["succeeded", "failed"]),
  succeeded: Schema.Number,
  failed: Schema.Number,
  skipped: Schema.Number,
  perDocument: Schema.Array(DocumentRunReportSchema),
  dryRun: Schema.Boolean,
});

export const DocumentMigrationStateSummarySchema = Schema.Struct({
  pending: Schema.Number,
  running: Schema.Number,
  succeeded: Schema.Number,
  failed: Schema.Number,
  skipped: Schema.Number,
});

export const MigrationStatusSchema = Schema.Struct({
  databaseId: Schema.String,
  version: Schema.Number,
  state: Schema.Literals(["running", "succeeded", "failed", "replaced", "unknown"]),
  checksum: Schema.optional(Schema.String),
  summary: DocumentMigrationStateSummarySchema,
  failures: Schema.Array(
    Schema.Struct({
      documentId: Schema.String,
      collectionId: Schema.String,
      attempt: Schema.Number,
      errorCode: Schema.optional(Schema.String),
      errorMessage: Schema.optional(Schema.String),
    }),
  ),
});

export const DocumentAuthenticationSetupSchema = Schema.Struct({
  token: Schema.String,
  url: Schema.String,
});

// Type aliases for consumers — derived from the schemas so they stay in sync.

export type Database = Schema.Schema.Type<typeof DatabaseSchema>;
export type Collection = Schema.Schema.Type<typeof CollectionSchema>;
export type CreateCollectionResponse = Schema.Schema.Type<typeof CreateCollectionResponseSchema>;
export type UpdateCollectionSchemaResponse = Schema.Schema.Type<
  typeof UpdateCollectionSchemaResponseSchema
>;
export type User = Schema.Schema.Type<typeof UserSchema>;
export type CreateUserResponse = Schema.Schema.Type<typeof CreateUserResponseSchema>;
export type Grant = Schema.Schema.Type<typeof GrantSchema>;
export type DocumentSnapshotResponse = Schema.Schema.Type<typeof DocumentSnapshotResponseSchema>;
export type TransactionEnvelope = Schema.Schema.Type<typeof TransactionEnvelopeSchema>;
export type SubmitTransactionResponse = Schema.Schema.Type<typeof SubmitTransactionResponseSchema>;
export type MigrationChange = Schema.Schema.Type<typeof MigrationChangeSchema>;
export type DatabaseMigration = Schema.Schema.Type<typeof DatabaseMigrationSchema>;
export type MigrationDryRunOptions = Schema.Schema.Type<typeof MigrationDryRunOptionsSchema>;
export type DocumentRunStatus = Schema.Schema.Type<typeof DocumentRunStatusSchema>;
export type DocumentRunReport = Schema.Schema.Type<typeof DocumentRunReportSchema>;
export type MigrationRunReport = Schema.Schema.Type<typeof MigrationRunReportSchema>;
export type DocumentMigrationStateSummary = Schema.Schema.Type<
  typeof DocumentMigrationStateSummarySchema
>;
export type MigrationStatus = Schema.Schema.Type<typeof MigrationStatusSchema>;
export type DocumentAuthenticationSetup = Schema.Schema.Type<
  typeof DocumentAuthenticationSetupSchema
>;
export type DatabasePermission = Schema.Schema.Type<typeof DatabasePermissionSchema>;
export type DocumentPermission = Schema.Schema.Type<typeof DocumentPermissionSchema>;
