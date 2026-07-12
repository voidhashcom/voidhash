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
  DatabasePermissionSchema,
  DatabaseSchema,
  DocumentAuthenticationSetupSchema,
  DocumentPermissionSchema,
  DocumentSnapshotResponseSchema,
  GrantSchema,
  SchemaObjectRpcSchema,
  SubmitTransactionResponseSchema,
  TransactionEnvelopeSchema,
  UserSchema,
  ValueRpcSchema,
} from "./schemas.ts";

export type {
  Collection,
  CreateCollectionResponse,
  CreateUserResponse,
  Database,
  DatabasePermission,
  DocumentAuthenticationSetup,
  DocumentPermission,
  DocumentSnapshotResponse,
  Grant,
  SubmitTransactionResponse,
  TransactionEnvelope,
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

export { DocumentAuthRpcs, SetupDocumentAuthentication } from "./groups/document-auth.ts";

export { MimicRpcGroup } from "./group.ts";
