import {
  ApiAuthSession,
  AuthMiddleware,
  type ApiPublishableKeySession,
  type ApiSecretKeySession,
  type ApiUserSession,
} from "@voidhash/api-contracts";
import { ApiAuthenticationError, ApiNotAuthenticatedError } from "@voidhash/api-contracts/errors";
import { ApiKeyService } from "@voidhash/core/services";
import {
  RequestEnvironmentMode,
  resolveRequestEnvironmentMode,
} from "@voidhash/core/services/requestEnvironment/RequestEnvironmentMode";
import { IdentityProvider } from "@voidhash/core/services/auth/IdentityProvider";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { IdentityLinkBackfillService } from "@voidhash/core/services/auth/IdentityLinkBackfillService";
import { AuthSession } from "@voidhash/rpc";
import { Db, type DbError } from "@voidhash/db";
import { Config, Effect, Layer, Option, pipe } from "effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { HttpServerRequest } from "effect/unstable/http";

import { withIdentity } from "./Telemetry.ts";

type AuthMiddlewareError = ApiAuthenticationError | ApiNotAuthenticatedError;
type AuthMiddlewareSession = ApiUserSession | ApiSecretKeySession | ApiPublishableKeySession;

type SelectedAuthMethod =
  | { method: "api-key"; rawApiKey: string }
  | { method: "secret-key"; rawSecretKey: string }
  | { method: "user-session"; headers: Headers }
  | { method: "publishable-key"; rawPublishableKey: string; distinctId: string };

const publishableKeyInvalidMessage = "Publishable Key not found, is expired or is invalid.";

const hasSessionCookieHeader = (headers: Headers, cookieName: string): boolean =>
  headers.get("cookie")?.includes(`${cookieName}=`) ?? false;

const toWebHeaders = (headers: HttpHeaders.Headers): Headers =>
  new Headers(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

const selectAuthMethod = (
  req: HttpServerRequest.HttpServerRequest,
  sessionCookieName: string,
): Effect.Effect<SelectedAuthMethod, AuthMiddlewareError> =>
  Effect.gen(function* () {
    const rawApiKey = Option.getOrUndefined(HttpHeaders.get(req.headers, "x-api-key"));
    if (rawApiKey) {
      return { method: "api-key", rawApiKey } satisfies SelectedAuthMethod;
    }

    const webHeaders = toWebHeaders(req.headers);
    if (hasSessionCookieHeader(webHeaders, sessionCookieName)) {
      return { headers: webHeaders, method: "user-session" } satisfies SelectedAuthMethod;
    }

    const rawSecretKey = Option.getOrUndefined(HttpHeaders.get(req.headers, "x-secret-key"));
    if (rawSecretKey) {
      return { method: "secret-key", rawSecretKey } satisfies SelectedAuthMethod;
    }

    const rawPublishableKey = Option.getOrUndefined(
      HttpHeaders.get(req.headers, "x-publishable-key"),
    );
    if (rawPublishableKey) {
      const distinctId = Option.getOrUndefined(HttpHeaders.get(req.headers, "x-distinct-id"));
      if (!distinctId) {
        return yield* Effect.fail(
          new ApiAuthenticationError({
            cause: "Missing distinct-id header",
            message: "Missing distinct-id header",
          }),
        );
      }
      return {
        distinctId,
        method: "publishable-key",
        rawPublishableKey,
      } satisfies SelectedAuthMethod;
    }

    return yield* Effect.fail(
      new ApiNotAuthenticatedError({ message: "You are not authenticated" }),
    );
  });

const mapDatabaseError = (e: DbError) =>
  new ApiAuthenticationError({
    cause: String(e.message),
    message: "Failed to authenticate due to an internal error",
  });

/**
 * HTTP API authentication middleware. Resolves an `ApiAuthSession` from one of
 * `x-api-key`, `x-secret-key`, `x-publishable-key` + `x-distinct-id`, or the
 * active {@link IdentityProvider}'s session cookie, matching the legacy parity
 * surface. Failures collapse onto `ApiNotAuthenticatedError` /
 * `ApiAuthenticationError`.
 */
export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const apiKeyService = yield* ApiKeyService;
    const localUserSessions = yield* LocalUserSessionService;
    const workosLocalSync = yield* IdentityLinkBackfillService;
    const identityProvider = yield* IdentityProvider;
    // Capture the per-request `Db` at middleware-layer build and provide it to
    // the auth resolution below. Core service methods now require `Db` ambiently
    // (native effect-postgres), but the middleware handler's requirement channel
    // is sealed by the framework (`Provided`/`Scope` only), so `Db` is supplied
    // here rather than leaking out of the handler.
    const db = yield* Db;
    const appEnv = yield* Config.string("APP_ENV").pipe(Config.withDefault(""), Effect.orDie);
    const shouldBackfillWorkosLocalState = appEnv === "development";

    const authenticateApiKey = (rawApiKey: string) =>
      pipe(
        Effect.gen(function* () {
          const record = yield* apiKeyService.validateUserApiKey(rawApiKey);
          const access = yield* localUserSessions.loadUserAccess(record.user.id);
          return localUserSessions.toUserSession(record.user, access, null, null);
        }),
        Effect.catchTags({
          ApiKeyNotFoundError: () =>
            Effect.fail(new ApiNotAuthenticatedError({ message: "You are not authenticated" })),
          ApiKeyServiceError: (e) =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: e.cause,
                message: "Failed to authenticate with api key due to an internal error",
              }),
            ),
          EffectDrizzleQueryError: (e) => Effect.fail(mapDatabaseError(e)),
        }),
      );

    const authenticateUserSession = (headers: Headers) =>
      pipe(
        Effect.gen(function* () {
          const identity = yield* identityProvider.authenticateSessionCookie(headers);
          if (!identity) {
            return yield* Effect.fail(
              new ApiNotAuthenticatedError({ message: "You are not authenticated" }),
            );
          }

          const resolveUser = () => {
            if (shouldBackfillWorkosLocalState) {
              return workosLocalSync
                .syncAuthenticatedUser(identity)
                .pipe(Effect.map((synced) => synced.localUser));
            }
            return localUserSessions.resolveLocalUser(identity);
          };
          const localUser = yield* resolveUser();
          const access = yield* localUserSessions.loadUserAccess(localUser.id);
          return localUserSessions.toUserSession(
            localUser,
            access,
            headers.get("cookie"),
            identity.id,
          );
        }),
        Effect.catchTags({
          EffectDrizzleQueryError: (e) => Effect.fail(mapDatabaseError(e)),
          IdentityProviderError: (e) =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: String(e.message),
                message: "Failed to authenticate session",
              }),
            ),
          IdentityLinkBackfillError: (e) =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: e.cause,
                message: "Failed to authenticate session",
              }),
            ),
        }),
      );

    const authenticateSecretKey = (rawSecretKey: string) =>
      pipe(
        Effect.gen(function* () {
          const record = yield* apiKeyService.validateSecretKey(rawSecretKey);
          return {
            cookie: null,
            method: "secret-key",
            name: `${record.project.name} API Key`,
            organizations: [],
            person: null,
            projects: [
              {
                id: record.project.id,
                logo: null,
                name: record.project.name,
                organizationId: record.project.organizationId,
                permissions: ["project:all"],
                slug: record.project.slug,
              },
            ],
            user: null,
          } satisfies ApiSecretKeySession;
        }),
        Effect.catchTags({
          ApiKeyNotFoundError: () =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: "Secret Key not found, is expired or is invalid.",
                message: "Secret Key not found, is expired or is invalid.",
              }),
            ),
          ApiKeyServiceError: (e) =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: e.cause,
                message: "Failed to authenticate with secret key due to an internal error",
              }),
            ),
        }),
      );

    const authenticatePublishableKey = (input: { distinctId: string; rawPublishableKey: string }) =>
      pipe(
        Effect.gen(function* () {
          const record = yield* apiKeyService.validatePublishableKey(input.rawPublishableKey);
          return {
            cookie: null,
            method: "publishable-key",
            name: `${record.project.name} API Key`,
            organizations: [],
            person: { distinctId: input.distinctId },
            projects: [
              {
                id: record.project.id,
                logo: null,
                name: record.project.name,
                organizationId: record.project.organizationId,
                permissions: [],
                slug: record.project.slug,
              },
            ],
            user: null,
          } satisfies ApiPublishableKeySession;
        }),
        Effect.catchTags({
          ApiKeyNotFoundError: () =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: publishableKeyInvalidMessage,
                message: publishableKeyInvalidMessage,
              }),
            ),
          ApiKeyServiceError: (e) =>
            Effect.fail(
              new ApiAuthenticationError({
                cause: e.cause,
                message: "Failed to authenticate with publishable key due to an internal error",
              }),
            ),
        }),
      );

    const authenticateSelectedMethod = (
      selected: SelectedAuthMethod,
    ): Effect.Effect<AuthMiddlewareSession, AuthMiddlewareError, Db> => {
      switch (selected.method) {
        case "api-key":
          return authenticateApiKey(selected.rawApiKey);
        case "user-session":
          return authenticateUserSession(selected.headers);
        case "secret-key":
          return authenticateSecretKey(selected.rawSecretKey);
        case "publishable-key":
          return authenticatePublishableKey({
            distinctId: selected.distinctId,
            rawPublishableKey: selected.rawPublishableKey,
          });
      }
    };

    return AuthMiddleware.of((httpEffect) =>
      Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest;
        const environmentMode = resolveRequestEnvironmentMode(
          Option.getOrUndefined(HttpHeaders.get(req.headers, "x-environment")),
        );
        const selected = yield* selectAuthMethod(req, identityProvider.cookieName);
        const session = yield* Effect.provideService(authenticateSelectedMethod(selected), Db, db);
        return yield* withIdentity(
          session,
          Effect.provideService(httpEffect, ApiAuthSession, session).pipe(
            Effect.provideService(RequestEnvironmentMode, environmentMode),
          ),
        );
      }),
    );
  }),
);

/**
 * Bridges {@link ApiAuthSession} into the canonical {@link AuthSession}
 * tag that the core services consume. Use this wrapper around any route
 * handler effect that depends on `AuthSession`.
 */
export const bridgeAuthSession = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const session = yield* ApiAuthSession;
    return yield* Effect.provideService(effect, AuthSession, session);
  });

/**
 * Translates the parsed SDK request headers into the per-call metadata bag the
 * `SdkService` writes onto person traits.
 */
export const getPersonMetadataFromSdkHeaders = (parsedHeaders: {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | undefined;
  readonly "x-client-version"?: string | undefined;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false";
  readonly "x-is-debug-build": "true" | "false";
  readonly "x-nonce"?: string | undefined;
  readonly "x-observer-mode": "true" | "false";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | undefined;
  readonly "x-platform-device"?: string | undefined;
  readonly "x-platform-flavor": "native" | "browser";
  readonly "x-platform-flavor-version"?: string | undefined;
  readonly "x-platform-version"?: string | undefined;
  readonly "x-preferred-locales"?: string | undefined;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "react-native" | "web" | "ios" | "android";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | undefined;
}) => ({
  clientBundleId: parsedHeaders["x-client-bundle-id"],
  clientLocale: parsedHeaders["x-client-locale"],
  clientVersion: parsedHeaders["x-client-version"],
  distinctId: parsedHeaders["x-distinct-id"],
  isBackgrounded: parsedHeaders["x-is-backgrounded"],
  isDebugBuild: parsedHeaders["x-is-debug-build"],
  nonce: parsedHeaders["x-nonce"],
  observerMode: parsedHeaders["x-observer-mode"],
  platform: parsedHeaders["x-platform"],
  platformBrand: parsedHeaders["x-platform-brand"],
  platformDevice: parsedHeaders["x-platform-device"],
  platformFlavor: parsedHeaders["x-platform-flavor"],
  platformFlavorVersion: parsedHeaders["x-platform-flavor-version"],
  platformVersion: parsedHeaders["x-platform-version"],
  preferredLocales: parsedHeaders["x-preferred-locales"],
  publishableKey: parsedHeaders["x-publishable-key"],
  sdk: parsedHeaders["x-sdk"],
  sdkVersion: parsedHeaders["x-sdk-version"],
  storefront: parsedHeaders["x-storefront"],
});
