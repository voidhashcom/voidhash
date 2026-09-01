import * as Schema from "effect/Schema";
import * as P from "effect/Predicate";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Context from "effect/Context";

// ============================================================================
// Session Sub-Schemas
// ============================================================================

export const ApiSessionOrganization = Schema.Struct({
  id: Schema.String,
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
  workosOrganizationId: Schema.NullOr(Schema.String),
});
export type ApiSessionOrganization = typeof ApiSessionOrganization.Type;

export const ApiSessionProject = Schema.Struct({
  id: Schema.String,
  logo: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});
export type ApiSessionProject = typeof ApiSessionProject.Type;

const ApiSessionOrganizations = Schema.Array(ApiSessionOrganization);
const ApiSessionProjects = Schema.Array(ApiSessionProject);

export const ApiSessionPerson = Schema.Struct({
  distinctId: Schema.String,
});
export type ApiSessionPerson = typeof ApiSessionPerson.Type;

const ApiSessionUserWire = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  isEmailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
  workosUserId: Schema.NullOr(Schema.String),
});
type ApiSessionUserWire = typeof ApiSessionUserWire.Type;

interface ApiSessionUserFields extends Omit<ApiSessionUserWire, "isEmailVerified"> {
  readonly emailVerified: boolean;
}

const ApiSessionUserValue = Schema.declare<ApiSessionUserFields>(
  (input): input is ApiSessionUserFields => P.isObject(input),
);

export const ApiSessionUser = ApiSessionUserWire.pipe(
  Schema.decodeTo(
    ApiSessionUserValue,
    SchemaTransformation.transform({
      decode: ({ isEmailVerified, ...user }) => ({ ...user, emailVerified: isEmailVerified }),
      encode: ({ emailVerified, ...user }) => ({ ...user, isEmailVerified: emailVerified }),
    }),
  ),
);
export type ApiSessionUser = typeof ApiSessionUser.Type;

// ============================================================================
// Session Type Schemas
// ============================================================================

export const ApiUserSession = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  person: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: ApiSessionOrganizations,
  projects: ApiSessionProjects,
  user: ApiSessionUser,
});
export type ApiUserSession = typeof ApiUserSession.Type;

export const ApiSecretKeySession = Schema.Struct({
  cookie: Schema.Null,
  person: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: ApiSessionOrganizations,
  projects: ApiSessionProjects,
  user: Schema.Null,
});
export type ApiSecretKeySession = typeof ApiSecretKeySession.Type;

export const ApiPublishableKeySession = Schema.Struct({
  cookie: Schema.Null,
  person: ApiSessionPerson,
  method: Schema.Literal("publishable-key"),
  name: Schema.String,
  organizations: ApiSessionOrganizations,
  projects: ApiSessionProjects,
  user: Schema.Null,
});
export type ApiPublishableKeySession = typeof ApiPublishableKeySession.Type;

// ============================================================================
// Combined Auth Session Schema
// ============================================================================

export const ApiAuthSessionValue = Schema.Union([
  ApiUserSession,
  ApiSecretKeySession,
  ApiPublishableKeySession,
]);
export type ApiAuthSessionValue = typeof ApiAuthSessionValue.Type;

// ============================================================================
// Type Exports
// ============================================================================

export type AnyApiAuthSession = ApiAuthSessionValue;

// ============================================================================
// Context Tag
// ============================================================================

export class ApiAuthSession extends Context.Service<
  ApiAuthSession,
  ApiUserSession | ApiSecretKeySession | ApiPublishableKeySession
>()("api-spec/auth/ApiAuthSession") {}

export { ApiSessionOrganization as ApiSessionOrganizationSchema };
export { ApiSessionProject as ApiSessionProjectSchema };
export { ApiSessionPerson as ApiSessionPersonSchema };
export { ApiSessionUser as ApiSessionUserSchema };
