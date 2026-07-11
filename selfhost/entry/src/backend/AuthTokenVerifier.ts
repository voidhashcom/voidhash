import {
  AuthTokenVerifier,
  JwtAuthError,
  JwtAuthPayloadSchema,
  type ValidatedJwt,
} from "@voidhash/core/services/auth/AuthTokenVerifier";
import { Workos } from "@voidhash/core/services/auth/Workos";
import { Effect, Layer, Schema } from "effect";
import { createRemoteJWKSet, jwtVerify } from "jose";

const decodePayload = Schema.decodeUnknownEffect(JwtAuthPayloadSchema);

/** WorkOS JWT verifier using jose's process-local remote JWKS cache. */
export const WorkosAuthTokenVerifierLive: Layer.Layer<AuthTokenVerifier, never, Workos> =
  Layer.effect(
    AuthTokenVerifier,
    Effect.gen(function* () {
      const workos = yield* Workos;
      const jwks = createRemoteJWKSet(new URL(workos.getJwksUrl()), {
        cooldownDuration: 30_000,
        cacheMaxAge: 5 * 60_000,
      });
      return AuthTokenVerifier.of({
        validateToken: (token) =>
          Effect.tryPromise({
            try: () => jwtVerify(token, jwks),
            catch: (cause) =>
              new JwtAuthError({
                cause,
                detail: cause instanceof Error ? cause.message : String(cause),
                message: "JWT validation failed",
              }),
          }).pipe(
            Effect.flatMap(({ payload }) =>
              decodePayload(payload).pipe(
                Effect.mapError(
                  (cause) =>
                    new JwtAuthError({
                      cause,
                      detail: String(cause),
                      message: "JWT claims are invalid",
                    }),
                ),
              ),
            ),
            Effect.map(
              (payload): ValidatedJwt => ({
                payload,
                provider: "workos",
              }),
            ),
          ),
      });
    }),
  );
