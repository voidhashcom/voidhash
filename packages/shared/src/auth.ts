import { HttpApiSchema } from '@effect/platform';
import { Context, Schema } from 'effect';

export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  'AuthenticationError',
  {
    message: Schema.String,
    cause: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

export class NotAuthenticatedError extends Schema.TaggedError<NotAuthenticatedError>()(
  'NotAuthenticatedError',
  {
    message: Schema.String
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

export const SessionOrganizationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  permissions: Schema.Array(Schema.String)
});

export const SessionProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  organizationId: Schema.String,
  permissions: Schema.Array(Schema.String)
});

const SessionOrganizationsSchema = Schema.Array(SessionOrganizationSchema);
const SessionProjectsSchema = Schema.Array(SessionProjectSchema);

export const SessionCustomerSchema = Schema.Struct({
  appUserId: Schema.String
});

export const SessionUserSchema = Schema.Struct({
  name: Schema.String,
  id: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String)
});

export const UserSessionSchema = Schema.Struct({
  method: Schema.Literal('user'),
  name: Schema.String,
  user: SessionUserSchema,
  customer: Schema.Null,
  cookie: Schema.NullOr(Schema.String),
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema
});

export const SecretKeySessionSchema = Schema.Struct({
  method: Schema.Literal('secret-key'),
  name: Schema.String,
  user: Schema.Null,
  customer: Schema.Null,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema
});

export const PublishableKeySessionSchema = Schema.Struct({
  method: Schema.Literal('publishable-key'),
  name: Schema.String,
  user: Schema.Null,
  customer: SessionCustomerSchema,
  organizations: SessionOrganizationsSchema,
  projects: SessionProjectsSchema
});

export const AuthSessionSchema = Schema.Union(
  UserSessionSchema,
  SecretKeySessionSchema,
  PublishableKeySessionSchema
);

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
//     readonly appUserId: string;
//   };
//   readonly user: null;
//   readonly cookie: null;
// };

export type AnyAuthSession =
  | UserSession
  | SecretKeySession
  | PublishableKeySession;

export class AuthSession extends Context.Tag('shared/auth/AuthSession')<
  AuthSession,
  UserSession | SecretKeySession | PublishableKeySession
>() {}
