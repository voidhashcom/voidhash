import { describe, expect, it } from "vitest";
import { hasErrors, error, info, warning } from "./diagnostics.ts";
import { hashSource } from "./hash.ts";
import { MemoryFs } from "./memory-fs.ts";
import { canonicalPathFor, dirname, joinPath } from "./paths.ts";

describe("hashSource", () => {
  it("is a 64-char lowercase hex digest", () => {
    expect(hashSource("hello")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches known SHA-256 vectors", () => {
    expect(hashSource("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hashSource("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and content-sensitive", () => {
    expect(hashSource("a")).toBe(hashSource("a"));
    expect(hashSource("a")).not.toBe(hashSource("b"));
  });
});

describe("MemoryFs", () => {
  it("reads, writes, lists, and round-trips via toFiles/fromFiles", () => {
    const fs = MemoryFs.fromFiles([
      { path: "/paywall.tsx", content: "P" },
      { path: "/components/a.tsx", content: "A" },
      { path: "/components/b.tsx", content: "B" },
    ]);
    expect(fs.read("/paywall.tsx")).toBe("P");
    expect(fs.exists("/components/a.tsx")).toBe(true);
    expect(fs.exists("/nope")).toBe(false);
    // list is non-recursive, directory-scoped, sorted.
    expect(fs.list("/components")).toEqual(["/components/a.tsx", "/components/b.tsx"]);
    expect(fs.list("/")).toEqual(["/paywall.tsx"]);

    fs.write("/components/c.tsx", "C");
    fs.rename("/components/c.tsx", "/components/d.tsx");
    expect(fs.exists("/components/c.tsx")).toBe(false);
    expect(fs.read("/components/d.tsx")).toBe("C");
    fs.remove("/components/d.tsx");
    expect(fs.exists("/components/d.tsx")).toBe(false);

    const files = fs.toFiles().map((f) => f.path);
    expect(files).toEqual(["/components/a.tsx", "/components/b.tsx", "/paywall.tsx"]);
  });

  it("throws reading a missing file", () => {
    const fs = new MemoryFs();
    expect(() => fs.read("/missing")).toThrow();
  });
});

describe("paths", () => {
  it("dirname of an absolute file", () => {
    expect(dirname("/a/b/c.tsx")).toBe("/a/b");
    expect(dirname("/paywall.tsx")).toBe("/");
  });

  it("joinPath resolves relative specifiers and rejects escapes", () => {
    expect(joinPath("/a/b", "./c")).toBe("/a/b/c");
    expect(joinPath("/a/b", "../c")).toBe("/a/c");
    expect(() => joinPath("/", "../x")).toThrow();
  });

  it("canonicalPathFor strips the entry dir and normalizes to .tsx", () => {
    expect(canonicalPathFor("/", "/components/x.tsx")).toBe("components/x.tsx");
    expect(canonicalPathFor("/app", "/app/components/x.tsx")).toBe("components/x.tsx");
  });
});

describe("diagnostics", () => {
  it("hasErrors is true only with an error severity", () => {
    expect(hasErrors([info("/p", "imports", "i")])).toBe(false);
    expect(hasErrors([warning("/p", "imports", "w")])).toBe(false);
    expect(hasErrors([error("/p", "imports", "e")])).toBe(true);
  });

  it("carries position when supplied", () => {
    const d = error("/p", "types", "boom", { line: 3, column: 5 });
    expect(d.line).toBe(3);
    expect(d.column).toBe(5);
  });
});
