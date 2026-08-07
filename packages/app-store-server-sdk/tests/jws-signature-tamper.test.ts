import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { VerificationError, VerificationStatus } from "../src/errors/index.ts";
import { Environment } from "../src/schemas/index.ts";
import {
  getSignedPayloadVerifierWithDefaultAppAppleId,
  readFile,
  unwrapOptionsDeep,
} from "./util.ts";

/**
 * Negative tests for the real (non-skipped) JWS verification path — the
 * "fail loud" guarantee. These run a genuinely Apple-signed fixture through the
 * full WebCrypto path (jose `compactVerify` + `@peculiar/x509` chain) and then
 * tamper with it: the verifier must reject any byte change, never silently
 * decode unverified data. This is the test the audit flagged as missing (the
 * existing suite only had a valid-signature positive case).
 */
const flipLastChar = (segment: string): string => {
  const last = segment[segment.length - 1];
  if (last === "A") return `${segment.slice(0, -1)}B`;
  return `${segment.slice(0, -1)}A`;
};

const tamperSegment = (jws: string, index: 1 | 2): string => {
  const parts = jws.split(".");
  const segment = parts[index];
  if (segment === undefined) return jws;
  parts[index] = flipLastChar(segment);
  return parts.join(".");
};

describe("JWS signature verification fails loud (WebCrypto path)", () => {
  const verifier = getSignedPayloadVerifierWithDefaultAppAppleId(
    Environment.SANDBOX,
    "com.example",
  );
  const validTransaction = readFile("tests/resources/mock_signed_data/transactionInfo");

  it("accepts a genuinely Apple-signed transaction (sanity)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = unwrapOptionsDeep(
          yield* verifier.verifyAndDecodeTransaction(validTransaction),
        );
        expect(result.environment).toBe(Environment.SANDBOX);
      }),
    ));

  it("rejects a transaction whose signature byte was flipped", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const tampered = tamperSegment(validTransaction, 2);
        const exit = yield* Effect.exit(verifier.verifyAndDecodeTransaction(tampered));
        expect(exit._tag).toBe("Failure");
        if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
          const error = exit.cause.error;
          expect(error).toBeInstanceOf(VerificationError);
          expect(error._tag).toBe("VerificationError");
          if (error instanceof VerificationError) {
            expect(error.status).toBe(VerificationStatus.VERIFICATION_FAILURE);
          }
        }
      }),
    ));

  it("rejects a transaction whose payload was tampered", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const tampered = tamperSegment(validTransaction, 1);
        const exit = yield* Effect.exit(verifier.verifyAndDecodeTransaction(tampered));
        expect(exit._tag).toBe("Failure");
      }),
    ));
});
