import { formatComponentPath, formatCompositionPath } from "@voidhash/paywall-workspace";
import { describe, expect, test } from "vite-plus/test";

import { displayToolPath, resolveToolPath } from "./tool-paths";

const SLUG = "checkout";

describe("resolveToolPath", () => {
  test("resolves the composition by its bare name", () => {
    expect(resolveToolPath(SLUG, "paywall.tsx")).toEqual({
      ok: true,
      path: formatCompositionPath(SLUG),
    });
  });

  test("resolves a component by its relative name", () => {
    expect(resolveToolPath(SLUG, "components/hero.tsx")).toEqual({
      ok: true,
      path: formatComponentPath(SLUG, "hero.tsx"),
    });
  });

  test("strips a leading ./", () => {
    expect(resolveToolPath(SLUG, "./paywall.tsx")).toEqual({
      ok: true,
      path: formatCompositionPath(SLUG),
    });
  });

  test("accepts an already-absolute path for THIS paywall", () => {
    const absolute = formatComponentPath(SLUG, "hero.tsx");
    expect(resolveToolPath(SLUG, absolute)).toEqual({ ok: true, path: absolute });
  });

  test("rejects an absolute path for a DIFFERENT paywall", () => {
    const result = resolveToolPath(SLUG, formatComponentPath("other", "hero.tsx"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("open paywall");
    }
  });

  test("rejects the reserved /components/* namespace", () => {
    const result = resolveToolPath(SLUG, "/components/shared.tsx");
    expect(result.ok).toBe(false);
  });

  test("rejects a component name without .tsx", () => {
    const result = resolveToolPath(SLUG, "components/hero");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(".tsx");
    }
  });

  test("rejects a nested component path", () => {
    expect(resolveToolPath(SLUG, "components/nested/hero.tsx").ok).toBe(false);
  });

  test("rejects an unknown top-level name", () => {
    expect(resolveToolPath(SLUG, "index.ts").ok).toBe(false);
  });

  test("rejects an empty path", () => {
    expect(resolveToolPath(SLUG, "   ").ok).toBe(false);
  });
});

describe("displayToolPath", () => {
  test("shows the composition as paywall.tsx", () => {
    expect(displayToolPath(formatCompositionPath(SLUG))).toBe("paywall.tsx");
  });

  test("shows a component as components/<name>.tsx", () => {
    expect(displayToolPath(formatComponentPath(SLUG, "hero.tsx"))).toBe("components/hero.tsx");
  });

  test("returns the raw path for an unrecognized input", () => {
    expect(displayToolPath("/weird/path")).toBe("/weird/path");
  });
});
