import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { VerificationError, VerificationStatus } from "../src/errors/index.ts";
import { Environment } from "../src/schemas/index.ts";
import {
  readFile,
  getSignedPayloadVerifierWithDefaultAppAppleId,
  unwrapOptionsDeep,
} from "./util.ts";

describe("Decoding checks", () => {
  it("should fail to verify with a missing x5c header", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.PRODUCTION,
      "com.example",
    );
    const missingX5CHeaderClaim = readFile(
      "tests/resources/mock_signed_data/missingX5CHeaderClaim",
    );

    const result = await Effect.runPromiseExit(
      verifier.verifyAndDecodeNotification(missingX5CHeaderClaim),
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.INVALID_CHAIN_LENGTH);
      }
    }
  });

  it("should fail to verify with an invalid bundle id", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );
    const wrongBundleId = readFile("tests/resources/mock_signed_data/wrongBundleId");

    const result = await Effect.runPromiseExit(verifier.verifyAndDecodeNotification(wrongBundleId));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.INVALID_APP_IDENTIFIER);
      }
    }
  });

  it("should fail to verify with an invalid bundle id for transaction", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example.x",
    );
    const transactionInfo = readFile("tests/resources/mock_signed_data/transactionInfo");

    const result = await Effect.runPromiseExit(
      verifier.verifyAndDecodeTransaction(transactionInfo),
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.INVALID_APP_IDENTIFIER);
      }
    }
  });

  it("should fail to verify with an invalid environment", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.PRODUCTION,
      "com.example",
    );
    const testNotification = readFile("tests/resources/mock_signed_data/testNotification");

    const result = await Effect.runPromiseExit(
      verifier.verifyAndDecodeNotification(testNotification),
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.INVALID_ENVIRONMENT);
      }
    }
  });

  it("should fail to verify with a malformed JWT with too many parts", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );

    const result = await Effect.runPromiseExit(verifier.verifyAndDecodeNotification("a.b.c.d"));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.VERIFICATION_FAILURE);
      }
    }
  });

  it("should fail to verify with a malformed JWT", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );

    const result = await Effect.runPromiseExit(verifier.verifyAndDecodeNotification("a.b.c"));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      if (error._tag === "Fail") {
        const verificationError = error.error as VerificationError;
        expect(verificationError._tag).toBe("VerificationError");
        expect(verificationError.status).toBe(VerificationStatus.VERIFICATION_FAILURE);
      }
    }
  });

  it("should verify and decode a valid notification", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );
    const testNotification = readFile("tests/resources/mock_signed_data/testNotification");

    const result = unwrapOptionsDeep(
      await Effect.runPromise(verifier.verifyAndDecodeNotification(testNotification)),
    );
    expect(result.notificationType).toBe("TEST");
  });

  it("should verify and decode valid renewal info", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );
    const renewalInfo = readFile("tests/resources/mock_signed_data/renewalInfo");

    const result = unwrapOptionsDeep(
      await Effect.runPromise(verifier.verifyAndDecodeRenewalInfo(renewalInfo)),
    );
    expect(result.environment).toBe(Environment.SANDBOX);
  });

  it("should verify and decode valid transaction info", async () => {
    const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
      Environment.SANDBOX,
      "com.example",
    );
    const transactionInfo = readFile("tests/resources/mock_signed_data/transactionInfo");

    const result = unwrapOptionsDeep(
      await Effect.runPromise(verifier.verifyAndDecodeTransaction(transactionInfo)),
    );
    expect(result.environment).toBe(Environment.SANDBOX);
  });
});
