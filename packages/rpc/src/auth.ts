import * as Context from "effect/Context";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

export const SessionOrganization = Schema.Struct({
  id: Schema.String,
  /** Avatar URL (public file store) or `null` when none is set. */
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
  /** Local mirror of the linked WorkOS organization id. */
  workosOrganizationId: Schema.String,
});
export type SessionOrganization = typeof SessionOrganization.Type;

export const SessionProject = Schema.Struct({
  id: Schema.String,
  /** Avatar URL (public file store) or `null` when none is set. */
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});
export type SessionProject = typeof SessionProject.Type;

const SessionOrganizations = Schema.Array(SessionOrganization);
const SessionProjects = Schema.Array(SessionProject);

export const SessionPerson = Schema.Struct({
  distinctId: Schema.String,
});
export type SessionPerson = typeof SessionPerson.Type;

const SessionUserWire = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  isEmailVerified: Schema.Boolean,
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
type SessionUserWire = typeof SessionUserWire.Type;

export interface SessionUserFields extends Omit<SessionUserWire, "isEmailVerified"> {
  readonly emailVerified: boolean;
}

const SessionUserValue = Schema.declare<SessionUserFields>((input): input is SessionUserFields =>
  P.isObject(input),
);

export const SessionUser = SessionUserWire.pipe(
  Schema.decodeTo(
    SessionUserValue,
    SchemaTransformation.transform({
      decode: ({ isEmailVerified, ...user }) => ({ ...user, emailVerified: isEmailVerified }),
      encode: ({ emailVerified, ...user }) => ({ ...user, isEmailVerified: emailVerified }),
    }),
  ),
);
export type SessionUser = typeof SessionUser.Type;

export const UserSession = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  person: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: SessionOrganizations,
  projects: SessionProjects,
  user: SessionUser,
});
export type UserSession = typeof UserSession.Type;

export const SecretKeySession = Schema.Struct({
  cookie: Schema.Null,
  person: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: SessionOrganizations,
  projects: SessionProjects,
  user: Schema.Null,
});
export type SecretKeySession = typeof SecretKeySession.Type;

export const PublishableKeySession = Schema.Struct({
  cookie: Schema.Null,
  person: SessionPerson,
  method: Schema.Literal("publishable-key"),
  name: Schema.String,
  organizations: SessionOrganizations,
  projects: SessionProjects,
  user: Schema.Null,
});
export type PublishableKeySession = typeof PublishableKeySession.Type;

export const AuthSessionValue = Schema.Union([
  UserSession,
  SecretKeySession,
  PublishableKeySession,
]);
export type AuthSessionValue = typeof AuthSessionValue.Type;
export type AnyAuthSession = AuthSessionValue;

/** Current authenticated session provided to RPC middleware handlers. */
export class AuthSession extends Context.Service<AuthSession, AnyAuthSession>()(
  // Keep the existing service identifier while callers migrate away from @voidhash/shared.
  "shared/auth/AuthSession",
) {}

export { SessionOrganization as SessionOrganizationSchema };
export { SessionProject as SessionProjectSchema };
export { SessionPerson as SessionPersonSchema };
export { SessionUser as SessionUserSchema };
