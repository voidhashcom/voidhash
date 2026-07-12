/**
 * Asymmetric JWT signing for outbound push-provider authentication, using
 * WebCrypto only (no Node `crypto`/`Buffer`) so it runs unchanged on Cloudflare
 * Workers — the same constraint as {@link SecretBox}.
 *
 * Two algorithms are supported, one per push provider:
 *  - **RS256** (`RSASSA-PKCS1-v1_5` + SHA-256): the Google service-account JWT
 *    used to obtain an FCM OAuth2 access token. Key = the `private_key` PEM from
 *    the service-account JSON.
 *  - **ES256** (`ECDSA` P-256 + SHA-256): the APNs provider-authentication JWT.
 *    Key = the `.p8` PEM downloaded from the Apple developer portal. WebCrypto's
 *    ECDSA signature output is already the raw `r‖s` concatenation JOSE expects,
 *    so no DER-unwrapping is needed.
 *
 * Both take a PKCS#8 PEM private key. Callers pass the DECRYPTED key material —
 * decryption happens upstream (the provider adapter owns its secret seam).
 */
import { Effect, Schema } from "effect";

/** Raised when JWT construction or signing fails (bad key, WebCrypto error). */
export class JwtSigningError extends Schema.TaggedErrorClass<JwtSigningError>("JwtSigningError")(
  "JwtSigningError",
  { message: Schema.String },
) {}

const encoder = new TextEncoder();

/** URL-safe base64 without padding — the JOSE `base64url` alphabet. */
const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const stringToBase64Url = (value: string): string => bytesToBase64Url(encoder.encode(value));

/**
 * Decode a PEM-wrapped PKCS#8 private key into its DER bytes. Tolerant of `\n`
 * or `\r\n` line endings and of a key handed in with the armor already stripped.
 */
const pemToDer = (pem: string): Effect.Effect<Uint8Array, JwtSigningError> =>
  Effect.try({
    try: () => {
      const body = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");
      if (body.length === 0) {
        throw new Error("empty PEM body");
      }
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },
    catch: (cause) => new JwtSigningError({ message: `invalid PKCS#8 PEM: ${String(cause)}` }),
  });

/** JWT header fields common to both algorithms (`kid` is APNs-only). */
export interface JwtHeader {
  readonly alg: "RS256" | "ES256";
  readonly typ?: "JWT";
  readonly kid?: string;
}

const signWith = (
  algorithm: "RS256" | "ES256",
  importAlgorithm: RsaHashedImportParams | EcKeyImportParams,
  signAlgorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
  header: JwtHeader,
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Effect.Effect<string, JwtSigningError> =>
  Effect.gen(function* () {
    const der = yield* pemToDer(privateKeyPem);
    const key = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.importKey("pkcs8", der as BufferSource, importAlgorithm, false, ["sign"]),
      catch: (cause) =>
        new JwtSigningError({ message: `failed to import ${algorithm} key: ${String(cause)}` }),
    });
    const signingInput = `${stringToBase64Url(JSON.stringify({ typ: "JWT", ...header }))}.${stringToBase64Url(
      JSON.stringify(claims),
    )}`;
    const signature = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.sign(signAlgorithm, key, encoder.encode(signingInput) as BufferSource),
      catch: (cause) =>
        new JwtSigningError({ message: `${algorithm} signing failed: ${String(cause)}` }),
    });
    return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
  });

/**
 * Sign a compact JWT with RS256 (Google service-account credentials). `claims`
 * is the payload object (`iss`/`scope`/`aud`/`iat`/`exp`).
 */
export const signJwtRs256 = (
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Effect.Effect<string, JwtSigningError> =>
  signWith(
    "RS256",
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    "RSASSA-PKCS1-v1_5",
    { alg: "RS256" },
    claims,
    privateKeyPem,
  );

/**
 * Sign a compact JWT with ES256 (APNs provider authentication token). `keyId`
 * becomes the header `kid`; `claims` carries `iss` (team id) and `iat`.
 */
export const signJwtEs256 = (
  keyId: string,
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Effect.Effect<string, JwtSigningError> =>
  signWith(
    "ES256",
    { name: "ECDSA", namedCurve: "P-256" },
    { name: "ECDSA", hash: "SHA-256" },
    { alg: "ES256", kid: keyId },
    claims,
    privateKeyPem,
  );
