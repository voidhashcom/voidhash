import { Db } from "@voidhash/db";
import type { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { Workos } from "@voidhash/core/services/auth/Workos";
import {
  AuthMiddleware,
  AuthSession,
} from "@voidhash/rpc";
import * as HttpHeaders from "effect/unstable/http/Headers";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { Effect, Layer, Option, pipe } from "effect";

import { resolveWorkosSession } from "./AuthSessionResolver.ts";
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

/** Builds the shared WorkOS-backed session resolver used by RPC auth adapters. */
export const makeRpcSessionResolver = (authTokenVerifier: AuthTokenVerifier["Service"]) =>
  Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const workosAuth = yield* Workos;
    const db = yield* Db;

    return (headers: HttpHeaders.Headers) =>
      withHttpRequestHeaders(headers).pipe(
        Effect.flatMap((requestHeaders) =>
          resolveWorkosSession(requestHeaders, authTokenVerifier).pipe(
            Effect.provideService(Db)(db),
            Effect.provideService(Workos)(workosAuth),
            Effect.provideService(LocalUserSessionService)(localUserSessions),
          ),
        ),
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
            withIdentity(session, Effect.provideService(effect, AuthSession, session)),
          ),
        ),
      );
    }),
  );
