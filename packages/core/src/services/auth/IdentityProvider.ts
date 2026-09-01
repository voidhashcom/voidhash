import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import type { ValidatedJwt } from "./AuthTokenVerifier.ts";

/**
 * Catch-all error for {@link IdentityProvider} operations. Adapters wrap any
 * provider-specific failure into this single tag so the authentication catch
 * boundaries stay small.
 */
export class IdentityProviderError extends Schema.TaggedErrorClass<IdentityProviderError>(
  "IdentityProviderError",
)("IdentityProviderError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface IdentityProviderShape {
  /**
   * Name of the session cookie this provider issues. Request middlewares use it
   * to detect a session-cookie request before attempting to authenticate one.
   */
  readonly cookieName: string;

  /**
   * Authenticates the provider's session cookie carried by `headers`. Resolves
   * to `Option.none()` when no valid session is present, which callers treat as
   * "not authenticated" rather than as a failure.
   */
  readonly authenticateSessionCookie: (
    headers: Headers,
  ) => Effect.Effect<Option.Option<LocalUserIdentity>, IdentityProviderError>;

  /**
   * Resolves a verified bearer token into a full identity. The WorkOS adapter
   * re-fetches the user so profile changes land immediately; the local adapter
   * builds the identity from the token claims alone.
   */
  readonly resolveIdentity: (
    validated: ValidatedJwt,
  ) => Effect.Effect<LocalUserIdentity, IdentityProviderError>;

  /**
   * Resolves an identity from a provider user id alone, for callers that
   * authenticated through a different token pipeline and hold only the subject
   * (the MCP AuthKit OAuth path).
   */
  readonly resolveIdentityById: (
    providerUserId: string,
  ) => Effect.Effect<LocalUserIdentity, IdentityProviderError>;

  /**
   * Records the local user id on the provider's identity record so later
   * lookups can map back without an email match. Providers that have nowhere to
   * store it may implement this as a no-op.
   */
  readonly linkExternalId: (
    providerUserId: string,
    localUserId: string,
  ) => Effect.Effect<void, IdentityProviderError>;
}

/**
 * Provider-agnostic port for request authentication. The live adapter (WorkOS
 * or the local development provider) is wired by the application root, keeping
 * session resolution provider-neutral and trivially fakeable in tests.
 */
export class IdentityProvider extends Context.Service<IdentityProvider, IdentityProviderShape>()(
  "@voidhash/core/IdentityProvider",
) {}
