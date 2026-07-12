import { parseComponentManifest } from "@voidhash/paywalls/schema";
import { describe, expect, test } from "vite-plus/test";

import { BUILTIN_COMPONENTS, getBuiltinComponent, listBuiltinComponents } from "./registry.ts";

describe("builtin component registry", () => {
  test("keys every definition by its own slug", () => {
    for (const [key, definition] of Object.entries(BUILTIN_COMPONENTS)) {
      expect(definition.slug).toBe(key);
    }
  });

  test("getBuiltinComponent resolves known slugs and misses unknown ones", () => {
    const badge = getBuiltinComponent("sample-badge");
    expect(badge).toBeDefined();
    expect(badge!.name).toBe("Sample Badge");
    expect(getBuiltinComponent("no-such-builtin")).toBeUndefined();
  });

  test("listBuiltinComponents returns every registry entry", () => {
    const all = listBuiltinComponents();
    expect(all.length).toBe(Object.keys(BUILTIN_COMPONENTS).length);
    expect(all.map((definition) => definition.slug)).toContain("sample-badge");
  });

  test("every manifest validates as a §2 component manifest", () => {
    for (const definition of listBuiltinComponents()) {
      const result = parseComponentManifest(definition.manifest);
      expect(result.ok, `manifest of "${definition.slug}" must validate`).toBe(true);
    }
  });

  test("defaultProps only seed props the manifest declares", () => {
    for (const definition of listBuiltinComponents()) {
      for (const prop of definition.defaultProps) {
        expect(
          definition.manifest.props[prop.name],
          `default prop "${prop.name}" of "${definition.slug}" must exist in its manifest`,
        ).toBeDefined();
      }
    }
  });
});
