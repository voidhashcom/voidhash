import { Clock, Effect } from "effect";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { describe, expect, it } from "vite-plus/test";

import {
  GooglePubSubPushVerificationError,
  makeGooglePubSubPushVerifier,
  type GooglePubSubPushVerifierShape,
} from "./GooglePubSubPushVerifier.ts";

const audience = "https://api.example.test/google-pubsub";
const serviceAccountEmail = "pubsub-push@example-project.iam.gserviceaccount.com";

interface Fixture {
  readonly privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  readonly verifier: GooglePubSubPushVerifierShape;
}

/**
 * The signing key pair and the verifier bound to it, generated once and shared
 * by every test (`Effect.cached` memoizes the first run).
 */
const fixture: Effect.Effect<Fixture> = Effect.runSync(
  Effect.cached(
    Effect.gen(function* () {
      const keyPair = yield* Effect.promise(() => generateKeyPair("RS256", { extractable: true }));
      const publicJwk = yield* Effect.promise(() => exportJWK(keyPair.publicKey));
      publicJwk.alg = "RS256";
      publicJwk.kid = "test-key";
      publicJwk.use = "sig";
      return {
        privateKey: keyPair.privateKey,
        verifier: makeGooglePubSubPushVerifier({
          audience,
          jwks: createLocalJWKSet({ keys: [publicJwk] }),
          serviceAccountEmail,
        }),
      };
    }),
  ),
);

const token = (claims: Partial<JWTPayload> & { email?: string; email_verified?: boolean } = {}) =>
  Effect.gen(function* () {
    const { privateKey } = yield* fixture;
    const millis = yield* Clock.currentTimeMillis;
    const now = Math.floor(millis / 1000);
    return yield* Effect.promise(() =>
      new SignJWT({
        email: serviceAccountEmail,
        email_verified: true,
        ...claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
        .setIssuer(claims.iss ?? "https://accounts.google.com")
        .setAudience(claims.aud ?? audience)
        .setSubject(claims.sub ?? "1234567890")
        .setIssuedAt(claims.iat ?? now)
        .setExpirationTime(claims.exp ?? now + 300)
        .sign(privateKey),
    );
  });

const expectUnauthorized = (authorizationHeader: string | undefined) =>
  Effect.gen(function* () {
    const { verifier } = yield* fixture;
    const error = yield* Effect.flip(verifier.verify(authorizationHeader));
    expect(error).toBeInstanceOf(GooglePubSubPushVerificationError);
    expect(error.kind).toBe("unauthorized");
  });

/** Flips the first character of a signature segment, invalidating it. */
const tamperSignature = (signature: string | undefined) => {
  if (signature?.startsWith("a") === true) return `b${signature.slice(1)}`;
  return `a${signature?.slice(1)}`;
};

describe("GooglePubSubPushVerifier", () => {
  it("accepts a Google-signed token bound to the configured audience and service account", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { verifier } = yield* fixture;
        const signed = yield* token();
        const accepted = yield* verifier.verify(`Bearer ${signed}`);
        expect(accepted).toBeUndefined();
      }),
    ));

  it("rejects a missing or malformed bearer token", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* expectUnauthorized(undefined);
        yield* expectUnauthorized("Basic credentials");
        yield* expectUnauthorized("Bearer token with spaces");
      }),
    ));

  it("rejects a token for a different audience", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const signed = yield* token({ aud: "https://wrong.example.test" });
        yield* expectUnauthorized(`Bearer ${signed}`);
      }),
    ));

  it("rejects a token with a tampered signature", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const signedToken = yield* token();
        const [header, payload, signature] = signedToken.split(".");
        const tamperedToken = `${header}.${payload}.${tamperSignature(signature)}`;
        yield* expectUnauthorized(`Bearer ${tamperedToken}`);
      }),
    ));

  it("rejects a token from a different issuer", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const signed = yield* token({ iss: "https://issuer.example.test" });
        yield* expectUnauthorized(`Bearer ${signed}`);
      }),
    ));

  it("rejects a token for a different or unverified service account", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const otherAccount = yield* token({ email: "attacker@example.test" });
        yield* expectUnauthorized(`Bearer ${otherAccount}`);
        const unverified = yield* token({ email_verified: false });
        yield* expectUnauthorized(`Bearer ${unverified}`);
      }),
    ));

  it("rejects an expired token", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const millis = yield* Clock.currentTimeMillis;
        const now = Math.floor(millis / 1000);
        const expired = yield* token({ exp: now - 1, iat: now - 600 });
        yield* expectUnauthorized(`Bearer ${expired}`);
      }),
    ));

  it("fails closed when authenticated push settings are absent", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const unconfigured = makeGooglePubSubPushVerifier({
          audience: "",
          jwks: createLocalJWKSet({ keys: [] }),
          serviceAccountEmail: "",
        });
        const signed = yield* token();
        const error = yield* Effect.flip(unconfigured.verify(`Bearer ${signed}`));
        expect(error.kind).toBe("misconfigured");
      }),
    ));
});
