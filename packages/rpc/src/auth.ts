import { Context, Schema } from "effect";

export const SessionOrganizationSchema = Schema.Struct({
  id: Schema.String,
  /** Avatar URL (public file store) or `null` when none is set. */
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
  /** Local mirror of the linked WorkOS organization id. */
  workosOrganizationId: Schema.String,
});

export const SessionProjectSchema = Schema.Struct({
  id: Schema.String,
  /** Avatar URL (public file store) or `null` when none is set. */
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});

const SessionOrganizationsSchema = Schema.Array(SessionOrganizationSchema);
const SessionProjectsSchema = Schema.Array(SessionProjectSchema);

export const SessionPersonSchema = Schema.Struct({
  distinctId: Schema.String,
});

export const SessionUserSchema = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
  /**
   * Stable WorkOS user id (`user_xxx`). Populated when the session came from
   * a WorkOS auth path (cookie or bearer token). `null` for api-key sessions,
   * where the WorkOS user id is not available without an extra round-trip.
   */
  workosUserId: Schema.NullOr(Schema.String),
});

export const UserSessionSchema = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  person: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema,
  user: SessionUserSchema,
});

export const SecretKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  person: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema,
  user: Schema.Null,
});

export const PublishableKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  person: SessionPersonSchema,
  method: Schema.Literal("publishable-key"),
  name: Schema.String,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema,
  user: Schema.Null,
});

export const AuthSessionSchema = Schema.Union([
  UserSessionSchema,
  SecretKeySessionSchema,
  PublishableKeySessionSchema,
]);

export type UserSession = typeof UserSessionSchema.Type;
export type SecretKeySession = typeof SecretKeySessionSchema.Type;
export type PublishableKeySession = typeof PublishableKeySessionSchema.Type;
export type AnyAuthSession = UserSession | SecretKeySession | PublishableKeySession;

/** Current authenticated session provided to RPC middleware handlers. */
export class AuthSession extends Context.Service<AuthSession, AnyAuthSession>()(
  // Keep the existing service identifier while callers migrate away from @voidhash/shared.
  "shared/auth/AuthSession",
) {}
