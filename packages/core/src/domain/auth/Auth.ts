import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { AuthSession } from "@voidhash/rpc";
// Single canonical AuthSession service tag — the rpc package owns the
// definition and middleware that provides it; re-exporting here keeps domain
// callers using the same class instance, so per-request middleware provisions
// satisfy every consumer (including ones that imported AuthSession from this
// domain module before the migration).
export { AuthSession };

/** Action is forbidden due to insufficient permissions */
export class ActionForbiddenError extends Schema.TaggedErrorClass<ActionForbiddenError>(
  "ActionForbiddenError",
)("ActionForbiddenError", { message: Schema.String }) {}

/** Authentication failed */
export class AuthenticationError extends Schema.TaggedErrorClass<AuthenticationError>(
  "AuthenticationError",
)("AuthenticationError", { cause: Schema.String, message: Schema.String }) {}

/** User is not authenticated */
export class NotAuthenticatedError extends Schema.TaggedErrorClass<NotAuthenticatedError>(
  "NotAuthenticatedError",
)("NotAuthenticatedError", { message: Schema.String }) {}

export const SessionOrganizationDefinition = Schema.Struct({
  id: Schema.String,
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
  workosOrganizationId: Schema.NullOr(Schema.String),
});
export type SessionOrganizationDefinition = typeof SessionOrganizationDefinition.Type;

export const SessionProjectDefinition = Schema.Struct({
  id: Schema.String,
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});
export type SessionProjectDefinition = typeof SessionProjectDefinition.Type;

const SessionOrganizationsDefinition = Schema.Array(SessionOrganizationDefinition);
const SessionProjectsDefinition = Schema.Array(SessionProjectDefinition);
type SessionOrganizationsDefinition = typeof SessionOrganizationsDefinition.Type;
type SessionProjectsDefinition = typeof SessionProjectsDefinition.Type;

export const SessionPersonDefinition = Schema.Struct({
  distinctId: Schema.String,
});
export type SessionPersonDefinition = typeof SessionPersonDefinition.Type;

const SessionUserWire = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  isEmailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
  workosUserId: Schema.NullOr(Schema.String),
}).pipe(Schema.encodeKeys({ isEmailVerified: "emailVerified" }));
type SessionUserWire = typeof SessionUserWire.Type;

interface SessionUserFields extends Omit<SessionUserWire, "isEmailVerified"> {
  readonly emailVerified: boolean;
}

const SessionUserValue = Schema.declare<SessionUserFields>(
  (input): input is SessionUserFields => P.isObject(input),
);
type SessionUserValue = typeof SessionUserValue.Type;

export const SessionUserDefinition = SessionUserWire.pipe(
  Schema.decodeTo(
    SessionUserValue,
    SchemaTransformation.transform({
      decode: ({ isEmailVerified, ...user }) => ({
        ...user,
        emailVerified: isEmailVerified,
      }),
      encode: ({ emailVerified, ...user }) => ({
        ...user,
        isEmailVerified: emailVerified,
      }),
    }),
  ),
);
export type SessionUserDefinition = typeof SessionUserDefinition.Type;

export const UserSessionDefinition = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  person: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: SessionOrganizationsDefinition,
  projects: SessionProjectsDefinition,
  user: SessionUserDefinition,
});
export type UserSessionDefinition = typeof UserSessionDefinition.Type;

export const SecretKeySessionDefinition = Schema.Struct({
  cookie: Schema.Null,
  person: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: SessionOrganizationsDefinition,
  projects: SessionProjectsDefinition,
  user: Schema.Null,
});
export type SecretKeySessionDefinition = typeof SecretKeySessionDefinition.Type;

export const PublishableKeySessionDefinition = Schema.Struct({
  cookie: Schema.Null,
  person: SessionPersonDefinition,
  method: Schema.Literal("publishable-key"),
  name: Schema.String,
  organizations: SessionOrganizationsDefinition,
  projects: SessionProjectsDefinition,
  user: Schema.Null,
});
export type PublishableKeySessionDefinition = typeof PublishableKeySessionDefinition.Type;

export const AuthSessionDefinition = Schema.Union([
  UserSessionDefinition,
  SecretKeySessionDefinition,
  PublishableKeySessionDefinition,
]);
export type AuthSessionDefinition = typeof AuthSessionDefinition.Type;

export type UserSession = typeof UserSessionDefinition.Type;
export type SecretKeySession = typeof SecretKeySessionDefinition.Type;
export type PublishableKeySession = typeof PublishableKeySessionDefinition.Type;

export type AnyAuthSession = UserSession | SecretKeySession | PublishableKeySession;

/** Project fields required to construct a trusted internal service session. */
export interface InternalProjectSessionProject {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly slug: string;
}

/**
 * Constructs the single-project session used by trusted server-side adapters.
 * The returned session still passes through the normal service authorization
 * checks and grants no access outside the supplied project.
 */
export const makeInternalProjectAuthSession = (
  project: InternalProjectSessionProject,
  name = `${project.name} API Key`,
): AuthSession["Service"] => ({
  cookie: null,
  method: "secret-key",
  name,
  organizations: [],
  person: null,
  projects: [
    {
      id: project.id,
      logo: null,
      name: project.name,
      organizationId: project.organizationId,
      permissions: ["project:all"],
      slug: project.slug,
    },
  ],
  user: null,
});

/**
 * Constructs a trusted single-project user session while preserving the
 * authenticated user's identity across an internal runtime boundary.
 */
export const makeInternalProjectUserAuthSession = (
  project: InternalProjectSessionProject,
  userId: string,
  name = "Internal user session",
): AuthSession["Service"] => {
  const timestamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));
  return {
    cookie: null,
    method: "user",
    name,
    organizations: [],
    person: null,
    projects: [
      {
        id: project.id,
        logo: null,
        name: project.name,
        organizationId: project.organizationId,
        permissions: ["project:all"],
        slug: project.slug,
      },
    ],
    user: {
      createdAt: timestamp,
      email: "",
      emailVerified: false,
      id: userId,
      image: null,
      name,
      role: null,
      updatedAt: timestamp,
      workosUserId: null,
    },
  };
};
