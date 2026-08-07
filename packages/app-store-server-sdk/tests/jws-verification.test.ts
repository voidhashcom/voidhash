import { describe, expect, it } from "vitest";
import { DateTime, Effect } from "effect";
import { extractCertificateChain, validateCertificateChain } from "../src/verification/index.ts";
import { VerificationError, VerificationStatus, CertificateError } from "../src/errors/index.ts";

const ROOT_CA_BASE64_ENCODED =
  "MIIBgjCCASmgAwIBAgIJALUc5ALiH5pbMAoGCCqGSM49BAMDMDYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlDdXBlcnRpbm8wHhcNMjMwMTA1MjEzMDIyWhcNMzMwMTAyMjEzMDIyWjA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEc+/Bl+gospo6tf9Z7io5tdKdrlN1YdVnqEhEDXDShzdAJPQijamXIMHf8xWWTa1zgoYTxOKpbuJtDplz1XriTaMgMB4wDAYDVR0TBAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDRwAwRAIgemWQXnMAdTad2JDJWng9U4uBBL5mA7WI05H7oH7c6iQCIHiRqMjNfzUAyiu9h6rOU/K+iTR0I/3Y/NSWsXHX+acc";

const INTERMEDIATE_CA_BASE64_ENCODED =
  "MIIBnzCCAUWgAwIBAgIBCzAKBggqhkjOPQQDAzA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMB4XDTIzMDEwNTIxMzEwNVoXDTMzMDEwMTIxMzEwNVowRTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlDdXBlcnRpbm8xFTATBgNVBAoMDEludGVybWVkaWF0ZTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABBUN5V9rKjfRiMAIojEA0Av5Mp0oF+O0cL4gzrTF178inUHugj7Et46NrkQ7hKgMVnjogq45Q1rMs+cMHVNILWqjNTAzMA8GA1UdEwQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMBAGCiqGSIb3Y2QGAgEEAgUAMAoGCCqGSM49BAMDA0gAMEUCIQCmsIKYs41ullssHX4rVveUT0Z7Is5/hLK1lFPTtun3hAIgc2+2RG5+gNcFVcs+XJeEl4GZ+ojl3ROOmll+ye7dynQ=";

const LEAF_CERT_BASE64_ENCODED =
  "MIIBoDCCAUagAwIBAgIBDDAKBggqhkjOPQQDAzBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExEjAQBgNVBAcMCUN1cGVydGlubzEVMBMGA1UECgwMSW50ZXJtZWRpYXRlMB4XDTIzMDEwNTIxMzEzNFoXDTMzMDEwMTIxMzEzNFowPTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlDdXBlcnRpbm8xDTALBgNVBAoMBExlYWYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATitYHEaYVuc8g9AjTOwErMvGyPykPa+puvTI8hJTHZZDLGas2qX1+ErxgQTJgVXv76nmLhhRJH+j25AiAI8iGsoy8wLTAJBgNVHRMEAjAAMA4GA1UdDwEB/wQEAwIHgDAQBgoqhkiG92NkBgsBBAIFADAKBggqhkjOPQQDAwNIADBFAiBX4c+T0Fp5nJ5QRClRfu5PSByRvNPtuaTsk0vPB3WAIAIhANgaauAj/YP9s0AkEhyJhxQO/6Q2zouZ+H1CIOehnMzQ";

const INTERMEDIATE_CA_INVALID_OID_BASE64_ENCODED =
  "MIIBnjCCAUWgAwIBAgIBDTAKBggqhkjOPQQDAzA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMB4XDTIzMDEwNTIxMzYxNFoXDTMzMDEwMTIxMzYxNFowRTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlDdXBlcnRpbm8xFTATBgNVBAoMDEludGVybWVkaWF0ZTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABBUN5V9rKjfRiMAIojEA0Av5Mp0oF+O0cL4gzrTF178inUHugj7Et46NrkQ7hKgMVnjogq45Q1rMs+cMHVNILWqjNTAzMA8GA1UdEwQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMBAGCiqGSIb3Y2QGAgIEAgUAMAoGCCqGSM49BAMDA0cAMEQCIFROtTE+RQpKxNXETFsf7Mc0h+5IAsxxo/X6oCC/c33qAiAmC5rn5yCOOEjTY4R1H1QcQVh+eUwCl13NbQxWCuwxxA==";

const LEAF_CERT_FOR_INTERMEDIATE_CA_INVALID_OID_BASE64_ENCODED =
  "MIIBnzCCAUagAwIBAgIBDjAKBggqhkjOPQQDAzBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExEjAQBgNVBAcMCUN1cGVydGlubzEVMBMGA1UECgwMSW50ZXJtZWRpYXRlMB4XDTIzMDEwNTIxMzY1OFoXDTMzMDEwMTIxMzY1OFowPTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlDdXBlcnRpbm8xDTALBgNVBAoMBExlYWYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATitYHEaYVuc8g9AjTOwErMvGyPykPa+puvTI8hJTHZZDLGas2qX1+ErxgQTJgVXv76nmLhhRJH+j25AiAI8iGsoy8wLTAJBgNVHRMEAjAAMA4GA1UdDwEB/wQEAwIHgDAQBgoqhkiG92NkBgsBBAIFADAKBggqhkjOPQQDAwNHADBEAiAUAs+gzYOsEXDwQquvHYbcVymyNqDtGw9BnUFp2YLuuAIgXxQ3Ie9YU0cMqkeaFd+lyo0asv9eyzk6stwjeIeOtTU=";

const LEAF_CERT_INVALID_OID_BASE64_ENCODED =
  "MIIBoDCCAUagAwIBAgIBDzAKBggqhkjOPQQDAzBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExEjAQBgNVBAcMCUN1cGVydGlubzEVMBMGA1UECgwMSW50ZXJtZWRpYXRlMB4XDTIzMDEwNTIxMzczMVoXDTMzMDEwMTIxMzczMVowPTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlDdXBlcnRpbm8xDTALBgNVBAoMBExlYWYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATitYHEaYVuc8g9AjTOwErMvGyPykPa+puvTI8hJTHZZDLGas2qX1+ErxgQTJgVXv76nmLhhRJH+j25AiAI8iGsoy8wLTAJBgNVHRMEAjAAMA4GA1UdDwEB/wQEAwIHgDAQBgoqhkiG92NkBgsCBAIFADAKBggqhkjOPQQDAwNIADBFAiAb+7S3i//bSGy7skJY9+D4VgcQLKFeYfIMSrUCmdrFqwIhAIMVwzD1RrxPRtJyiOCXLyibIvwcY+VS73HYfk0O9lgz";

/** Builds a fixed `Date` without reaching for the `Date` global. */
const dateFromMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

const EFFECTIVE_DATE = dateFromMillis(1761962975000); // October 2025 — within the cert validity window

const toPem = (base64: string): string =>
  `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;

/** Reads the `status` off a failure that is expected to be a `VerificationError`. */
const statusOf = (error: VerificationError | CertificateError) => {
  if (error instanceof VerificationError) return error.status;
  return undefined;
};

const runVerify = (
  rootBase64: string,
  leafBase64: string,
  intermediateBase64: string,
  currentTime: Date = EFFECTIVE_DATE,
): Effect.Effect<"ok", VerificationError | CertificateError> =>
  Effect.gen(function* () {
    const chain = yield* extractCertificateChain([leafBase64, intermediateBase64, rootBase64]);
    yield* validateCertificateChain(chain, {
      rootCertificates: [toPem(rootBase64)],
      enableOnlineChecks: false,
      currentTime,
    });
    return "ok";
  });

describe("JWS Chain Verification", () => {
  it("validates a valid chain", () =>
    Effect.gen(function* () {
      const result = yield* runVerify(
        ROOT_CA_BASE64_ENCODED,
        LEAF_CERT_BASE64_ENCODED,
        INTERMEDIATE_CA_BASE64_ENCODED,
      );
      expect(result).toBe("ok");
    }).pipe(Effect.runPromise));

  it("rejects a chain with an invalid intermediate OID", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        runVerify(
          ROOT_CA_BASE64_ENCODED,
          LEAF_CERT_FOR_INTERMEDIATE_CA_INVALID_OID_BASE64_ENCODED,
          INTERMEDIATE_CA_INVALID_OID_BASE64_ENCODED,
        ),
      );
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise));

  it("rejects a chain with an invalid leaf OID", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        runVerify(
          ROOT_CA_BASE64_ENCODED,
          LEAF_CERT_INVALID_OID_BASE64_ENCODED,
          INTERMEDIATE_CA_BASE64_ENCODED,
        ),
      );
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise));

  it("rejects an expired chain", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        runVerify(
          ROOT_CA_BASE64_ENCODED,
          LEAF_CERT_BASE64_ENCODED,
          INTERMEDIATE_CA_BASE64_ENCODED,
          dateFromMillis(2280946846000), // far future, beyond cert validity
        ),
      );
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_CERTIFICATE);
    }).pipe(Effect.runPromise));

  it("rejects a chain when root is not in trusted roots", () => {
    // The real Apple Root CA G3 — totally unrelated to the test chain,
    // so fingerprint comparison must fail.
    const otherRoot =
      "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";
    return Effect.gen(function* () {
      const error = yield* Effect.flip(
        runVerify(otherRoot, LEAF_CERT_BASE64_ENCODED, INTERMEDIATE_CA_BASE64_ENCODED),
      );
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise);
  });

  it("rejects an empty roots list", () =>
    Effect.gen(function* () {
      const program = Effect.gen(function* () {
        const chain = yield* extractCertificateChain([
          LEAF_CERT_BASE64_ENCODED,
          INTERMEDIATE_CA_BASE64_ENCODED,
          ROOT_CA_BASE64_ENCODED,
        ]);
        yield* validateCertificateChain(chain, {
          rootCertificates: [],
          enableOnlineChecks: false,
          currentTime: EFFECTIVE_DATE,
        });
      });
      const error = yield* Effect.flip(program);
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise));

  it("rejects a chain of the wrong length", () =>
    Effect.gen(function* () {
      const program = Effect.gen(function* () {
        const chain = yield* extractCertificateChain([
          LEAF_CERT_BASE64_ENCODED,
          INTERMEDIATE_CA_BASE64_ENCODED,
        ]);
        yield* validateCertificateChain(chain, {
          rootCertificates: [toPem(ROOT_CA_BASE64_ENCODED)],
          enableOnlineChecks: false,
          currentTime: EFFECTIVE_DATE,
        });
      });
      const error = yield* Effect.flip(program);
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_CHAIN_LENGTH);
    }).pipe(Effect.runPromise));

  it("rejects garbage root data", () =>
    Effect.gen(function* () {
      const program = Effect.gen(function* () {
        const chain = yield* extractCertificateChain([
          LEAF_CERT_BASE64_ENCODED,
          INTERMEDIATE_CA_BASE64_ENCODED,
          ROOT_CA_BASE64_ENCODED,
        ]);
        yield* validateCertificateChain(chain, {
          rootCertificates: ["not-a-cert"],
          enableOnlineChecks: false,
          currentTime: EFFECTIVE_DATE,
        });
      });
      const error = yield* Effect.flip(program);
      expect(error).toBeDefined();
    }).pipe(Effect.runPromise));
});
