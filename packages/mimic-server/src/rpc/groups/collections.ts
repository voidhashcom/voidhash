import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ConflictError, ForbiddenError, InvalidSchemaError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import {
  CollectionSchema,
  CreateCollectionResponseSchema,
  SchemaObjectRpcSchema,
  UpdateCollectionSchemaResponseSchema,
} from "../schemas.ts";

export const CreateCollection = Rpc.make("CreateCollection", {
  payload: Schema.Struct({
    databaseId: Schema.String,
    name: Schema.String,
    schema: SchemaObjectRpcSchema,
  }),
  success: CreateCollectionResponseSchema,
  error: Schema.Union([NotFoundError, ConflictError, InvalidSchemaError, ForbiddenError]),
});

export const ListCollections = Rpc.make("ListCollections", {
  payload: Schema.Struct({
    databaseId: Schema.String,
  }),
  success: Schema.Array(CollectionSchema),
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const UpdateCollectionSchema = Rpc.make("UpdateCollectionSchema", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    schema: SchemaObjectRpcSchema,
    dataMigrationSource: Schema.optional(Schema.String),
  }),
  success: UpdateCollectionSchemaResponseSchema,
  error: Schema.Union([NotFoundError, InvalidSchemaError, ForbiddenError]),
});

export const DeleteCollection = Rpc.make("DeleteCollection", {
  payload: Schema.Struct({
    collectionId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const CollectionsRpcs = RpcGroup.make(
  CreateCollection,
  ListCollections,
  UpdateCollectionSchema,
  DeleteCollection,
).middleware(AuthMiddleware);
