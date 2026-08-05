/**
 * Standalone identity provider — the self-host half of the auth seam.
 *
 * Identity comes from root credentials held in the environment and is carried
 * by a signed session token, so there is no directory to call and nothing to
 * verify remotely: both the cookie and the bearer path resolve straight out of
 * the token claims.
 *
 * The provider can only ever emit the single root identity, which is what makes
 * self-host single-player structurally rather than by policy.
 */
import { Effect, Layer } from "effect";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import {
  STANDALONE_AUTH_COOKIE_NAME,
  readCookieValue,
  verifyStandaloneAuthToken,
  type StandaloneAuthTokenClaims,
} from "../../utils/crypto/standalone-auth-token.ts";
import { AuthTokenVerifier, JwtAuthError, type ValidatedJwt } from "./AuthTokenVerifier.ts";
import { IdentityProvider, IdentityProviderError } from "./IdentityProvider.ts";

/** Provider tag stamped on tokens issued by the standalone provider. */
export const STANDALONE_PROVIDER = "standalone";

const identityFromClaims = (claims: {
  readonly sub: string;
  readonly email: string;
  readonly name?: string | undefined;
  readonly image?: string | undefined;
}): LocalUserIdentity => ({
  email: claims.email,
  // The operator configured this address out of band; there is no mailbox
  // round-trip to perform and no second identity that could claim it.
  emailVerified: true,
  externalId: null,
  firstName: claims.name ?? claims.email,
  id: claims.sub,
  lastName: null,
  profilePictureUrl: claims.image ?? null,
});

/** Maps verified standalone token claims onto the shared identity shape. */
export const standaloneIdentityFromClaims = (
  claims: StandaloneAuthTokenClaims,
): LocalUserIdentity => identityFromClaims(claims);

/**
 * Verifies standalone HS256 session tokens. The bearer path needs no external
 * key server, so the same secret validates cookies and API bearer tokens.
 */
export const StandaloneAuthTokenVerifierLive = (secret: string): Layer.Layer<AuthTokenVerifier> =>
  Layer.succeed(AuthTokenVerifier)(
    AuthTokenVerifier.of({
      validateToken: (token) =>
        verifyStandaloneAuthToken(token, secret).pipe(
          Effect.map(
            (claims): ValidatedJwt => ({
              payload: {
                email: claims.email,
                sub: claims.sub,
                ...(claims.image === undefined ? {} : { image: claims.image }),
                ...(claims.name === undefined ? {} : { name: claims.name }),
              },
              provider: STANDALONE_PROVIDER,
            }),
          ),
          Effect.mapError(
            (error) =>
              new JwtAuthError({
                cause: error,
                detail: error.message,
                message: "JWT validation failed",
              }),
          ),
        ),
    }),
  );

/** Identity provider backed by locally signed root session tokens. */
export const StandaloneIdentityProviderLive = (secret: string): Layer.Layer<IdentityProvider> =>
  Layer.succeed(IdentityProvider)(
    IdentityProvider.of({
      authenticateSessionCookie: (headers) => {
        const token = readCookieValue(headers.get("cookie"), STANDALONE_AUTH_COOKIE_NAME);
        if (!token) return Effect.succeed(null);
        return verifyStandaloneAuthToken(token, secret).pipe(
          Effect.map(identityFromClaims),
          // An expired or tampered cookie is "no session" rather than a hard
          // failure, so the browser is redirected to sign in again.
          Effect.catch(() => Effect.succeed(null)),
        );
      },
      cookieName: STANDALONE_AUTH_COOKIE_NAME,
      // Nothing to link: the root subject is a constant, so the mapping to the
      // local user row is already stable without writing anything back.
      linkExternalId: () => Effect.void,
      resolveIdentity: (validated) =>
        validated.provider === STANDALONE_PROVIDER
          ? Effect.succeed(identityFromClaims(validated.payload))
          : Effect.fail(
              new IdentityProviderError({
                cause: validated.provider,
                message: "Standalone identity provider received a token from another provider",
              }),
            ),
      // Only reached through an OAuth path that requires a remote directory.
      // Self-host MCP clients authenticate with project secret keys or user API
      // keys instead.
      resolveIdentityById: (providerUserId) =>
        Effect.fail(
          new IdentityProviderError({
            cause: providerUserId,
            message: "Standalone identity provider cannot resolve an identity by id alone",
          }),
        ),
    }),
  );
