import * as Schema from "effect/Schema";

export class User extends Schema.Class<User>("User")({
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
      /** Enabled internal feature flag keys for this org (see UserRpcsDef). */
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
}) {}
