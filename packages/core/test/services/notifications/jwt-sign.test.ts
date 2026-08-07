import { Effect, Encoding, Result, Schema } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import { signJwtEs256, signJwtRs256 } from "../../../src/utils/crypto/jwt-sign.ts";

/**
 * Round-trip coverage of the WebCrypto JWT signers used for FCM (RS256) and APNs
 * (ES256): generate a real key pair, sign a JWT with the exported PKCS#8 PEM, and
 * verify the signature with the matching public key. This proves the signing
 * input, base64url encoding, and PEM→DER import are all correct end-to-end.
 */

const bytesToBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes);

/**
 * Copies into a fresh `ArrayBuffer`-backed view so the bytes satisfy WebCrypto's
 * `BufferSource` without an assertion.
 */
const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const decoded = Result.getOrThrow(Encoding.decodeBase64Url(value));
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  bytes.set(decoded);
  return bytes;
};

const derToPem = (der: ArrayBuffer): string => {
  const base64 = Encoding.encodeBase64(new Uint8Array(der));
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
};

const JwtSegment = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const decodeJwtSegment = Schema.decodeUnknownSync(JwtSegment);

const decodeSegment = (segment: string): Record<string, unknown> =>
  decodeJwtSegment(new TextDecoder().decode(base64UrlToBytes(segment)));

describe("signJwtRs256", () => {
  it.effect("produces a JWT the matching RSA public key verifies", () =>
    Effect.gen(function* () {
      const keyPair = yield* Effect.promise(() =>
        crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["sign", "verify"],
        ),
      );
      const der = yield* Effect.promise(() =>
        crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
      );
      const pem = derToPem(der);

      const jwt = yield* signJwtRs256(
        { iss: "svc@project.iam", scope: "fcm", iat: 100, exp: 3700 },
        pem,
      );
      const [headerB64, payloadB64, signatureB64] = jwt.split(".");
      expect(headerB64 && payloadB64 && signatureB64).toBeTruthy();

      expect(decodeSegment(headerB64!)).toMatchObject({ alg: "RS256", typ: "JWT" });
      expect(decodeSegment(payloadB64!)).toMatchObject({ iss: "svc@project.iam", iat: 100 });

      const verified = yield* Effect.promise(() =>
        crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          keyPair.publicKey,
          base64UrlToBytes(signatureB64!),
          new TextEncoder().encode(`${headerB64}.${payloadB64}`),
        ),
      );
      expect(verified).toBe(true);
      void bytesToBase64Url;
    }),
  );

  it.effect("fails with JwtSigningError on a malformed PEM", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(signJwtRs256({ iss: "x" }, "not-a-pem"));
      expect(error._tag).toBe("JwtSigningError");
    }),
  );
});

describe("signJwtEs256", () => {
  it.effect(
    "produces a JWT the matching P-256 public key verifies, with kid in the header",
    () =>
      Effect.gen(function* () {
        const keyPair = yield* Effect.promise(() =>
          crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
            "sign",
            "verify",
          ]),
        );
        const der = yield* Effect.promise(() =>
          crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
        );
        const pem = derToPem(der);

        const jwt = yield* signJwtEs256("KEY123456", { iss: "TEAM123456", iat: 42 }, pem);
        const [headerB64, payloadB64, signatureB64] = jwt.split(".");

        expect(decodeSegment(headerB64!)).toMatchObject({
          alg: "ES256",
          kid: "KEY123456",
          typ: "JWT",
        });
        expect(decodeSegment(payloadB64!)).toMatchObject({ iss: "TEAM123456", iat: 42 });

        const verified = yield* Effect.promise(() =>
          crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            keyPair.publicKey,
            base64UrlToBytes(signatureB64!),
            new TextEncoder().encode(`${headerB64}.${payloadB64}`),
          ),
        );
        expect(verified).toBe(true);
      }),
  );
});
