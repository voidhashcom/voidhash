import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import { DatabaseSchema } from "../schemas.ts";

export const CreateDatabase = Rpc.make("CreateDatabase", {
  payload: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
  }),
  success: DatabaseSchema,
  error: Schema.Union([ConflictError, ForbiddenError]),
});

export const ListDatabases = Rpc.make("ListDatabases", {
  success: Schema.Array(DatabaseSchema),
  error: ForbiddenError,
});

export const DeleteDatabase = Rpc.make("DeleteDatabase", {
  payload: Schema.Struct({
    databaseId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const DatabasesRpcs = RpcGroup.make(
  CreateDatabase,
  ListDatabases,
  DeleteDatabase,
).middleware(AuthMiddleware);
