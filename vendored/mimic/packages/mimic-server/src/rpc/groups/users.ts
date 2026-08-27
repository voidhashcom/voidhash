import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import { CreateUserResponseSchema, UserSchema } from "../schemas.ts";

export const CreateUser = Rpc.make("CreateUser", {
  payload: Schema.Struct({
    username: Schema.String,
    password: Schema.String,
  }),
  success: CreateUserResponseSchema,
  error: Schema.Union([ConflictError, ForbiddenError]),
});

export const ListUsers = Rpc.make("ListUsers", {
  success: Schema.Array(UserSchema),
  error: ForbiddenError,
});

export const DeleteUser = Rpc.make("DeleteUser", {
  payload: Schema.Struct({
    userId: Schema.String,
  }),
  success: Schema.Void,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const UsersRpcs = RpcGroup.make(CreateUser, ListUsers, DeleteUser).middleware(
  AuthMiddleware,
);
