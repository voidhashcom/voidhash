import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as P from "effect/Predicate";

const booleanValue = Schema.declare(P.isBoolean);

export const SessionOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});
export type SessionOrganization = typeof SessionOrganization.Type;

export const SessionProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});
export type SessionProject = typeof SessionProject.Type;

const SessionOrganizations = Schema.Array(SessionOrganization);
const SessionProjects = Schema.Array(SessionProject);

export const SessionCustomer = Schema.Struct({
  distinctId: Schema.String,
});
export type SessionCustomer = typeof SessionCustomer.Type;

export const SessionUser = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: booleanValue,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
});
export type SessionUser = typeof SessionUser.Type;

export const UserSession = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  customer: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: SessionOrganizations,
  projects: SessionProjects,
  user: SessionUser,
});
export type UserSession = typeof UserSession.Type;

export const SecretKeySession = Schema.Struct({
  cookie: Schema.Null,
  customer: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: SessionOrganizations,
  projects: SessionProjects,
  user: Schema.Null,
});
export type SecretKeySession = typeof SecretKeySession.Type;

export const PublishableKeySession = Schema.Struct({
  cookie: Schema.Null,
  customer: SessionCustomer,
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

// type User = {
//   name: string;
//   id: string;
//   createdAt: Date;
//   updatedAt: Date;
//   email: string;
//   emailVerified: boolean;
//   image: string | null;
// };

// type VoidhashBaseSession = {
//   readonly organizations: {
//     readonly id: string;
//     readonly name: string;
//     readonly slug: string;
//     readonly permissions: string[];
//   }[];
//   readonly projects: {
//     readonly id: string;
//     readonly slug: string;
//     readonly name: string;
//     readonly organizationId: string;
//     readonly permissions: string[];
//   }[];
// };

// export type UserSession = VoidhashBaseSession & {
//   readonly method: 'user';
//   readonly name: string;
//   readonly user: User;
//   readonly customer: null;
//   readonly cookie: string | null;
// };

// export type SecretKeySession = VoidhashBaseSession & {
//   readonly method: 'secret-key';
//   readonly name: string;
//   readonly user: null;
//   readonly customer: null;
//   readonly cookie: null;
// };

// export type PublishableKeySession = VoidhashBaseSession & {
//   readonly method: 'publishable-key';
//   readonly name: string;
//   readonly customer: {
//     readonly distinctId: string;
//   };
//   readonly user: null;
//   readonly cookie: null;
// };

export type AnyAuthSession = UserSession | SecretKeySession | PublishableKeySession;

export class AuthSession extends Context.Service<
  AuthSession,
  UserSession | SecretKeySession | PublishableKeySession
>()("shared/auth/AuthSession") {}

export { SessionOrganization as SessionOrganizationSchema };
export { SessionProject as SessionProjectSchema };
export { SessionCustomer as SessionCustomerSchema };
export { SessionUser as SessionUserSchema };
