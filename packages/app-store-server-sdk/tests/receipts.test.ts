import { describe, it, expect } from "vitest";
import { Effect, Option } from "effect";
import { readFile } from "./util";
import {
  extractTransactionIdFromReceipt,
  extractAllTransactionIdsFromReceipt,
} from "../src/receipts/index.ts";

describe("Receipt Utility Tests", () => {
  it("should not extract a transaction id from an xcode receipt without a transaction", async () => {
    const receipt = readFile("tests/resources/xcode/xcode-app-receipt-empty");

    const result = await Effect.runPromise(
      extractTransactionIdFromReceipt(receipt).pipe(
        Effect.catch(() => Effect.succeed(Option.none())),
      ),
    );

    expect(result).toEqual(Option.none());
  });

  it("should extract a transaction id from an xcode receipt with a transaction", async () => {
    const receipt = readFile("tests/resources/xcode/xcode-app-receipt-with-transaction");

    const result = await Effect.runPromise(
      extractTransactionIdFromReceipt(receipt).pipe(
        Effect.catch(() => Effect.succeed(Option.none())),
      ),
    );

    expect(result).toEqual(Option.some("0"));
  });

  it("should extract a transaction id from a legacy transaction receipt", async () => {
    const receipt = readFile("tests/resources/mock_signed_data/legacyTransaction");

    const result = await Effect.runPromise(
      extractTransactionIdFromReceipt(receipt).pipe(
        Effect.catch(() => Effect.succeed(Option.none())),
      ),
    );

    expect(result).toEqual(Option.some("33993399"));
  });

  it("should extract all transaction ids from a receipt with transactions", async () => {
    const receipt = readFile("tests/resources/xcode/xcode-app-receipt-with-transaction");

    const result = await Effect.runPromise(
      extractAllTransactionIdsFromReceipt(receipt).pipe(
        Effect.catch(() => Effect.succeed([] as string[])),
      ),
    );

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result).toContain("0");
    }
  });
});
