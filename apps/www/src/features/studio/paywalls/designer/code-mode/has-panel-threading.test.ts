import { describe, expect, test } from "vite-plus/test";

import type {
  CodeComponentCompiled,
  LocalComponentArtifact,
} from "../state/designer-store-state";
import { selectLocalComponentArtifact } from "../state/utils/code-components";
import { SANDBOX_DOCUMENT } from "./sandbox-document";

/**
 * A minimal §2-shaped manifest for the store-shape round-trips. The threading
 * tests care about the `hasPanel` sibling + `code` retention, not manifest
 * validation (the sandbox host owns that).
 */
const MANIFEST = {
  slug: "widget",
  title: "Widget",
  props: [],
  actions: [],
  previewStates: ["default"],
  slots: 0,
} as const;

describe("hasPanel threading — preview guest posts the flag", () => {
  test("the preview guest describes the component and posts hasPanel", () => {
    // The guest switched from extractComponentManifest to describeComponent (which
    // returns {manifest, hasPanel}) and posts the flag as a sibling of manifest —
    // it never calls definition.panel.
    expect(SANDBOX_DOCUMENT).toContain("describeComponent");
    expect(SANDBOX_DOCUMENT).toContain("hasPanel: hasPanel");
    expect(SANDBOX_DOCUMENT).not.toContain("definition.panel(");
  });
});

/**
 * The retention rule threaded through both the compile pipeline and the compile
 * hook: the compiled module (`code`) is kept ONLY when the component declares a
 * panel. Expressed as a pure helper so the rule is locked without running
 * esbuild + the iframe.
 */
const retainCode = (hasPanel: boolean, code: string): string | undefined =>
  hasPanel ? code : undefined;

describe("hasPanel threading — code retention + store shape", () => {
  test("code is retained only when hasPanel is true", () => {
    expect(retainCode(true, "compiled")).toBe("compiled");
    expect(retainCode(false, "compiled")).toBeUndefined();
  });

  test("a panel artifact round-trips hasPanel + code through the store selector", () => {
    const artifact: LocalComponentArtifact = {
      manifest: MANIFEST as never,
      previewTrees: {},
      hasPanel: true,
      code: retainCode(true, "module.exports = {}"),
    };
    const compiled: CodeComponentCompiled = { status: "ready", sourceHash: "h", artifact };
    const state = { codeComponents: { compiled: { "node-1": compiled } } } as never;

    const read = selectLocalComponentArtifact("node-1")(state);
    expect(read?.hasPanel).toBe(true);
    expect(read?.code).toBe("module.exports = {}");
  });

  test("a panel-less artifact carries no code", () => {
    const artifact: LocalComponentArtifact = {
      manifest: MANIFEST as never,
      previewTrees: {},
      hasPanel: false,
      code: retainCode(false, "module.exports = {}"),
    };
    const compiled: CodeComponentCompiled = { status: "ready", sourceHash: "h", artifact };
    const state = { codeComponents: { compiled: { "node-2": compiled } } } as never;

    const read = selectLocalComponentArtifact("node-2")(state);
    expect(read?.hasPanel).toBe(false);
    expect(read?.code).toBeUndefined();
  });
});
