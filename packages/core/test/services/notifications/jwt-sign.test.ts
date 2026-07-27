import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { signJwtEs256, signJwtRs256 } from "../../../src/utils/crypto/jwt-sign.ts";

/**
 * Round-trip coverage of the WebCrypto JWT signers used for FCM (RS256) and APNs
 * (ES256): generate a real key pair, sign a JWT with the exported PKCS#8 PEM, and
 * verify the signature with the matching public key. This proves the signing
 * input, base64url encoding, and PEM→DER import are all correct end-to-end.
 */

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const derToPem = (der: ArrayBuffer): string => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
};

const decodeSegment = (segment: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));

describe("signJwtRs256", () => {
  it("produces a JWT the matching RSA public key verifies", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const pem = derToPem(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

    const jwt = await Effect.runPromise(
      signJwtRs256({ iss: "svc@project.iam", scope: "fcm", iat: 100, exp: 3700 }, pem),
    );
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");
    expect(headerB64 && payloadB64 && signatureB64).toBeTruthy();

    expect(decodeSegment(headerB64!)).toMatchObject({ alg: "RS256", typ: "JWT" });
    expect(decodeSegment(payloadB64!)).toMatchObject({ iss: "svc@project.iam", iat: 100 });

    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      keyPair.publicKey,
      base64UrlToBytes(signatureB64!) as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource,
    );
    expect(verified).toBe(true);
    void bytesToBase64Url;
  });

  it("fails with JwtSigningError on a malformed PEM", async () => {
    const error = await Effect.runPromise(
      signJwtRs256({ iss: "x" }, "not-a-pem").pipe(Effect.flip),
    );
    expect(error._tag).toBe("JwtSigningError");
  });
});

describe("signJwtEs256", () => {
  it("produces a JWT the matching P-256 public key verifies, with kid in the header", async () => {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const pem = derToPem(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

    const jwt = await Effect.runPromise(
      signJwtEs256("KEY123456", { iss: "TEAM123456", iat: 42 }, pem),
    );
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");

    expect(decodeSegment(headerB64!)).toMatchObject({ alg: "ES256", kid: "KEY123456", typ: "JWT" });
    expect(decodeSegment(payloadB64!)).toMatchObject({ iss: "TEAM123456", iat: 42 });

    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      base64UrlToBytes(signatureB64!) as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource,
    );
    expect(verified).toBe(true);
  });
});
