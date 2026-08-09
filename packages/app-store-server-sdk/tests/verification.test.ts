import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { VerificationError, VerificationStatus } from "../src/errors/index.ts";
import { Environment } from "../src/schemas/index.ts";
import {
  readFile,
  getSignedPayloadVerifierWithDefaultAppAppleId,
  unwrapOptionsDeep,
} from "./util.ts";

/** Reads the `status` off a failure that is expected to be a `VerificationError`. */
const statusOf = (error: unknown) => {
  if (error instanceof VerificationError) return error.status;
  return undefined;
};

describe("Decoding checks", () => {
  it("should fail to verify with a missing x5c header", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.PRODUCTION,
        "com.example",
      );
      const missingX5CHeaderClaim = readFile(
        "tests/resources/mock_signed_data/missingX5CHeaderClaim",
      );

      const error = yield* Effect.flip(
        verifier.verifyAndDecodeNotification(missingX5CHeaderClaim),
      );
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_CHAIN_LENGTH);
    }).pipe(Effect.runPromise));

  it("should fail to verify with an invalid bundle id", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );
      const wrongBundleId = readFile("tests/resources/mock_signed_data/wrongBundleId");

      const error = yield* Effect.flip(verifier.verifyAndDecodeNotification(wrongBundleId));
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_APP_IDENTIFIER);
    }).pipe(Effect.runPromise));

  it("should fail to verify with an invalid bundle id for transaction", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example.x",
      );
      const transactionInfo = readFile("tests/resources/mock_signed_data/transactionInfo");

      const error = yield* Effect.flip(verifier.verifyAndDecodeTransaction(transactionInfo));
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_APP_IDENTIFIER);
    }).pipe(Effect.runPromise));

  it("should fail to verify with an invalid environment", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.PRODUCTION,
        "com.example",
      );
      const testNotification = readFile("tests/resources/mock_signed_data/testNotification");

      const error = yield* Effect.flip(verifier.verifyAndDecodeNotification(testNotification));
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.INVALID_ENVIRONMENT);
    }).pipe(Effect.runPromise));

  it("should fail to verify with a malformed JWT with too many parts", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );

      const error = yield* Effect.flip(verifier.verifyAndDecodeNotification("a.b.c.d"));
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise));

  it("should fail to verify with a malformed JWT", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );

      const error = yield* Effect.flip(verifier.verifyAndDecodeNotification("a.b.c"));
      expect(error).toBeInstanceOf(VerificationError);
      expect(statusOf(error)).toBe(VerificationStatus.VERIFICATION_FAILURE);
    }).pipe(Effect.runPromise));

  it("should verify and decode a valid notification", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );
      const testNotification = readFile("tests/resources/mock_signed_data/testNotification");

      const result = unwrapOptionsDeep(
        yield* verifier.verifyAndDecodeNotification(testNotification),
      );
      expect(result.notificationType).toBe("TEST");
    }).pipe(Effect.runPromise));

  it("should verify and decode valid renewal info", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );
      const renewalInfo = readFile("tests/resources/mock_signed_data/renewalInfo");

      const result = unwrapOptionsDeep(yield* verifier.verifyAndDecodeRenewalInfo(renewalInfo));
      expect(result.environment).toBe(Environment.SANDBOX);
    }).pipe(Effect.runPromise));

  it("should verify and decode valid transaction info", () =>
    Effect.gen(function* () {
      const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
        Environment.SANDBOX,
        "com.example",
      );
      const transactionInfo = readFile("tests/resources/mock_signed_data/transactionInfo");

      const result = unwrapOptionsDeep(yield* verifier.verifyAndDecodeTransaction(transactionInfo));
      expect(result.environment).toBe(Environment.SANDBOX);
    }).pipe(Effect.runPromise));
});
