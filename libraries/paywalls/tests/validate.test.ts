import { describe, expect, test } from "vitest";

import { parseComponentManifest } from "../src/schema/validate";

/**
 * A minimal valid §2 manifest builder. Tests spread over it and override the
 * one field under test so each fixture isolates a single rejection reason.
 */
const validManifest = () => ({
  manifestVersion: 1,
  id: "pro-card",
  props: {
    heading: { kind: "string", optional: false },
    product: { kind: "ref", refType: "product", optional: false },
    child: { kind: "component", optional: true },
    bullets: { kind: "array", item: { kind: "string" }, optional: true },
  },
});

describe("component manifest validator — prop `default` allowance", () => {
  test("accepts `default` on string/number/boolean/select/image/array props", () => {
    const manifest = {
      manifestVersion: 1,
      id: "c",
      props: {
        s: { kind: "string", default: "x" },
        n: { kind: "number", default: 3 },
        b: { kind: "boolean", default: true },
        sel: { kind: "select", options: ["a", "b"], default: "a" },
        img: { kind: "image", default: "https://x/y.png" },
        arr: { kind: "array", item: { kind: "string" }, default: ["a"] },
      },
    };
    expect(parseComponentManifest(manifest).ok).toBe(true);
  });

  test("rejects `default` on a ref prop (server has no default field for ref)", () => {
    const manifest = {
      ...validManifest(),
      props: { product: { kind: "ref", refType: "product", default: "p" } },
    };
    expect(parseComponentManifest(manifest).ok).toBe(false);
  });

  test("rejects `default` on a component prop (server has no default field for component)", () => {
    const manifest = {
      ...validManifest(),
      props: { child: { kind: "component", default: "z" } },
    };
    expect(parseComponentManifest(manifest).ok).toBe(false);
  });
});

describe("component manifest validator — array item common fields", () => {
  test("accepts well-typed common fields on an array item (mirrors the server)", () => {
    const manifest = {
      ...validManifest(),
      props: {
        bullets: {
          kind: "array",
          item: { kind: "string", label: "L", description: "D", optional: true, default: "x" },
        },
      },
    };
    expect(parseComponentManifest(manifest).ok).toBe(true);
  });

  test("rejects a malformed common field on an array item (non-boolean `optional`)", () => {
    const manifest = {
      ...validManifest(),
      props: { bullets: { kind: "array", item: { kind: "string", optional: "yes" } } },
    };
    expect(parseComponentManifest(manifest).ok).toBe(false);
  });

  test("rejects a wrong-typed `default` on an array item", () => {
    const manifest = {
      ...validManifest(),
      props: { bullets: { kind: "array", item: { kind: "number", default: "not-a-number" } } },
    };
    expect(parseComponentManifest(manifest).ok).toBe(false);
  });
});
