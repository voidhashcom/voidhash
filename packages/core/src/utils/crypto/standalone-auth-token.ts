/**
 * HS256 session tokens for the standalone identity provider.
 *
 * The same compact JWT is used as both the browser session cookie value and the
 * `Authorization: Bearer` token, so the backend's cookie and bearer paths
 * collapse onto one verifier. Claims deliberately match
 * `JwtAuthPayloadSchema` (`sub`, `email`, `name`, `image`) so the token flows
 * through the existing bearer pipeline unchanged.
 *
 * WebCrypto only (no Node `crypto`/`Buffer`), matching {@link jwt-sign} — the
 * module is imported by the Node self-host runtime and the TanStack Start
 * server routes alike.
 *
 * See `docs/standalone-auth-design.md` for the trust model.
 */
import { Clock, Effect, Encoding, Schema } from "effect";
import { numberOr } from "@voidhash/lib/lang";

import { createHash } from "../../services/apiKeys/create-hash.ts";

/** Raised when a standalone token cannot be signed, parsed, or verified. */
export class StandaloneAuthTokenError extends Schema.TaggedErrorClass<StandaloneAuthTokenError>(
  "StandaloneAuthTokenError",
)("StandaloneAuthTokenError", { message: Schema.String }) {}

/**
 * Signing key used when `VOIDHASH_AUTH_SECRET` is unset. Reachable only in
 * `SELFHOST_MODE=local-evaluation` — production refuses to start without a real
 * secret — and it lets a split-process dev setup (www and backend in separate
 * processes) agree on a key with zero configuration.
 */
export const STANDALONE_AUTH_DEFAULT_SECRET = "voidhash-local-evaluation-auth-secret";

/** Cookie that carries the standalone session token. */
export const STANDALONE_AUTH_COOKIE_NAME = "vh-session";

/**
 * Subject claim for the single root identity.
 *
 * A constant rather than a value derived from the email or username: it lands in
 * `user.workos_user_id`, so keeping it stable means changing
 * `VOIDHASH_ROOT_EMAIL` or `VOIDHASH_ROOT_USERNAME` later updates the existing
 * user row instead of stranding it behind a new identity.
 */
export const STANDALONE_ROOT_SUBJECT = "root";

/** Default session lifetime: long enough that sign-in is a rare event. */
export const STANDALONE_AUTH_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes);

const stringToBase64Url = (value: string): string => bytesToBase64Url(encoder.encode(value));

const importKey = (secret: string) =>
  Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
    catch: (cause) =>
      new StandaloneAuthTokenError({
        message: `failed to import standalone auth key: ${String(cause)}`,
      }),
  });

const signingSignature = (signingInput: string, secret: string) =>
  Effect.gen(function* () {
    const key = yield* importKey(secret);
    const signature = yield* Effect.tryPromise({
      try: () => crypto.subtle.sign("HMAC", key, encoder.encode(signingInput)),
      catch: (cause) =>
        new StandaloneAuthTokenError({
          message: `standalone auth signing failed: ${String(cause)}`,
        }),
    });
    return bytesToBase64Url(new Uint8Array(signature));
  });

/** Length-independent comparison so verification does not leak the signature. */
export const constantTimeEquals = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
};

/** Lowercase hex sha256 over a UTF-8 string (WebCrypto via `uncrypto`, workerd-safe). */
const sha256Hex = (value: string): Effect.Effect<string> =>
  Effect.promise(() => createHash("SHA-256", "hex").digest(value));

/**
 * Compares two secrets without leaking their length or contents through timing.
 *
 * Both sides are hashed first so the constant-time comparison always runs over
 * equal-length inputs — a raw comparison would return early on a length
 * mismatch and leak the expected password's length.
 */
export const secretsMatch = (candidate: string, expected: string): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const candidateHash = yield* sha256Hex(candidate);
    const expectedHash = yield* sha256Hex(expected);
    return constantTimeEquals(candidateHash, expectedHash);
  });

/** Normalizes an email for storage: trimmed, lowercased. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Wire shape of the JWT payload. `Schema.fromJsonString` gives us JSON
 * serialization on the signing side without reaching for `JSON.stringify`.
 */
const StandaloneAuthTokenClaimsJson = Schema.fromJsonString(
  Schema.Struct({
    sub: Schema.String,
    email: Schema.String,
    name: Schema.optional(Schema.String),
    image: Schema.optional(Schema.String),
    iat: Schema.Number,
    exp: Schema.Number,
  }),
);

/** Any JSON object: the payload is validated claim by claim after parsing. */
const JsonObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

/** Fixed HS256 header, written as JSON text so no encoder is needed for it. */
const JWT_HEADER_JSON = '{"alg":"HS256","typ":"JWT"}';

/** Spreadable fragment: the claim when it carries a value, nothing otherwise. */
const optionalClaim = (key: "image" | "name", value: unknown): Record<string, string> => {
  if (typeof value !== "string") return {};
  if (value.length === 0) return {};
  return { [key]: value };
};

export interface StandaloneAuthTokenClaims {
  readonly sub: string;
  readonly email: string;
  readonly name?: string;
  readonly image?: string;
  readonly iat: number;
  readonly exp: number;
}

export interface SignStandaloneAuthTokenInput {
  readonly email: string;
  readonly name?: string | undefined;
  readonly image?: string | undefined;
  readonly secret: string;
  /** Seconds until expiry; defaults to {@link STANDALONE_AUTH_DEFAULT_TTL_SECONDS}. */
  readonly expiresInSeconds?: number;
  /** Issue time in seconds since the epoch; defaults to now. */
  readonly issuedAt?: number;
}

/** Signs a session token for the root identity. */
export const signStandaloneAuthToken = (
  input: SignStandaloneAuthTokenInput,
): Effect.Effect<string, StandaloneAuthTokenError> =>
  Effect.gen(function* () {
    const nowMillis = yield* Clock.currentTimeMillis;
    const issuedAt = input.issuedAt ?? Math.floor(nowMillis / 1000);
    const claims: StandaloneAuthTokenClaims = {
      email: normalizeEmail(input.email),
      exp: issuedAt + (input.expiresInSeconds ?? STANDALONE_AUTH_DEFAULT_TTL_SECONDS),
      iat: issuedAt,
      sub: STANDALONE_ROOT_SUBJECT,
      ...optionalClaim("image", input.image),
      ...optionalClaim("name", input.name),
    };
    const claimsJson = yield* Schema.encodeEffect(StandaloneAuthTokenClaimsJson)(claims).pipe(
      Effect.mapError(
        (cause) =>
          new StandaloneAuthTokenError({
            message: `standalone auth token claims are not serializable: ${String(cause)}`,
          }),
      ),
    );
    const signingInput = `${stringToBase64Url(JWT_HEADER_JSON)}.${stringToBase64Url(claimsJson)}`;
    const signature = yield* signingSignature(signingInput, input.secret);
    return `${signingInput}.${signature}`;
  });

/**
 * Verifies a standalone session token and returns its claims. Fails on a bad
 * signature, malformed structure, expiry, or a subject other than the root one —
 * the provider only ever issues root tokens, so anything else is forged.
 */
export const verifyStandaloneAuthToken = (
  token: string,
  secret: string,
): Effect.Effect<StandaloneAuthTokenClaims, StandaloneAuthTokenError> =>
  Effect.gen(function* () {
    const [header, payload, signature, ...rest] = token.split(".");
    if (
      header === undefined ||
      payload === undefined ||
      signature === undefined ||
      rest.length > 0
    ) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token is malformed" }),
      );
    }
    const expected = yield* signingSignature(`${header}.${payload}`, secret);
    if (!constantTimeEquals(expected, signature)) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token signature is invalid" }),
      );
    }

    const invalidPayload = (cause: unknown) =>
      new StandaloneAuthTokenError({
        message: `standalone auth token payload is invalid: ${String(cause)}`,
      });

    const payloadBytes = yield* Effect.fromResult(Encoding.decodeBase64Url(payload)).pipe(
      Effect.mapError(invalidPayload),
    );
    const parsed = yield* Schema.decodeUnknownEffect(JsonObject)(decoder.decode(payloadBytes)).pipe(
      Effect.mapError(invalidPayload),
    );

    const { email, exp, iat, sub } = parsed;
    if (typeof sub !== "string" || typeof email !== "string" || typeof exp !== "number") {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token claims are incomplete" }),
      );
    }
    if (sub !== STANDALONE_ROOT_SUBJECT) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token subject is not the root identity" }),
      );
    }
    const nowMillis = yield* Clock.currentTimeMillis;
    if (exp * 1000 <= nowMillis) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token has expired" }),
      );
    }

    return {
      email,
      exp,
      iat: numberOr(iat, 0),
      sub,
      ...optionalClaim("image", parsed.image),
      ...optionalClaim("name", parsed.name),
    };
  });

/** Reads a named cookie out of a raw `Cookie` header. */
export const readCookieValue = (
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (trimmed.startsWith(`${cookieName}=`)) {
      return decodeURIComponent(trimmed.slice(cookieName.length + 1));
    }
  }
  return undefined;
};
