import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as Schema from "effect/Schema";

class HashingError extends Schema.TaggedErrorClass<HashingError>()("HashingError", {
  cause: Schema.Unknown,
}) {}

/** Generate a random document/database/collection/user identifier. */
export const randomId = (): string => globalThis.crypto.randomUUID();

/**
 * Deterministic SHA-256 hex digest used for password and token storage.
 *
 * The synchronous implementation works in the supported Node and workerd
 * adapter runtimes without async WebCrypto plumbing.
 */
export const hashHex = (value: string): Effect.Effect<string> =>
  Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    catch: (cause) => new HashingError({ cause }),
  }).pipe(
    Effect.map((digest) => Encoding.encodeHex(new Uint8Array(digest))),
    Effect.orDie,
  );
