import { Db } from "@voidhash/db";
import { ApiKeyService } from "@voidhash/core/services/apiKeys/ApiKeyService";
import { RequestEnvironmentMode, resolveRequestEnvironmentMode } from "@voidhash/core-v2";
import type { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { IdentityProvider } from "@voidhash/core/services/auth/IdentityProvider";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import {
  AuthMiddleware,
  AuthSession,
  RpcAuthenticationError,
  RpcNotAuthenticatedError,
} from "@voidhash/rpc";
import * as HttpHeaders from "effect/unstable/http/Headers";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { Effect, Layer, Option, pipe } from "effect";

import { mapAuthenticationDbError, resolveUserSession } from "./AuthSessionResolver.ts";
import { withIdentity } from "./Telemetry.ts";

const withHttpRequestHeaders = (headers: HttpHeaders.Headers): Effect.Effect<HttpHeaders.Headers> =>
  Effect.serviceOption(HttpServerRequest.HttpServerRequest).pipe(
    Effect.map(
      Option.match({
        onNone: () => headers,
        onSome: (request) => HttpHeaders.merge(headers, HttpHeaders.fromInput(request.headers)),
      }),
    ),
  );

/** Builds the shared session resolver used by RPC auth adapters. */
export const makeRpcSessionResolver = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Effect.gen(function* () {
    const apiKeyService = yield* ApiKeyService;
    const localUserSessions = yield* LocalUserSessionService;
    const identityProvider = yield* IdentityProvider;
    const db = yield* Db;

    const authenticateApiKey = (rawApiKey: string) =>
      Effect.gen(function* () {
        const record = yield* apiKeyService.validateUserApiKey(rawApiKey);
        const access = yield* localUserSessions.loadUserAccess(record.user.id);
        return localUserSessions.toUserSession(record.user, access, null, null);
      }).pipe(
        Effect.catchTags({
          ApiKeyNotFoundError: () =>
            Effect.fail(new RpcNotAuthenticatedError({ message: "You are not authenticated" })),
          ApiKeyServiceError: (error) =>
            Effect.fail(
              new RpcAuthenticationError({
                cause: error.cause,
                message: "Failed to authenticate with api key",
              }),
            ),
          EffectDrizzleQueryError: mapAuthenticationDbError,
        }),
        Effect.provideService(Db)(db),
      );

    return (headers: HttpHeaders.Headers) =>
      withHttpRequestHeaders(headers).pipe(
        Effect.flatMap((requestHeaders) => {
          const rawApiKey = Option.getOrUndefined(HttpHeaders.get(requestHeaders, "x-api-key"));
          if (rawApiKey) return authenticateApiKey(rawApiKey);

          return resolveUserSession(requestHeaders, authTokenVerifier).pipe(
            Effect.provideService(Db)(db),
            Effect.provideService(IdentityProvider)(identityProvider),
            Effect.provideService(LocalUserSessionService)(localUserSessions),
          );
        }),
      );
  });

/** Builds RPC authentication against an injected token-verification port. */
export const RpcAuthLive = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
      const resolveSession = yield* makeRpcSessionResolver(authTokenVerifier);

      return AuthMiddleware.of((effect, { headers }) =>
        pipe(
          resolveSession(headers),
          Effect.flatMap((session) =>
            withHttpRequestHeaders(headers).pipe(
              Effect.flatMap((requestHeaders) =>
                withIdentity(
                  session,
                  Effect.provideService(effect, AuthSession, session).pipe(
                    Effect.provideService(
                      RequestEnvironmentMode,
                      resolveRequestEnvironmentMode(
                        Option.getOrUndefined(HttpHeaders.get(requestHeaders, "x-environment")),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }),
  );
