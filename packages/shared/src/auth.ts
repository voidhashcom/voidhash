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

type User = {
  name: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  image: string | null;
};

type VoidhashBaseSession = {
  readonly organizations: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly permissions: string[];
  }[];
  readonly projects: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly organizationId: string;
    readonly permissions: string[];
  }[];
};

export type UserSession = VoidhashBaseSession & {
  readonly method: 'user';
  readonly name: string;
  readonly user: User;
  readonly customer: null;
  readonly cookie: string | null;
};

export type SecretKeySession = VoidhashBaseSession & {
  readonly method: 'secret-key';
  readonly name: string;
  readonly user: null;
  readonly customer: null;
  readonly cookie: null;
};

export type PublishableKeySession = VoidhashBaseSession & {
  readonly method: 'publishable-key';
  readonly name: string;
  readonly customer: {
    readonly appUserId: string;
  };
  readonly user: null;
  readonly cookie: null;
};

export type AnyAuthSession =
  | UserSession
  | SecretKeySession
  | PublishableKeySession;

export class AuthSession extends Context.Tag('shared/auth/AuthSession')<
  AuthSession,
  UserSession | SecretKeySession | PublishableKeySession
>() {}
