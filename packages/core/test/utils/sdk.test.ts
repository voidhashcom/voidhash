import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { describe, expect, it } from "vite-plus/test";

import { isAnonymousId } from "../../src/utils/sdk.ts";

describe("isAnonymousId", () => {
  it("returns true for an id carrying the anonymous prefix", () => {
    expect(isAnonymousId(`${ANONYMOUS_USER_ID_PREFIX}12345`)).toBe(true);
  });

  it("returns false for a regular (non-anonymous) id", () => {
    expect(isAnonymousId("user_abc123")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isAnonymousId("")).toBe(false);
  });

  it("returns true for the bare prefix with no suffix", () => {
    expect(isAnonymousId(ANONYMOUS_USER_ID_PREFIX)).toBe(true);
  });

  it("is case sensitive — an upper-cased prefix does not match", () => {
    expect(isAnonymousId(`${ANONYMOUS_USER_ID_PREFIX.toUpperCase()}12345`)).toBe(false);
  });

  it("only matches at position 0 — the prefix mid-string does not count", () => {
    expect(isAnonymousId(`user_${ANONYMOUS_USER_ID_PREFIX}12345`)).toBe(false);
  });
});
