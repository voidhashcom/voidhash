// `reflect-metadata` must be evaluated before `@peculiar/x509` (its `tsyringe`
// dependency reads `Reflect.getMetadata` at module load). Listing it first here
// guarantees that ordering. It is a pure-JS polyfill, safe on Cloudflare Workers.
import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { causeMessage } from "@voidhash/lib/lang";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { CertificateError, VerificationError, VerificationStatus } from "../errors/index.ts";
import { bytesToHex } from "../internal/bytes.ts";

// Use the ambient WebCrypto implementation (workerd / Node global) for all
// certificate signature checks, thumbprints, and public-key exports.
x509.cryptoProvider.set(globalThis.crypto);

// Apple-specific OIDs for certificate validation
const APPLE_ROOT_CA_G3_OID = "1.2.840.113635.100.6.2.1";
const APPLE_APP_STORE_OID = "1.2.840.113635.100.6.11.1";

// Maximum clock skew allowed (60 seconds)
const MAX_SKEW_MS = 60000;

/**
 * Configuration for certificate chain validation.
 */
export interface CertificateChainValidationConfig {
  /** Apple root certificates (PEM format). */
  rootCertificates: string[];
  /** Whether to enable online checks (OCSP). */
  enableOnlineChecks: boolean;
  /** Current time for validation (defaults to now). */
  currentTime: Option.Option<Date>;
}

const makeVerificationError = (status: VerificationStatus): VerificationError =>
  new VerificationError({ status, cause: Option.none() });

function asOption<T>(value: Option.Option<T>): Option.Option<T>;
function asOption(value: unknown): Option.Option<unknown> {
  if (Option.isOption(value)) return value;
  return Option.fromNullishOr(value);
}

/** Builds the `catch` handler shared by the certificate operations below. */
const certificateError =
  (context: string) =>
  (error: unknown): CertificateError =>
    new CertificateError({
      message: `${context}: ${causeMessage(error)}`,
      cause: Option.some(error),
    });

/**
 * Parses a PEM-encoded certificate.
 */
export const parseCertificate = (
  pem: string,
): Effect.Effect<x509.X509Certificate, CertificateError> =>
  Effect.try({
    try: () => new x509.X509Certificate(pem),
    catch: certificateError("Failed to parse certificate"),
  });

/**
 * Extracts the certificate chain from a JWS header's x5c field.
 */
export const extractCertificateChain = (
  x5c: string[],
): Effect.Effect<x509.X509Certificate[], CertificateError> =>
  Effect.all(
    x5c.map((cert) => {
      const pem = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
      return parseCertificate(pem);
    }),
    { concurrency: 1 },
  );

/**
 * Checks if a certificate carries a specific extension OID.
 */
const hasOid = (cert: x509.X509Certificate, oid: string): boolean =>
  cert.getExtension(oid) !== null;

/**
 * Computes a certificate's SHA-256 thumbprint as a lowercase hex string.
 */
const getThumbprintHex = (cert: x509.X509Certificate): Effect.Effect<string, CertificateError> =>
  Effect.tryPromise({
    try: () => cert.getThumbprint("SHA-256"),
    catch: certificateError("Failed to compute certificate thumbprint"),
  }).pipe(Effect.map((thumbprint) => bytesToHex(new Uint8Array(thumbprint))));

/**
 * Verifies that `cert` was signed by `issuer`'s public key (signature only;
 * validity-period checks are handled separately with clock skew). Resolves to
 * `false` rather than failing so callers can map to a single verification
 * status.
 */
const isSignedBy = (
  cert: x509.X509Certificate,
  issuer: x509.X509Certificate,
): Effect.Effect<boolean> =>
  Effect.tryPromise({
    try: () => cert.verify({ publicKey: issuer, signatureOnly: true }),
    catch: certificateError("certificate signature verification failed"),
  }).pipe(Effect.orElseSucceed(() => false));

/**
 * Validates the certificate chain.
 *
 * The chain should be: Leaf -> Intermediate -> Root
 * with exactly 3 certificates.
 */
export const validateCertificateChain = (
  chain: x509.X509Certificate[],
  config: CertificateChainValidationConfig,
): Effect.Effect<void, VerificationError | CertificateError> =>
  Effect.gen(function* () {
    // Check chain length (should be exactly 3)
    if (chain.length !== 3) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.INVALID_CHAIN_LENGTH));
    }

    // Length is already known to be 3; the guard below narrows the tuple reads
    // for the type checker without an assertion.
    const [leaf, intermediate, root] = chain;
    if (leaf === undefined || intermediate === undefined || root === undefined) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.INVALID_CHAIN_LENGTH));
    }

    const now = yield* Option.match(asOption(config.currentTime), {
      onSome: (date) => Effect.succeed(date),
      onNone: () => DateTime.nowAsDate,
    });

    // Validate certificate dates with clock skew
    yield* Effect.forEach(
      chain,
      (cert) => {
        const effectiveNotBefore = cert.notBefore.getTime() - MAX_SKEW_MS;
        const effectiveNotAfter = cert.notAfter.getTime() + MAX_SKEW_MS;
        return now.getTime() < effectiveNotBefore || now.getTime() > effectiveNotAfter
          ? Effect.fail(makeVerificationError(VerificationStatus.INVALID_CERTIFICATE))
          : Effect.void;
      },
      { concurrency: 1, discard: true },
    );

    // Verify root is in our trusted root certificates (by SHA-256 thumbprint)
    const rootThumbprint = yield* getThumbprintHex(root);
    const trustMatches = yield* Effect.forEach(
      config.rootCertificates,
      (trustedRootPem) =>
        Effect.gen(function* () {
          const trustedRoot = yield* parseCertificate(trustedRootPem);
          const trustedThumbprint = yield* getThumbprintHex(trustedRoot);
          return rootThumbprint === trustedThumbprint;
        }),
      { concurrency: 1 },
    );
    const rootTrusted = Arr.some(trustMatches, (matches) => matches);

    if (!rootTrusted) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.VERIFICATION_FAILURE));
    }

    if (!hasOid(leaf, APPLE_APP_STORE_OID) || !hasOid(intermediate, APPLE_ROOT_CA_G3_OID)) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.VERIFICATION_FAILURE));
    }

    // Verify the chain signatures: leaf signed by intermediate, intermediate by root.
    if (!(yield* isSignedBy(leaf, intermediate))) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.VERIFICATION_FAILURE));
    }

    if (!(yield* isSignedBy(intermediate, root))) {
      return yield* Effect.fail(makeVerificationError(VerificationStatus.VERIFICATION_FAILURE));
    }
  });

/**
 * Gets the leaf certificate's public key as a WebCrypto {@link CryptoKey},
 * ready to pass to `jose.compactVerify`.
 */
export const getPublicKeyFromChain = (
  chain: x509.X509Certificate[],
): Effect.Effect<CryptoKey, CertificateError> =>
  Effect.gen(function* () {
    const toError = certificateError("Failed to get public key");
    const leaf = chain[0];
    if (leaf === undefined) {
      return yield* Effect.fail(
        new CertificateError({
          message: "Failed to get public key: Empty certificate chain",
          cause: Option.none(),
        }),
      );
    }
    return yield* Effect.tryPromise({
      try: () => leaf.publicKey.export(),
      catch: toError,
    });
  });
import * as Arr from "effect/Array";
