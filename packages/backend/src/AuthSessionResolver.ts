import { type DbError } from "@voidhash/db";
import type { LocalUserIdentity } from "@voidhash/core/domain/auth/LocalUserSession";
import {
  type AuthTokenVerifier,
  extractBearerToken,
  type JwtAuthError,
} from "@voidhash/core/services/auth/AuthTokenVerifier";
import {
  IdentityProvider,
  type IdentityProviderError,
} from "@voidhash/core/services/auth/IdentityProvider";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import {
  RpcAuthenticationError,
  RpcNotAuthenticatedError,
  type UserSession,
} from "@voidhash/rpc";
import type { Db } from "@voidhash/db";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { Effect, Option } from "effect";

/** Union of the terminal failures session resolution can raise. */
export type RpcAuthFailure = RpcAuthenticationError | RpcNotAuthenticatedError;

const toWebHeaders = (headers: HttpHeaders.Headers): Headers =>
  new Headers(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

/** True when the request carries the active provider's session cookie. */
export const hasSessionCookieHeader = (
  headers: HttpHeaders.Headers,
  cookieName: string,
): boolean =>
  Option.exists(HttpHeaders.get(headers, "cookie"), (cookie) =>
    cookie.includes(`${cookieName}=`),
  );

const formatUnknownCause = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
};

const getDbErrorCause = (error: DbError): string =>
  error.cause === undefined ? error.message : formatUnknownCause(error.cause);

/**
 * Logs the underlying DB error and re-fails as a stable
 * {@link RpcAuthenticationError} so the database cause never leaks to callers.
 */
export const mapAuthenticationDbError = (
  error: DbError,
): Effect.Effect<never, RpcAuthenticationError> =>
  Effect.logError("RPC authentication database error", {
    cause: getDbErrorCause(error),
    message: error.message,
  }).pipe(
    Effect.flatMap(() =>
      Effect.fail(
        new RpcAuthenticationError({
          message: "Failed to authenticate due to a database error",
          cause: error.message,
        }),
      ),
    ),
  );

/**
 * Resolves an authenticated {@link UserSession} from the request headers,
 * mirroring the exact logic shared by the RPC auth and admin-auth middlewares:
 *
 * - An `authorization` header → bearer-token path: the request's JWT is
 *   validated through {@link AuthTokenVerifier}, then the
 *   {@link IdentityProvider} materialises it into a full identity.
 * - Otherwise the provider's session cookie → cookie path.
 * - Neither present → {@link RpcNotAuthenticatedError}.
 *
 * Failures from Db / the identity provider / JWT validation are normalised to
 * {@link RpcAuthenticationError} / {@link RpcNotAuthenticatedError}. The caller
 * supplies `Db` (and the ambient {@link IdentityProvider} /
 * {@link LocalUserSessionService}).
 */
export const resolveUserSession = (
  headers: HttpHeaders.Headers,
  authTokenVerifier: AuthTokenVerifier["Service"],
): Effect.Effect<UserSession, RpcAuthFailure, Db | IdentityProvider | LocalUserSessionService> =>
  Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const identityProvider = yield* IdentityProvider;

    const mapAuthenticationErrors = <A>(
      effect: Effect.Effect<
        A,
        DbError | IdentityProviderError | JwtAuthError | RpcNotAuthenticatedError,
        Db
      >,
    ): Effect.Effect<A, RpcAuthFailure, Db> =>
      effect.pipe(
        Effect.catchTag("EffectDrizzleQueryError", mapAuthenticationDbError),
        Effect.catchTag("JwtAuthError", (e) =>
          Effect.fail(
            new RpcAuthenticationError({
              message: "Failed to authenticate: invalid or expired token",
              cause: String(e.message),
            }),
          ),
        ),
        Effect.catchTag("IdentityProviderError", (e) =>
          Effect.fail(
            new RpcAuthenticationError({
              message: "Failed to authenticate with the identity provider",
              cause: String(e.message),
            }),
          ),
        ),
      );

    /**
     * Mirrors a provider identity into the local user table, links the local id
     * back onto the provider record the first time, and loads its access.
     */
    const toSessionForIdentity = (
      identity: LocalUserIdentity,
      cookie: string | null,
    ): Effect.Effect<UserSession, DbError | IdentityProviderError, Db> =>
      Effect.gen(function* () {
        const localUser = yield* localUserSessions.resolveLocalUser(identity);

        yield* !identity.externalId
          ? identityProvider
              .linkExternalId(identity.id, localUser.id)
              .pipe(Effect.catch(() => Effect.void))
          : Effect.void;

        const access = yield* localUserSessions.loadUserAccess(localUser.id);
        return localUserSessions.toUserSession(localUser, access, cookie, identity.id);
      });

    const authenticateBearerToken = (
      requestHeaders: HttpHeaders.Headers,
    ): Effect.Effect<UserSession, RpcAuthFailure, Db> =>
      mapAuthenticationErrors(
        Effect.gen(function* () {
          const token = yield* extractBearerToken(
            Option.getOrUndefined(HttpHeaders.get(requestHeaders, "authorization")),
          );
          const validated = yield* authTokenVerifier.validateToken(token);

          if (!validated.payload.sub) {
            return yield* Effect.fail(
              new RpcNotAuthenticatedError({
                message: "Invalid token: missing subject",
              }),
            );
          }

          const identity = yield* identityProvider.resolveIdentity(validated);
          return yield* toSessionForIdentity(identity, null);
        }),
      );

    const authenticateSessionCookie = (
      requestHeaders: HttpHeaders.Headers,
    ): Effect.Effect<UserSession, RpcAuthFailure, Db> =>
      mapAuthenticationErrors(
        Effect.gen(function* () {
          const webHeaders = toWebHeaders(requestHeaders);
          const identity = yield* identityProvider.authenticateSessionCookie(webHeaders);

          if (!identity) {
            return yield* Effect.fail(
              new RpcNotAuthenticatedError({
                message: "You are not authenticated",
              }),
            );
          }

          return yield* toSessionForIdentity(identity, webHeaders.get("cookie"));
        }),
      );

    const authorization = Option.getOrUndefined(HttpHeaders.get(headers, "authorization"));

    if (authorization) {
      return yield* authenticateBearerToken(headers);
    }

    if (hasSessionCookieHeader(headers, identityProvider.cookieName)) {
      return yield* authenticateSessionCookie(headers);
    }

    return yield* Effect.fail(
      new RpcNotAuthenticatedError({
        message: "You are not authenticated",
      }),
    );
  });
