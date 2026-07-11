export {
  ApiErrorSchemas,
  ConflictError,
  ForbiddenError,
  InternalError,
  InvalidSchemaError,
  InvalidValueError,
  MigrationFailedError,
  NotFoundError,
  toUnknownError,
  UnauthorizedError,
  ValidationError,
  VersionConflictError,
} from "./errors.ts";

export {
  CollectionSchema,
  CreateCollectionResponseSchema,
  CreateUserResponseSchema,
  DatabaseMigrationSchema,
  DatabasePermissionSchema,
  DatabaseSchema,
  DocumentAuthenticationSetupSchema,
  DocumentMigrationStateSummarySchema,
  DocumentPermissionSchema,
  DocumentRunReportSchema,
  DocumentRunStatusSchema,
  DocumentSnapshotResponseSchema,
  GrantSchema,
  MigrationChangeSchema,
  MigrationDryRunOptionsSchema,
  MigrationRunReportSchema,
  MigrationStatusSchema,
  SchemaObjectRpcSchema,
  SubmitTransactionResponseSchema,
  TransactionEnvelopeSchema,
  UpdateCollectionSchemaResponseSchema,
  UserSchema,
  ValueRpcSchema,
} from "./schemas.ts";

export type {
  Collection,
  CreateCollectionResponse,
  CreateUserResponse,
  Database,
  DatabaseMigration,
  DatabasePermission,
  DocumentAuthenticationSetup,
  DocumentMigrationStateSummary,
  DocumentPermission,
  DocumentRunReport,
  DocumentRunStatus,
  DocumentSnapshotResponse,
  Grant,
  MigrationChange,
  MigrationDryRunOptions,
  MigrationRunReport,
  MigrationStatus,
  SubmitTransactionResponse,
  TransactionEnvelope,
  UpdateCollectionSchemaResponse,
  User,
} from "./schemas.ts";

export { AuthMiddleware, CurrentUser, type CurrentUserShape } from "./middleware.ts";

export {
  CreateDatabase,
  DatabasesRpcs,
  DeleteDatabase,
  ListDatabases,
} from "./groups/databases.ts";

export {
  CollectionsRpcs,
  CreateCollection,
  DeleteCollection,
  ListCollections,
  UpdateCollectionSchema,
} from "./groups/collections.ts";

export {
  CreateDocument,
  DeleteDocument,
  DocumentsRpcs,
  GetDocument,
  ListDocuments,
  SubmitTransaction,
} from "./groups/documents.ts";

export { CreateUser, DeleteUser, ListUsers, UsersRpcs } from "./groups/users.ts";

export { GrantPermission, GrantsRpcs, ListGrants, RevokePermission } from "./groups/grants.ts";

export {
  ApplyDatabaseMigration,
  GetMigrationStatus,
  ListDatabaseMigrations,
  MigrationsRpcs,
} from "./groups/migrations.ts";

export { DocumentAuthRpcs, SetupDocumentAuthentication } from "./groups/document-auth.ts";

export { MimicRpcGroup } from "./group.ts";
