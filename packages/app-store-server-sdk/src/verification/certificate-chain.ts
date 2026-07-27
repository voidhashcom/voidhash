// `reflect-metadata` must be evaluated before `@peculiar/x509` (its `tsyringe`
// dependency reads `Reflect.getMetadata` at module load). Listing it first here
// guarantees that ordering. It is a pure-JS polyfill, safe on Cloudflare Workers.
import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { Effect, Option } from "effect";
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

const asOption = <T>(value: Option.Option<T> | T | null | undefined): Option.Option<T> =>
  Option.isOption(value) ? value : Option.fromNullishOr(value);

/**
 * Parses a PEM-encoded certificate.
 */
export const parseCertificate = (
  pem: string,
): Effect.Effect<x509.X509Certificate, CertificateError> =>
  Effect.try({
    try: () => new x509.X509Certificate(pem),
    catch: (error) =>
      new CertificateError({
        message: `Failed to parse certificate: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
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
    try: async () => bytesToHex(new Uint8Array(await cert.getThumbprint("SHA-256"))),
    catch: (error) =>
      new CertificateError({
        message: `Failed to compute certificate thumbprint: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });

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
    catch: () => new Error("certificate signature verification failed"),
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

    // We've already verified length is 3, so these are safe
    const leaf = chain[0] as x509.X509Certificate;
    const intermediate = chain[1] as x509.X509Certificate;
    const root = chain[2] as x509.X509Certificate;
    const now = Option.getOrElse(asOption(config.currentTime), () => new Date());

    // Validate certificate dates with clock skew
    for (const cert of chain) {
      const effectiveNotBefore = cert.notBefore.getTime() - MAX_SKEW_MS;
      const effectiveNotAfter = cert.notAfter.getTime() + MAX_SKEW_MS;

      if (now.getTime() < effectiveNotBefore || now.getTime() > effectiveNotAfter) {
        return yield* Effect.fail(makeVerificationError(VerificationStatus.INVALID_CERTIFICATE));
      }
    }

    // Verify root is in our trusted root certificates (by SHA-256 thumbprint)
    const rootThumbprint = yield* getThumbprintHex(root);
    let rootTrusted = false;
    for (const trustedRootPem of config.rootCertificates) {
      const trustedRoot = yield* parseCertificate(trustedRootPem);
      const trustedThumbprint = yield* getThumbprintHex(trustedRoot);
      if (rootThumbprint === trustedThumbprint) {
        rootTrusted = true;
        break;
      }
    }

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
  Effect.tryPromise({
    try: async () => {
      const leaf = chain[0];
      if (leaf === undefined) {
        throw new Error("Empty certificate chain");
      }
      return await leaf.publicKey.export();
    },
    catch: (error) =>
      new CertificateError({
        message: `Failed to get public key: ${error instanceof Error ? error.message : String(error)}`,
        cause: Option.some(error),
      }),
  });
