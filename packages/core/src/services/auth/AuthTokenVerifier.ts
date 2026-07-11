import { Context, Data, Effect, Schema } from "effect";

/** Stable failure raised when an authentication token cannot be parsed or verified. */
export class JwtAuthError extends Data.TaggedError("JwtAuthError")<{
  readonly cause?: unknown;
  /**
   * Enumerable rendering of `cause` for transports that serialize errors via
   * `Object.keys`.
   */
  readonly detail?: string;
  readonly message: string;
}> {}

/** Claims required from a verified WorkOS identity token. */
export const JwtAuthPayloadSchema = Schema.Struct({
  sub: Schema.String,
  email: Schema.String,
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.String),
});

/** Claims decoded from a verified WorkOS identity token. */
export type JwtAuthPayload = typeof JwtAuthPayloadSchema.Type;

/** Provider-qualified result returned by {@link AuthTokenVerifier}. */
export const ValidatedJwtSchema = Schema.Struct({
  payload: JwtAuthPayloadSchema,
  provider: Schema.Literal("workos"),
});

/** Verified token plus the identity provider that issued it. */
export type ValidatedJwt = typeof ValidatedJwtSchema.Type;

/** Provider-neutral capability required by backend session resolution. */
export interface AuthTokenVerifierShape {
  readonly validateToken: (
    token: string,
  ) => Effect.Effect<ValidatedJwt, JwtAuthError>;
}

/**
 * Verifies identity tokens without exposing the runtime used to cache keys or
 * execute validation.
 */
export class AuthTokenVerifier extends Context.Service<
  AuthTokenVerifier,
  AuthTokenVerifierShape
>()("@voidhash/core/AuthTokenVerifier") {}

/** Extracts the raw token from a `Bearer <token>` Authorization header. */
export const extractBearerToken = (
  authorizationHeader: string | undefined,
): Effect.Effect<string, JwtAuthError> => {
  const token = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";

  return token.length > 0
    ? Effect.succeed(token)
    : Effect.fail(
        new JwtAuthError({
          message: "Expected an Authorization header of the form 'Bearer <token>'",
        }),
      );
};
