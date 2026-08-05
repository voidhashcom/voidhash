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
import { Effect, Schema } from "effect";

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

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const stringToBase64Url = (value: string): string => bytesToBase64Url(encoder.encode(value));

const importKey = (secret: string) =>
  Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey(
        "raw",
        encoder.encode(secret) as BufferSource,
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
      try: () => crypto.subtle.sign("HMAC", key, encoder.encode(signingInput) as BufferSource),
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

const sha256Hex = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  let hex = "";
  for (const byte of digest) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

/**
 * Compares two secrets without leaking their length or contents through timing.
 *
 * Both sides are hashed first so the constant-time comparison always runs over
 * equal-length inputs — a raw comparison would return early on a length
 * mismatch and leak the expected password's length.
 */
export const secretsMatch = (candidate: string, expected: string): Effect.Effect<boolean> =>
  Effect.promise(async () =>
    constantTimeEquals(await sha256Hex(candidate), await sha256Hex(expected)),
  );

/** Normalizes an email for storage: trimmed, lowercased. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

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
    const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
    const claims: StandaloneAuthTokenClaims = {
      email: normalizeEmail(input.email),
      exp: issuedAt + (input.expiresInSeconds ?? STANDALONE_AUTH_DEFAULT_TTL_SECONDS),
      iat: issuedAt,
      sub: STANDALONE_ROOT_SUBJECT,
      ...(input.image ? { image: input.image } : {}),
      ...(input.name ? { name: input.name } : {}),
    };
    const signingInput = `${stringToBase64Url(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    )}.${stringToBase64Url(JSON.stringify(claims))}`;
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
    const segments = token.split(".");
    if (segments.length !== 3) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token is malformed" }),
      );
    }
    const [header, payload, signature] = segments as [string, string, string];
    const expected = yield* signingSignature(`${header}.${payload}`, secret);
    if (!constantTimeEquals(expected, signature)) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token signature is invalid" }),
      );
    }

    const claims = yield* Effect.try({
      try: () =>
        JSON.parse(decoder.decode(base64UrlToBytes(payload))) as StandaloneAuthTokenClaims,
      catch: (cause) =>
        new StandaloneAuthTokenError({
          message: `standalone auth token payload is invalid: ${String(cause)}`,
        }),
    });

    if (
      typeof claims.sub !== "string" ||
      typeof claims.email !== "string" ||
      typeof claims.exp !== "number"
    ) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token claims are incomplete" }),
      );
    }
    if (claims.sub !== STANDALONE_ROOT_SUBJECT) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token subject is not the root identity" }),
      );
    }
    if (claims.exp * 1000 <= Date.now()) {
      return yield* Effect.fail(
        new StandaloneAuthTokenError({ message: "standalone auth token has expired" }),
      );
    }

    return claims;
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
