import { describe, expect, test } from "vite-plus/test";

import { canonicalizeLocaleTag, languageSubtag } from "./locale-tag.ts";

describe("canonicalizeLocaleTag", () => {
  test("canonicalizes casing", () => {
    expect(canonicalizeLocaleTag("pt-br")).toBe("pt-BR");
    expect(canonicalizeLocaleTag("EN")).toBe("en");
    expect(canonicalizeLocaleTag("de-de")).toBe("de-DE");
  });

  test("returns null on structurally invalid input", () => {
    expect(canonicalizeLocaleTag("")).toBeNull();
    expect(canonicalizeLocaleTag("!!garbage!!")).toBeNull();
    expect(canonicalizeLocaleTag("a-b-c-d-e-f-g")).toBeNull();
  });
});

describe("languageSubtag", () => {
  test("extracts the primary language subtag", () => {
    expect(languageSubtag("de-AT")).toBe("de");
    expect(languageSubtag("pt-BR")).toBe("pt");
    expect(languageSubtag("en")).toBe("en");
  });
});
