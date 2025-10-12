import { HttpApiMiddleware, HttpApiSecurity } from '@effect/platform';
import {
  AuthenticationError,
  AuthSession,
  NotAuthenticatedError
} from '@voidhash/shared';
import { Schema } from 'effect';

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  'Http/AuthenticationMiddleware',
  {
    // Optionally define the error schema for the middleware
    provides: AuthSession,
    failure: Schema.Union(AuthenticationError, NotAuthenticatedError),
    security: {
      apiKey: HttpApiSecurity.apiKey({
        key: 'x-api-key',
        in: 'header'
      }),
      secretKey: HttpApiSecurity.apiKey({
        key: 'x-secret-key',
        in: 'header'
      }),
      publishableKey: HttpApiSecurity.apiKey({
        key: 'x-publishable-key',
        in: 'header'
      }),
      betterAuthCookie: HttpApiSecurity.apiKey({
        key: '__Secure-better-auth.session_token',
        in: 'cookie'
      })
    }
  }
) {}
