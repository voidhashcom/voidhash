import { describe, expect, test } from "vite-plus/test";

import { MIGRATED, PANEL_REGISTRY } from "./panel-registry";

/**
 * Phase 2 completeness lock: every built-in section is migrated. After the final
 * batch (componentSettings + componentActions), the ONLY non-`builtin` entry is
 * `componentProps` (the Phase 3 component-panel slot); every other entry (all 14
 * built-in sections) is a `builtin` with a filled `definition` AND is present in
 * `MIGRATED`.
 */
describe("panel-registry — Phase 2 completeness", () => {
  test("every entry except componentProps is a builtin with a definition and is MIGRATED", () => {
    for (const entry of PANEL_REGISTRY) {
      if (entry.id === "componentProps") continue;
      expect(entry.source.kind).toBe("builtin");
      // `definition` only exists on the builtin variant — narrow before reading.
      expect(entry.source.kind === "builtin" && entry.source.definition !== undefined).toBe(true);
      expect(MIGRATED.has(entry.id)).toBe(true);
    }
  });

  test("componentProps is the component-panel slot (not migrated, multi-selectable)", () => {
    const componentProps = PANEL_REGISTRY.find((entry) => entry.id === "componentProps");
    expect(componentProps).toBeDefined();
    expect(componentProps!.source.kind).toBe("component-panel");
    expect(MIGRATED.has("componentProps")).toBe(false);
    // Phase 3b: the slot batch-edits a homogeneous component multi-selection.
    expect(componentProps!.multiSelectable).toBe(true);
  });

  test("MIGRATED contains exactly the built-in section ids (all but componentProps)", () => {
    const builtinIds = PANEL_REGISTRY.filter((entry) => entry.id !== "componentProps").map(
      (entry) => entry.id,
    );
    // Every built-in section is migrated, and MIGRATED holds nothing else.
    expect(MIGRATED.size).toBe(builtinIds.length);
    expect(builtinIds.every((id) => MIGRATED.has(id))).toBe(true);
    expect([...MIGRATED].every((id) => builtinIds.includes(id))).toBe(true);
  });
});
