import { Effect } from "effect";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import {
  GooglePubSubPushVerificationError,
  makeGooglePubSubPushVerifier,
  type GooglePubSubPushVerifierShape,
} from "./GooglePubSubPushVerifier.ts";

const audience = "https://api.example.test/google-pubsub";
const serviceAccountEmail = "pubsub-push@example-project.iam.gserviceaccount.com";

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let verifier: GooglePubSubPushVerifierShape;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256", { extractable: true });
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.alg = "RS256";
  publicJwk.kid = "test-key";
  publicJwk.use = "sig";
  verifier = makeGooglePubSubPushVerifier({
    audience,
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
    serviceAccountEmail,
  });
});

const token = (claims: Partial<JWTPayload> & { email?: string; email_verified?: boolean } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
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
    .sign(privateKey);
};

const expectUnauthorized = async (authorizationHeader: string | undefined) => {
  const error = await Effect.runPromise(verifier.verify(authorizationHeader).pipe(Effect.flip));
  expect(error).toBeInstanceOf(GooglePubSubPushVerificationError);
  expect(error.kind).toBe("unauthorized");
};

describe("GooglePubSubPushVerifier", () => {
  it("accepts a Google-signed token bound to the configured audience and service account", async () => {
    await expect(
      Effect.runPromise(verifier.verify(`Bearer ${await token()}`)),
    ).resolves.toBeUndefined();
  });

  it("rejects a missing or malformed bearer token", async () => {
    await expectUnauthorized(undefined);
    await expectUnauthorized("Basic credentials");
    await expectUnauthorized("Bearer token with spaces");
  });

  it("rejects a token for a different audience", async () => {
    await expectUnauthorized(`Bearer ${await token({ aud: "https://wrong.example.test" })}`);
  });

  it("rejects a token with a tampered signature", async () => {
    const signedToken = await token();
    const [header, payload, signature] = signedToken.split(".");
    const tamperedSignature = `${signature?.startsWith("a") ? "b" : "a"}${signature?.slice(1)}`;
    const tamperedToken = `${header}.${payload}.${tamperedSignature}`;
    await expectUnauthorized(`Bearer ${tamperedToken}`);
  });

  it("rejects a token from a different issuer", async () => {
    await expectUnauthorized(`Bearer ${await token({ iss: "https://issuer.example.test" })}`);
  });

  it("rejects a token for a different or unverified service account", async () => {
    await expectUnauthorized(`Bearer ${await token({ email: "attacker@example.test" })}`);
    await expectUnauthorized(`Bearer ${await token({ email_verified: false })}`);
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectUnauthorized(`Bearer ${await token({ exp: now - 1, iat: now - 600 })}`);
  });

  it("fails closed when authenticated push settings are absent", async () => {
    const unconfigured = makeGooglePubSubPushVerifier({
      audience: "",
      jwks: createLocalJWKSet({ keys: [] }),
      serviceAccountEmail: "",
    });
    const error = await Effect.runPromise(
      unconfigured.verify(`Bearer ${await token()}`).pipe(Effect.flip),
    );
    expect(error.kind).toBe("misconfigured");
  });
});
