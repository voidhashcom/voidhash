import { describe, expect, it } from "vite-plus/test";

import { createSlug } from "../../src/utils/create-slug.ts";

describe("createSlug", () => {
  it("lowercases and dash-separates an alphanumeric display name", () => {
    expect(createSlug("My Test Product")).toBe("my-test-product");
  });

  it("lowercases an all-uppercase name", () => {
    expect(createSlug("UPPER")).toBe("upper");
  });

  it("trims leading and trailing whitespace", () => {
    expect(createSlug("  hello  ")).toBe("hello");
  });

  it("collapses runs of internal whitespace into a single dash", () => {
    expect(createSlug("multi   space")).toBe("multi-space");
  });

  it("replaces non-alphanumeric characters and strips the resulting trailing dash", () => {
    expect(createSlug("hello@world!")).toBe("hello-world");
  });

  it("collapses consecutive dashes into one", () => {
    expect(createSlug("hello---world")).toBe("hello-world");
  });

  it("removes leading and trailing dashes", () => {
    expect(createSlug("-hello-world-")).toBe("hello-world");
  });

  it("keeps underscores as legal slug characters", () => {
    expect(createSlug("snake_case_name")).toBe("snake_case_name");
  });

  it("preserves an underscore-flanked dash unchanged", () => {
    expect(createSlug("mix_-_ok")).toBe("mix_-_ok");
  });

  it("preserves a single-character name", () => {
    expect(createSlug("a")).toBe("a");
  });

  it("keeps digits and dash-separates them from words", () => {
    expect(createSlug("123 ABC")).toBe("123-abc");
  });

  it("handles mixed case, underscores, dashes and a trailing symbol", () => {
    expect(createSlug("Hello_World-Test!")).toBe("hello_world-test");
  });

  // Accented/unicode characters are NOT transliterated — they fall outside the
  // [a-z0-9_-] character class, collapse to a dash, and that trailing dash is
  // then stripped, so "café" → "caf" (the é is simply dropped, not preserved).
  it("does not transliterate accented characters (café → caf)", () => {
    expect(createSlug("café")).toBe("caf");
  });

  it("drops a leading unicode-only word, keeping the ascii tail", () => {
    expect(createSlug("Über cool")).toBe("ber-cool");
  });

  it("returns empty string when nothing alphanumeric survives normalization", () => {
    expect(createSlug("!!!")).toBe("");
  });

  it("returns empty string for a lone dash", () => {
    expect(createSlug("-")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(createSlug("   ")).toBe("");
  });

  it("returns empty string for the empty string", () => {
    expect(createSlug("")).toBe("");
  });

  it.each([
    ["My Test Product", "my-test-product"],
    ["  hello  ", "hello"],
    ["hello@world!", "hello-world"],
    ["hello---world", "hello-world"],
    ["-hello-world-", "hello-world"],
    ["snake_case_name", "snake_case_name"],
    ["123 ABC", "123-abc"],
    ["!!!", ""],
    ["café", "caf"],
  ])("createSlug(%j) === %j", (input, expected) => {
    expect(createSlug(input)).toBe(expected);
  });
});
