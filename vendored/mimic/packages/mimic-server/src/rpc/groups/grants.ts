import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ForbiddenError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import { DatabasePermissionSchema, GrantSchema } from "../schemas.ts";

export const GrantPermission = Rpc.make("GrantPermission", {
  payload: Schema.Struct({
    userId: Schema.String,
    databaseId: Schema.String,
    permission: DatabasePermissionSchema,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const RevokePermission = Rpc.make("RevokePermission", {
  payload: Schema.Struct({
    userId: Schema.String,
    databaseId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const ListGrants = Rpc.make("ListGrants", {
  payload: Schema.Struct({
    userId: Schema.optional(Schema.String),
  }),
  success: Schema.Array(GrantSchema),
  error: ForbiddenError,
});

export const GrantsRpcs = RpcGroup.make(GrantPermission, RevokePermission, ListGrants).middleware(
  AuthMiddleware,
);
