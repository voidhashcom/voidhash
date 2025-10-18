import { Rpc, RpcGroup } from '@effect/rpc';
import { AuthenticationError, UserServiceError } from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export class User extends Schema.Class<User>('User')({
  name: Schema.String,
  id: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.String,
      logo: Schema.NullOr(Schema.String)
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      logo: Schema.NullOr(Schema.String),
      slug: Schema.String,
      organizationId: Schema.String
    })
  )
}) {}

export class UserRpcsDef extends RpcGroup.make(
  Rpc.make('CurrentUser', {
    success: User,
    error: Schema.Union(UserServiceError, AuthenticationError)
  })
).middleware(AuthMiddleware) {}
