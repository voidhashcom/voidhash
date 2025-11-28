/**
 * Authentication service for Yjs WebSocket connections.
 * Provides an abstract interface for auth that can be implemented
 * with different backends (JWT, OAuth, custom, etc.)
 *
 * @since 1.0.0
 */
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

// --- Error Types ---

/**
 * Auth error types
 *
 * @since 1.0.0
 */
export type AuthErrorReason =
  | 'InvalidToken'
  | 'ExpiredToken'
  | 'Unauthorized'
  | 'PermissionDenied';

/**
 * Authentication error
 *
 * @since 1.0.0
 */
export class AuthError extends Data.TaggedError('AuthError')<{
  readonly reason: AuthErrorReason;
  readonly message: string;
}> {}

// --- Permission Types ---

/**
 * Access level for a room
 *
 * @since 1.0.0
 */
export type AccessLevel = 'none' | 'read' | 'readwrite';

/**
 * Result of checking permissions
 *
 * @since 1.0.0
 */
export interface Permission {
  readonly room: string;
  readonly userid: string;
  readonly access: AccessLevel;
}

/**
 * Simplified permission result for handlers
 *
 * @since 1.0.0
 */
export interface AuthResult {
  readonly hasWriteAccess: boolean;
  readonly userid: string;
  readonly room: string;
}

// --- Auth Service Interface ---

/**
 * Auth service interface for authenticating connections
 *
 * @since 1.0.0
 */
export interface Auth {
  /**
   * Authenticate a connection request and check permissions.
   * The token is typically extracted from WebSocket protocols or query params.
   */
  readonly authenticate: (
    room: string,
    token: string
  ) => Effect.Effect<AuthResult, AuthError>;

  /**
   * Check if a user has permission to access a room.
   * Used for more granular permission checks.
   */
  readonly checkPermission: (
    room: string,
    userid: string
  ) => Effect.Effect<Permission, AuthError>;
}

/**
 * Auth service tag.
 *
 * @since 1.0.0
 */
export class AuthService extends Context.Tag('@yjs-effect/Auth')<
  AuthService,
  Auth
>() {}

// --- Allow All Auth Implementation ---

/**
 * Create an auth implementation that allows all connections.
 * Useful for development and testing.
 *
 * @since 1.0.0
 */
export const makeAllowAllAuth = Effect.succeed({
  authenticate: (room, token) =>
    Effect.succeed({
      hasWriteAccess: true,
      userid: token || 'anonymous',
      room
    }),

  checkPermission: (room, userid) =>
    Effect.succeed({
      room,
      userid,
      access: 'readwrite' as const
    })
} satisfies Auth);

/**
 * Layer that allows all connections without authentication.
 *
 * @since 1.0.0
 */
export const AllowAllAuthLive: Layer.Layer<AuthService> = Layer.effect(
  AuthService,
  makeAllowAllAuth
);

// --- Custom Auth Factory ---

/**
 * Configuration for custom auth
 *
 * @since 1.0.0
 */
export interface CustomAuthConfig {
  readonly authenticate: (
    room: string,
    token: string
  ) => Effect.Effect<AuthResult, AuthError>;

  readonly checkPermission?: (
    room: string,
    userid: string
  ) => Effect.Effect<Permission, AuthError>;
}

/**
 * Create an auth layer from custom configuration.
 *
 * @example
 * ```typescript
 * const MyAuthLive = makeCustomAuth({
 *   authenticate: (room, token) =>
 *     Effect.gen(function* () {
 *       const decoded = yield* decodeJwt(token)
 *       return {
 *         hasWriteAccess: decoded.role === 'editor',
 *         userid: decoded.sub,
 *         room
 *       }
 *     })
 * })
 * ```
 *
 * @since 1.0.0
 */
export const makeCustomAuth = (
  config: CustomAuthConfig
): Layer.Layer<AuthService> =>
  Layer.succeed(AuthService, {
    authenticate: config.authenticate,
    checkPermission:
      config.checkPermission ??
      ((room, userid) =>
        Effect.succeed({
          room,
          userid,
          access: 'readwrite' as const
        }))
  });

// --- Token Parsing Utilities ---

/**
 * Extract auth token from WebSocket protocol header.
 * y-websocket uses format: "yauth-{token}"
 *
 * @since 1.0.0
 */
const YAUTH_REXEX = /(^|,)yauth-(((?!,).)*)/;
export const extractTokenFromProtocol = (
  protocolHeader: string
): string | null => {
  const match = YAUTH_REXEX.exec(protocolHeader);
  return match?.[2] ?? null;
};

/**
 * Extract auth token from query string.
 * Looks for "yauth" parameter.
 *
 * @since 1.0.0
 */
export const extractTokenFromQuery = (queryString: string): string | null => {
  const params = new URLSearchParams(queryString);
  return params.get('yauth');
};

/**
 * Extract auth token from either protocol or query.
 *
 * @since 1.0.0
 */
export const extractToken = (
  protocolHeader: string | undefined,
  queryString: string | undefined
): Effect.Effect<string, AuthError> => {
  const fromProtocol = protocolHeader
    ? extractTokenFromProtocol(protocolHeader)
    : null;
  const fromQuery = queryString ? extractTokenFromQuery(queryString) : null;

  const token = fromProtocol ?? fromQuery;

  if (!token) {
    return Effect.fail(
      new AuthError({
        reason: 'InvalidToken',
        message: 'No auth token provided'
      })
    );
  }

  return Effect.succeed(token);
};
