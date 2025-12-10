import { Config, Data, Effect } from 'effect';
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';

export class JwtAuthError extends Data.TaggedError('JwtAuthError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export interface JwtAuthPayload extends JWTPayload {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly image?: string;
}

export class JwtAuth extends Effect.Service<JwtAuth>()('app/JwtAuth', {
  effect: Effect.gen(function* () {
    const authBaseUrl = yield* Config.string('VOIDHASH_AUTH_BASE_URL');

    // Create the JWKS once during service initialization
    const jwksUrl = new URL(`${authBaseUrl}/auth/api/auth/jwks`);
    const jwks = createRemoteJWKSet(jwksUrl);

    return {
      /**
       * Validates a JWT access token and returns the payload
       */
      validateToken: (token: string) =>
        Effect.tryPromise({
          try: async () => {
            const { payload } = await jwtVerify(token, jwks, {
              issuer: authBaseUrl
            });
            return payload as JwtAuthPayload;
          },
          catch: (error) =>
            new JwtAuthError({
              message: 'JWT validation failed',
              cause: error
            })
        }),

      /**
       * Extracts the Bearer token from an Authorization header
       */
      extractBearerToken: (authorizationHeader: string | undefined) =>
        Effect.gen(function* () {
          if (!authorizationHeader) {
            return yield* Effect.fail(
              new JwtAuthError({
                message: 'Missing Authorization header'
              })
            );
          }

          if (!authorizationHeader.startsWith('Bearer ')) {
            return yield* Effect.fail(
              new JwtAuthError({
                message:
                  'Invalid Authorization header format. Expected: Bearer <token>'
              })
            );
          }

          const token = authorizationHeader.slice(7);
          if (!token) {
            return yield* Effect.fail(
              new JwtAuthError({
                message: 'Empty Bearer token'
              })
            );
          }

          return token;
        })
    };
  })
}) {}
