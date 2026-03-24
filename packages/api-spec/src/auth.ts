import { Schema, ServiceMap } from "effect";

// ============================================================================
// Session Sub-Schemas
// ============================================================================

export const ApiSessionOrganizationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});

export const ApiSessionProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});

const ApiSessionOrganizationsSchema = Schema.Array(ApiSessionOrganizationSchema);
const ApiSessionProjectsSchema = Schema.Array(ApiSessionProjectSchema);

export const ApiSessionCustomerSchema = Schema.Struct({
  distinctId: Schema.String,
});

export const ApiSessionUserSchema = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
});

// ============================================================================
// Session Type Schemas
// ============================================================================

export const ApiUserSessionSchema = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  customer: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: ApiSessionOrganizationsSchema,
  projects: ApiSessionProjectsSchema,
  user: ApiSessionUserSchema,
});

export const ApiSecretKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  customer: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: ApiSessionOrganizationsSchema,
  projects: ApiSessionProjectsSchema,
  user: Schema.Null,
});

export const ApiPublishableKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  customer: ApiSessionCustomerSchema,
  method: Schema.Literal("publishable-key"),
  name: Schema.String,
  organizations: ApiSessionOrganizationsSchema,
  projects: ApiSessionProjectsSchema,
  user: Schema.Null,
});

// ============================================================================
// Combined Auth Session Schema
// ============================================================================

export const ApiAuthSessionSchema = Schema.Union([
  ApiUserSessionSchema,
  ApiSecretKeySessionSchema,
  ApiPublishableKeySessionSchema,
]);

// ============================================================================
// Type Exports
// ============================================================================

export type ApiUserSession = typeof ApiUserSessionSchema.Type;
export type ApiSecretKeySession = typeof ApiSecretKeySessionSchema.Type;
export type ApiPublishableKeySession = typeof ApiPublishableKeySessionSchema.Type;
export type AnyApiAuthSession =
  | ApiUserSession
  | ApiSecretKeySession
  | ApiPublishableKeySession;

// ============================================================================
// Context Tag
// ============================================================================

export class ApiAuthSession extends ServiceMap.Service<ApiAuthSession, ApiUserSession | ApiSecretKeySession | ApiPublishableKeySession>()("api-spec/auth/ApiAuthSession") {}
