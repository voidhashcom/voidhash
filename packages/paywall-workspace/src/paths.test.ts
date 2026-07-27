import { describe, expect, test } from "vite-plus/test";

import {
  docRelativeComponentPath,
  docRelativeFromFileName,
  fileNameFromDocRelative,
  formatComponentPath,
  formatCompositionPath,
  formatWorkspacePath,
  parseWorkspacePath,
  workspacePathForDocRelative,
  type WorkspacePath,
} from "./paths.ts";

/**
 * Contract tests locking the workspace path vocabulary. Tools, MCP resources,
 * and the editor file tree all agree on exactly this scheme — drift here would
 * silently break addressing across surfaces. A component is identified by its
 * FILE NAME (`<basename>.tsx`), matching the canonical document-relative path
 * (`components/<basename>.tsx`) the mimic nodes store.
 */
describe("workspace path vocabulary", () => {
  test("formats a composition path", () => {
    expect(formatCompositionPath("trial")).toBe("/paywalls/trial/paywall.tsx");
  });

  test("formats a component path from a file name (extension included)", () => {
    expect(formatComponentPath("trial", "hero.tsx")).toBe(
      "/paywalls/trial/components/hero.tsx",
    );
  });

  test("parses a composition path", () => {
    const result = parseWorkspacePath("/paywalls/trial/paywall.tsx");
    expect(result).toEqual({ ok: true, path: { kind: "composition", paywallSlug: "trial" } });
  });

  test("parses a component path, keeping the .tsx in fileName", () => {
    const result = parseWorkspacePath("/paywalls/trial/components/hero.tsx");
    expect(result).toEqual({
      ok: true,
      path: { kind: "component", paywallSlug: "trial", fileName: "hero.tsx" },
    });
  });

  test.each<WorkspacePath>([
    { kind: "composition", paywallSlug: "trial" },
    { kind: "component", paywallSlug: "trial", fileName: "hero.tsx" },
    { kind: "component", paywallSlug: "trial", fileName: "pricing-option.tsx" },
  ])("format ∘ parse round-trips %o", (path) => {
    const result = parseWorkspacePath(formatWorkspacePath(path));
    expect(result.ok && result.path).toEqual(path);
  });

  test("reserves the top-level /components namespace (not supported yet)", () => {
    const result = parseWorkspacePath("/components/shared.tsx");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("reserved");
    }
  });

  test.each([
    ["paywalls/trial/paywall.tsx", "relative path (no leading slash)"],
    ["/unknown/trial/paywall.tsx", "unknown top-level dir"],
    ["/paywalls/trial", "no file"],
    ["/paywalls/trial/other.tsx", "unrecognized file"],
    ["/paywalls/trial/components/hero.ts", "wrong extension"],
    ["/paywalls//paywall.tsx", "empty paywall slug"],
    ["/paywalls/trial/components/.tsx", "empty component file name"],
  ])("rejects %j as malformed (%s)", (path) => {
    const result = parseWorkspacePath(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed");
    }
  });
});

describe("doc-relative ↔ workspace-absolute mapping", () => {
  test("docRelativeFromFileName wraps the basename under components/", () => {
    expect(docRelativeFromFileName("hero.tsx")).toBe("components/hero.tsx");
  });

  test("fileNameFromDocRelative strips the components/ prefix", () => {
    expect(fileNameFromDocRelative("components/hero.tsx")).toBe("hero.tsx");
  });

  test("docRelativeComponentPath drops the /paywalls/<slug>/ prefix", () => {
    expect(docRelativeComponentPath("/paywalls/trial/components/pricing-option.tsx")).toBe(
      "components/pricing-option.tsx",
    );
  });

  test("docRelativeComponentPath is undefined for a non-component path", () => {
    expect(docRelativeComponentPath("/paywalls/trial/paywall.tsx")).toBeUndefined();
    expect(docRelativeComponentPath("/nope")).toBeUndefined();
  });

  test("workspacePathForDocRelative re-attaches the paywall directory", () => {
    expect(workspacePathForDocRelative("trial", "components/hero.tsx")).toBe(
      "/paywalls/trial/components/hero.tsx",
    );
  });

  test("workspace ↔ doc-relative round-trips", () => {
    const workspace = "/paywalls/trial/components/pricing-option.tsx";
    const docRelative = docRelativeComponentPath(workspace)!;
    expect(workspacePathForDocRelative("trial", docRelative)).toBe(workspace);
  });
});
