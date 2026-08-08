/**
 * Server-side helpers for the standalone root session.
 *
 * Deliberately not named `*.server.ts`: that pattern is import-protected from
 * any client-reachable module, and these helpers are needed by the server-fn
 * handlers the dashboard imports. Every export is only ever called from a
 * server route handler or a `createServerFn` handler, both of which the
 * framework strips from the client bundle.
 *
 * The signed token minted here is the same one the backend verifies, so the
 * dashboard and the API agree on the identity with no shared state beyond the
 * signing key.
 */
import { resolveStandaloneAuthConfig } from "@voidhash/core/services/auth/StandaloneAuthConfig";
import {
  STANDALONE_AUTH_COOKIE_NAME,
  STANDALONE_AUTH_DEFAULT_TTL_SECONDS,
  readCookieValue,
  secretsMatch,
  signStandaloneAuthToken,
  verifyStandaloneAuthToken,
  type StandaloneAuthTokenClaims,
} from "@voidhash/core/utils/crypto/standalone-auth-token";
import { Effect } from "effect";

export interface StandaloneSessionUser {
  readonly email: string;
  readonly id: string;
  readonly name: string;
}

const toUser = (claims: StandaloneAuthTokenClaims): StandaloneSessionUser => ({
  email: claims.email,
  id: claims.sub,
  name: claims.name ?? claims.email,
});

/**
 * Verifies the submitted root credentials.
 *
 * Both fields are compared in constant time, and the username is checked even
 * when it is wrong, so a failed attempt takes the same work regardless of which
 * field was incorrect.
 */
export const verifyRootCredentials = async (input: {
  readonly username: string;
  readonly password: string;
}): Promise<boolean> => {
  const config = resolveStandaloneAuthConfig();
  const [usernameMatches, passwordMatches] = await Effect.runPromise(
    Effect.all(
      [
        secretsMatch(input.username.trim(), config.rootUsername),
        secretsMatch(input.password, config.rootPassword),
      ],
      { concurrency: "unbounded" },
    ),
  );
  return usernameMatches && passwordMatches;
};

/** Mints a session token for the configured root identity. */
export const mintStandaloneSessionToken = (): Promise<string> => {
  const config = resolveStandaloneAuthConfig();
  return Effect.runPromise(
    signStandaloneAuthToken({
      email: config.rootEmail,
      name: config.rootUsername,
      secret: config.secret,
    }),
  );
};

/** Reads and verifies the session from a request, or `null` when absent. */
export const readStandaloneSession = async (
  request: Request,
): Promise<{ token: string; user: StandaloneSessionUser } | null> => {
  const token = readCookieValue(request.headers.get("cookie"), STANDALONE_AUTH_COOKIE_NAME);
  if (!token) return null;

  const claims = await Effect.runPromise(
    verifyStandaloneAuthToken(token, resolveStandaloneAuthConfig().secret).pipe(
      Effect.map((value): StandaloneAuthTokenClaims | null => value),
      Effect.catch(() => Effect.succeed(null)),
    ),
  );

  return claims === null ? null : { token, user: toUser(claims) };
};

/**
 * Serializes the session cookie. `Secure` tracks the request scheme so the
 * cookie is still accepted over plain-HTTP loopback during evaluation, while a
 * real HTTPS deployment always gets it.
 */
export const standaloneSessionCookie = (token: string, request: Request): string => {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${STANDALONE_AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STANDALONE_AUTH_DEFAULT_TTL_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
};

/** Serializes the cookie that clears the session. */
export const clearedStandaloneSessionCookie = (): string =>
  `${STANDALONE_AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
