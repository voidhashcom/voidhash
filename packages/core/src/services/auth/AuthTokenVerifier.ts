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

/** Claims required from a verified identity token. */
export const JwtAuthPayloadSchema = Schema.Struct({
  sub: Schema.String,
  email: Schema.String,
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.String),
});

/** Claims decoded from a verified identity token. */
export type JwtAuthPayload = typeof JwtAuthPayloadSchema.Type;

/**
 * Provider-qualified result returned by {@link AuthTokenVerifier}.
 *
 * `provider` is an open string rather than a closed union: trust derives from
 * which verifier validated the token, not from the tag, and the shared contract
 * should not have to enumerate every deployment's providers.
 */
export const ValidatedJwtSchema = Schema.Struct({
  payload: JwtAuthPayloadSchema,
  provider: Schema.String,
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

const bearerToken = (authorizationHeader: string | undefined): string => {
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }
  return "";
};

/** Extracts the raw token from a `Bearer <token>` Authorization header. */
export const extractBearerToken = (
  authorizationHeader: string | undefined,
): Effect.Effect<string, JwtAuthError> => {
  const token = bearerToken(authorizationHeader);

  if (token.length > 0) return Effect.succeed(token);
  return Effect.fail(
    new JwtAuthError({
      message: "Expected an Authorization header of the form 'Bearer <token>'",
    }),
  );
};
