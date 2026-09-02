import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

/** Stable failure raised when an authentication token cannot be parsed or verified. */
export class JwtAuthError extends Schema.TaggedErrorClass<JwtAuthError>("JwtAuthError")(
  "JwtAuthError",
  {
    cause: Schema.optional(Schema.Unknown),
    /**
     * Enumerable rendering of `cause` for transports that serialize errors via
     * `Object.keys`.
     */
    detail: Schema.optional(Schema.String),
    message: Schema.String,
  },
) {}

/** Claims required from a verified identity token. */
export const JwtAuthPayloadDefinition = Schema.Struct({
  sub: Schema.String,
  email: Schema.String,
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.String),
});

/** Claims decoded from a verified identity token. */
export type JwtAuthPayload = typeof JwtAuthPayloadDefinition.Type;
export type JwtAuthPayloadDefinition = typeof JwtAuthPayloadDefinition.Type;

/**
 * Provider-qualified result returned by {@link AuthTokenVerifier}.
 *
 * `provider` is an open string rather than a closed union: trust derives from
 * which verifier validated the token, not from the tag, and the shared contract
 * should not have to enumerate every deployment's providers.
 */
export const ValidatedJwtDefinition = Schema.Struct({
  payload: JwtAuthPayloadDefinition,
  provider: Schema.String,
});

/** Verified token plus the identity provider that issued it. */
export type ValidatedJwt = typeof ValidatedJwtDefinition.Type;
export type ValidatedJwtDefinition = typeof ValidatedJwtDefinition.Type;

/** Provider-neutral capability required by backend session resolution. */
export interface AuthTokenVerifierShape {
  readonly validateToken: (token: string) => Effect.Effect<ValidatedJwt, JwtAuthError>;
}

/**
 * Verifies identity tokens without exposing the runtime used to cache keys or
 * execute validation.
 */
export class AuthTokenVerifier extends Context.Service<AuthTokenVerifier, AuthTokenVerifierShape>()(
  "@voidhash/core/AuthTokenVerifier",
) {}

const bearerToken = (authorizationHeader: Option.Option<string>): string =>
  Option.match(authorizationHeader, {
    onNone: () => "",
    onSome: (header) => (header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""),
  });

/** Extracts the raw token from a `Bearer <token>` Authorization header. */
export const extractBearerToken = (
  authorizationHeader: Option.Option<string>,
): Effect.Effect<string, JwtAuthError> => {
  const token = bearerToken(authorizationHeader);

  if (Str.isNonEmpty(token)) return Effect.succeed(token);
  return Effect.fail(
    new JwtAuthError({
      message: "Expected an Authorization header of the form 'Bearer <token>'",
    }),
  );
};
