import { Schema, Context } from "effect";

export const SessionOrganizationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});

export const SessionProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String),
  slug: Schema.String,
});

const SessionOrganizationsSchema = Schema.Array(SessionOrganizationSchema);
const SessionProjectsSchema = Schema.Array(SessionProjectSchema);

export const SessionCustomerSchema = Schema.Struct({
  distinctId: Schema.String,
});

export const SessionUserSchema = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
});

export const UserSessionSchema = Schema.Struct({
  cookie: Schema.NullOr(Schema.String),
  customer: Schema.Null,
  method: Schema.Literal("user"),
  name: Schema.String,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema,
  user: SessionUserSchema,
});

export const SecretKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  customer: Schema.Null,
  method: Schema.Literal("secret-key"),
  name: Schema.String,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema,
  user: Schema.Null,
});

export const PublishableKeySessionSchema = Schema.Struct({
  cookie: Schema.Null,
  customer: SessionCustomerSchema,
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

export type UserSession = typeof UserSessionSchema.Type;
export type SecretKeySession = typeof SecretKeySessionSchema.Type;
export type PublishableKeySession = typeof PublishableKeySessionSchema.Type;

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

export type AnyAuthSession =
  | UserSession
  | SecretKeySession
  | PublishableKeySession;

export class AuthSession extends Context.Service<AuthSession, UserSession | SecretKeySession | PublishableKeySession>()("shared/auth/AuthSession") {}
