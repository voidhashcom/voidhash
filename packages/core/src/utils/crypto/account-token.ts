/**
 * Deterministic per-user account token derivation — the server half of the
 * VOIDHASH_ACCOUNT_TOKEN_DERIVATION v1 cross-repo contract (the client half
 * lives in the OSS SDKs, e.g. `@voidhash/react-native`'s
 * `src/core/utils/uuid-v5.ts`; both must produce byte-identical output).
 *
 * The token is what client SDKs hand to store purchase APIs that demand an
 * opaque per-account identifier in a fixed format — Apple StoreKit's
 * `appAccountToken` (must be a UUID) and Google Play's `obfuscatedAccountId`.
 * A voidhash `distinctId` is an arbitrary customer-chosen string, so it cannot
 * be embedded losslessly in 128 bits; instead it is hashed deterministically:
 *
 *   token = UUIDv5(VOIDHASH_ACCOUNT_TOKEN_NAMESPACE, utf8(distinctId))
 *
 * Spec, pinned (any change is a breaking contract change):
 * - name input is the RAW distinctId string, UTF-8 encoded — no trimming, no
 *   case folding, no Unicode normalization (matches `person_identity`'s
 *   byte-exact distinctId equality semantics);
 * - output is the lowercase hyphenated UUID string; any externally received
 *   token must be lowercased before persist/lookup (Swift's `UUID.uuidString`
 *   is uppercase);
 * - RFC 4122 sanity anchor every implementation must reproduce:
 *   UUIDv5(DNS, "www.example.com") = 2ed6657d-e927-568b-95e1-2665a8aea6a2.
 *
 * Privacy: a distinctId may be PII (an email). UUIDv5 is a one-way SHA-1
 * digest — preimage resistance is intact (SHA-1's collision weakness is
 * irrelevant here), so only the digest ever reaches Apple/Google, satisfying
 * their no-PII guidance for these fields. The namespace is public (it ships in
 * the OSS SDK), so this is deterministic pseudonymization, not encryption:
 * someone holding a candidate distinctId can confirm it maps to a token.
 */
import { Effect } from "effect";

/**
 * Fixed derivation namespace. Provenance (reproducible, but the literal is
 * what is pinned): UUIDv5(DNS namespace 6ba7b810-9dad-11d1-80b4-00c04fd430c8,
 * "appaccounttoken.voidhash.com").
 */
export const VOIDHASH_ACCOUNT_TOKEN_NAMESPACE = "3919eb4e-3466-593c-8c1e-84554e13a0a6";

/**
 * `person_external_identifiers.serviceId` under which derived account tokens
 * are registered. Deliberately distinct from `"apple-app-store"`: those rows
 * track entitlement ownership and participate in restore/transfer rebinds,
 * while account-token rows track the canonical person of a distinctId and
 * must only ever follow identity merges. Provider-agnostic on purpose — the
 * same token serves Apple's `appAccountToken` and Google's
 * `obfuscatedAccountId`.
 */
export const ACCOUNT_TOKEN_SERVICE_ID = "voidhash-account-token";

const uuidToBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToUuid = (bytes: Uint8Array): string => {
  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * RFC 4122 name-based UUID (version 5, SHA-1) over WebCrypto — no Node
 * `crypto`/`Buffer`, so it runs unchanged on Cloudflare Workers.
 */
export const uuidV5 = (namespaceUuid: string, name: string): Effect.Effect<string> =>
  Effect.gen(function* () {
    const namespaceBytes = uuidToBytes(namespaceUuid);
    const nameBytes = new TextEncoder().encode(name);
    const input = new ArrayBuffer(namespaceBytes.length + nameBytes.length);
    const inputBytes = new Uint8Array(input);
    inputBytes.set(namespaceBytes, 0);
    inputBytes.set(nameBytes, namespaceBytes.length);
    const digest = new Uint8Array(
      // oxlint-disable-next-line effect/noGlobals -- Effect v4's `Crypto` is a Context.Service with no platform-neutral layer in the `effect` barrel (only Node/Browser/Bun, none Workers-safe), and this UUIDv5 helper must run on workerd.
      yield* Effect.promise(() => crypto.subtle.digest("SHA-1", input)),
    );
    const uuidBytes = digest.slice(0, 16);
    uuidBytes[6] = ((uuidBytes[6] ?? 0) & 0x0f) | 0x50;
    uuidBytes[8] = ((uuidBytes[8] ?? 0) & 0x3f) | 0x80;
    return bytesToUuid(uuidBytes);
  });

/**
 * Derives the deterministic account token for a distinctId. Same distinctId →
 * same token, on every device and in every SDK — which is what lets a webhook
 * carrying only the token be attributed to the right person.
 */
export const deriveAccountToken = (distinctId: string): Effect.Effect<string> =>
  uuidV5(VOIDHASH_ACCOUNT_TOKEN_NAMESPACE, distinctId);
