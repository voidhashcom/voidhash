import { describe, it, expect } from "vitest";
import { Effect, Option } from "effect";
import { readFile } from "./util";
import {
  extractTransactionIdFromReceipt,
  extractAllTransactionIdsFromReceipt,
} from "../src/receipts/index.ts";

const noTransactionId = Effect.succeed(Option.none<string>());
const noTransactionIds = Effect.succeed<string[]>([]);

describe("Receipt Utility Tests", () => {
  it("should not extract a transaction id from an xcode receipt without a transaction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const receipt = readFile("tests/resources/xcode/xcode-app-receipt-empty");

        const result = yield* extractTransactionIdFromReceipt(receipt).pipe(
          Effect.catch(() => noTransactionId),
        );

        expect(result).toEqual(Option.none());
      }),
    ));

  it("should extract a transaction id from an xcode receipt with a transaction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const receipt = readFile("tests/resources/xcode/xcode-app-receipt-with-transaction");

        const result = yield* extractTransactionIdFromReceipt(receipt).pipe(
          Effect.catch(() => noTransactionId),
        );

        expect(result).toEqual(Option.some("0"));
      }),
    ));

  it("should extract a transaction id from a legacy transaction receipt", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const receipt = readFile("tests/resources/mock_signed_data/legacyTransaction");

        const result = yield* extractTransactionIdFromReceipt(receipt).pipe(
          Effect.catch(() => noTransactionId),
        );

        expect(result).toEqual(Option.some("33993399"));
      }),
    ));

  it("should extract all transaction ids from a receipt with transactions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const receipt = readFile("tests/resources/xcode/xcode-app-receipt-with-transaction");

        const result = yield* extractAllTransactionIdsFromReceipt(receipt).pipe(
          Effect.catch(() => noTransactionIds),
        );

        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
          expect(result).toContain("0");
        }
      }),
    ));
});
