import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ConflictError, ForbiddenError, InvalidSchemaError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import {
  CollectionSchema,
  CreateCollectionResponseSchema,
  SchemaObjectRpcSchema,
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
  DeleteCollection,
).middleware(AuthMiddleware);
