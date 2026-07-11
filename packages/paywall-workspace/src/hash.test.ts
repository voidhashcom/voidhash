import { describe, expect, it } from "vitest";

import { hashSource } from "./hash.ts";

describe("hashSource (SHA-256)", () => {
  it("returns 64 lowercase hex chars", () => {
    const digest = hashSource("anything");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the standard SHA-256 vector for the empty string", () => {
    expect(hashSource("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it('matches the standard SHA-256 vector for "abc"', () => {
    expect(hashSource("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes multi-byte UTF-8 as its UTF-8 bytes", () => {
    // node -e 'crypto.createHash("sha256").update("héllo wörld — 日本語 🎉","utf8").digest("hex")'
    expect(hashSource("héllo wörld — 日本語 🎉")).toBe(
      "1043a91841e5a61ef9b6cc83f848d1b9c4c373ec7b4add02f07e001a75e7af0b",
    );
  });

  it("hashes a >64-byte (multi-block) input", () => {
    // 200 bytes → spans four 64-byte SHA-256 blocks incl. padding block.
    expect(hashSource("a".repeat(200))).toBe(
      "c2a908d98f5df987ade41b5fce213067efbcc21ef2240212a41e54b5e7c28ae5",
    );
  });

  it("is stable and collision-sensitive to single-char changes", () => {
    expect(hashSource("A")).toBe(hashSource("A"));
    expect(hashSource("A")).not.toBe(hashSource("B"));
  });
});
