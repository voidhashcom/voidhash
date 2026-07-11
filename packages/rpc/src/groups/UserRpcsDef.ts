import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcAuthenticationError, RpcAvatarValidationError } from "../errors/common.ts";
import { RpcUserServiceError } from "../errors/user.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const User = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.NullOr(Schema.String),
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      slug: Schema.String,
      workosOrganizationId: Schema.NullOr(Schema.String),
      /**
       * Enabled internal feature flag keys for this organization (resolved
       * `override ?? defaultEnabled` over the `INTERNAL_FEATURE_FLAGS` registry).
       * Checked on the frontend via `useInternalFeatureFlag`.
       */
      internalFeatureFlags: Schema.Array(Schema.String),
    }),
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    }),
  ),
  updatedAt: Schema.Date,
});

export class UserRpcsDef extends RpcGroup.make(
  Rpc.make("CurrentUser", {
    error: Schema.Union([RpcUserServiceError, RpcAuthenticationError]),
    success: User,
  }),
  Rpc.make("SetUserAvatar", {
    error: Schema.Union([RpcUserServiceError, RpcAuthenticationError, RpcAvatarValidationError]),
    payload: {
      contentType: Schema.String,
      imageBase64: Schema.String,
    },
    success: Schema.Struct({ imageUrl: Schema.String }),
  }),
  Rpc.make("RemoveUserAvatar", {
    error: Schema.Union([RpcUserServiceError, RpcAuthenticationError]),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
