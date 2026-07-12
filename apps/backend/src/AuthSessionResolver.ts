import { type DbError } from "@voidhash/db";
import {
  type AuthTokenVerifier,
  extractBearerToken,
  type JwtAuthError,
} from "@voidhash/core/services/auth/AuthTokenVerifier";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { Workos, WorkosAuthError } from "@voidhash/core/services/auth/Workos";
import {
  RpcAuthenticationError,
  RpcNotAuthenticatedError,
  type UserSession,
} from "@voidhash/rpc";
import type { Db } from "@voidhash/db";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { Effect, Option } from "effect";

/** Union of the terminal failures the WorkOS session resolution can raise. */
export type RpcAuthFailure = RpcAuthenticationError | RpcNotAuthenticatedError;

const toWebHeaders = (headers: HttpHeaders.Headers): Headers =>
  new Headers(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

const hasWorkosSessionCookieEffectHeader = (headers: HttpHeaders.Headers): boolean =>
  Option.exists(HttpHeaders.get(headers, "cookie"), (cookie) => cookie.includes("wos-session="));

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
 *   validated through {@link AuthTokenVerifier}, then
 *   the identity is materialised into a local user session.
 * - Otherwise a `wos-session=` cookie → WorkOS session-cookie path.
 * - Neither present → {@link RpcNotAuthenticatedError}.
 *
 * Failures from Db / WorkOS / JWT validation are normalised to
 * {@link RpcAuthenticationError} / {@link RpcNotAuthenticatedError}. This is a
 * behaviour-preserving extraction; the caller supplies `Db` (and the ambient
 * {@link Workos} / {@link LocalUserSessionService}).
 */
export const resolveWorkosSession = (
  headers: HttpHeaders.Headers,
  authTokenVerifier: AuthTokenVerifier["Service"],
): Effect.Effect<UserSession, RpcAuthFailure, Db | Workos | LocalUserSessionService> =>
  Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const workosAuth = yield* Workos;

    const mapAuthenticationErrors = <A>(
      effect: Effect.Effect<
        A,
        DbError | JwtAuthError | RpcNotAuthenticatedError | WorkosAuthError,
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
        Effect.catchTag("WorkosAuthError", (e) =>
          Effect.fail(
            new RpcAuthenticationError({
              message: "Failed to authenticate with WorkOS",
              cause: String(e.message),
            }),
          ),
        ),
      );

    const authenticateWorkosIdentity = (
      workosUserId: string,
      cookie: string | null,
    ): Effect.Effect<UserSession, DbError | WorkosAuthError, Db> =>
      Effect.gen(function* () {
        const workosUser = yield* workosAuth.getUser(workosUserId);
        const localUser = yield* localUserSessions.resolveLocalUser(workosUser);

        yield* !workosUser.externalId
          ? workosAuth
              .setUserExternalId(workosUser.id, localUser.id)
              .pipe(Effect.catch(() => Effect.void))
          : Effect.void;

        const access = yield* localUserSessions.loadUserAccess(localUser.id);
        return localUserSessions.toUserSession(localUser, access, cookie, workosUser.id);
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

          return yield* authenticateWorkosIdentity(validated.payload.sub, null);
        }),
      );

    const authenticateWorkosSession = (
      requestHeaders: HttpHeaders.Headers,
    ): Effect.Effect<UserSession, RpcAuthFailure, Db> =>
      mapAuthenticationErrors(
        Effect.gen(function* () {
          const webHeaders = toWebHeaders(requestHeaders);
          const session = yield* workosAuth.authenticateSessionCookie(webHeaders);

          if (!session) {
            return yield* Effect.fail(
              new RpcNotAuthenticatedError({
                message: "You are not authenticated",
              }),
            );
          }

          const localUser = yield* localUserSessions.resolveLocalUser(session.user);
          yield* !session.user.externalId
            ? workosAuth
                .setUserExternalId(session.user.id, localUser.id)
                .pipe(Effect.catch(() => Effect.void))
            : Effect.void;

          const access = yield* localUserSessions.loadUserAccess(localUser.id);
          return localUserSessions.toUserSession(
            localUser,
            access,
            webHeaders.get("cookie"),
            session.user.id,
          );
        }),
      );

    const authorization = Option.getOrUndefined(HttpHeaders.get(headers, "authorization"));

    if (authorization) {
      return yield* authenticateBearerToken(headers);
    }

    if (hasWorkosSessionCookieEffectHeader(headers)) {
      return yield* authenticateWorkosSession(headers);
    }

    return yield* Effect.fail(
      new RpcNotAuthenticatedError({
        message: "You are not authenticated",
      }),
    );
  });
