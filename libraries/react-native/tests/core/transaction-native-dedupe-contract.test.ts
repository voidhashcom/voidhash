import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../src/core/transactions/transaction-service.ts", import.meta.url),
  "utf8",
);

describe("transaction native dedupe contract", () => {
  it("uses the native registry without cache or TTL source-of-truth state", () => {
    expect(source).toContain("hasDurableDedupe");
    expect(source).toContain("checkAndSetDurableDedupe");
    expect(source).not.toContain("CacheManager");
    expect(source).not.toContain("PROCESSED_TRANSACTION_TTL");
    expect(source).not.toContain("processed-transaction:");
  });
});
