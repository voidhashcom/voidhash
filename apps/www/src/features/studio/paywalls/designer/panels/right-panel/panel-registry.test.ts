import { describe, expect, test } from "vite-plus/test";

import { PANEL_REGISTRY } from "./panel-registry";

describe("panel registry", () => {
  test("every entry except componentProps has a built-in definition", () => {
    for (const entry of PANEL_REGISTRY) {
      if (entry.id === "componentProps") continue;
      expect(entry.source.kind).toBe("builtin");
      expect(entry.source.kind === "builtin" && typeof entry.source.definition === "function").toBe(
        true,
      );
    }
  });

  test("componentProps uses the component panel host and supports multi-selection", () => {
    const componentProps = PANEL_REGISTRY.find((entry) => entry.id === "componentProps");
    expect(componentProps).toBeDefined();
    expect(componentProps!.source.kind).toBe("component-panel");
    expect(componentProps!.multiSelectable).toBe(true);
  });
});
