import { DateTime, Schema } from "effect";
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

export const SessionOrganizationSchema = Schema.Struct({
  id: Schema.String,
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
  workosOrganizationId: Schema.NullOr(Schema.String),
});

export const SessionProjectSchema = Schema.Struct({
  id: Schema.String,
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
