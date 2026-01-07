import { Rpc, RpcGroup } from "@effect/rpc";
import { AuthenticationError, UserServiceError } from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const User = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      slug: Schema.String,
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    })
  ),
  updatedAt: Schema.Date,
});

export class UserRpcsDef extends RpcGroup.make(
  Rpc.make("CurrentUser", {
    error: Schema.Union(UserServiceError, AuthenticationError),
    success: User,
  })
).middleware(AuthMiddleware) {}
