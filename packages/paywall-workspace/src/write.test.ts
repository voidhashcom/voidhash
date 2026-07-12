import { applyBatch, type TreeValue } from "@voidhash/mimic-core";
import { PaywallDesignerDocument } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import { readComponentDefinitions } from "./snapshot.ts";
import {
  lowerComponentDelete,
  lowerComponentMove,
  uniqueComponentFileName,
  validateComponentFileName,
} from "./write.ts";

const enc = (input: unknown): TreeValue =>
  PaywallDesignerDocument.encode(input as never) as TreeValue;
const decode = (tree: TreeValue): readonly SnapshotNode[] =>
  PaywallDesignerDocument.decode(tree)! as readonly SnapshotNode[];

const docWithComponent = (source: string): TreeValue =>
  enc([
    {
      type: "root",
      name: "Paywall",
      children: [
        { type: "screen", name: "Main" },
        {
          type: "library",
          children: [{ type: "codeComponent", path: "components/hero.tsx", source }],
        },
      ],
    },
  ]);

/**
 * A document root whose library holds two `codeComponent` definitions plus a
 * `component` INSTANCE node under the screen referencing the first one (via
 * `componentPath`) — the shape a delete must NOT cascade into, and a move MUST
 * re-point.
 */
const docWithTwoComponentsAndInstance = (): TreeValue =>
  enc([
    {
      type: "root",
      name: "Paywall",
      children: [
        {
          type: "screen",
          name: "Main",
          children: [
            {
              type: "component",
              componentSource: "local",
              componentPath: "components/hero.tsx",
            },
          ],
        },
        {
          type: "library",
          children: [
            {
              type: "codeComponent",
              path: "components/hero.tsx",
              source: "export const Hero = () => null;",
            },
            {
              type: "codeComponent",
              path: "components/promo.tsx",
              source: "export const Promo = () => null;",
            },
          ],
        },
      ],
    },
  ]);

/** The doc-relative path of a component instance node (local instances only). */
const instanceComponentPath = (tree: TreeValue): string | undefined => {
  const node = tree.nodes.find(
    (n) => n.value.fields.type?.kind === "string" && n.value.fields.type.value === "component",
  );
  const field = node?.value.fields.componentPath;
  return field && field.kind === "string" ? field.value : undefined;
};

describe("lowerComponentMove", () => {
  test("repaths the definition AND re-points every local instance", () => {
    const live = docWithTwoComponentsAndInstance();
    const result = lowerComponentMove(live, "components/hero.tsx", "components/hero-banner.tsx");
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;

    const applied = applyBatch(live, result.commands) as TreeValue;
    // The definition is at the new path; the old path is gone.
    expect(readComponentDefinitions(decode(applied)).map((d) => d.path).sort()).toEqual([
      "components/hero-banner.tsx",
      "components/promo.tsx",
    ]);
    // The instance node was re-pointed (no orphaning).
    expect(instanceComponentPath(applied)).toBe("components/hero-banner.tsx");
  });

  test("re-points instances in one command batch (no orphaned reference)", () => {
    const live = docWithTwoComponentsAndInstance();
    const result = lowerComponentMove(live, "components/hero.tsx", "components/hero-banner.tsx");
    if (result.kind !== "commands") throw new Error("expected commands");
    // The single reconcile batch carries both the definition repath and the
    // instance re-point — applying it leaves no reference to the old path.
    const applied = applyBatch(live, result.commands) as TreeValue;
    const referencesOldPath = applied.nodes.some(
      (n) =>
        n.value.fields.componentPath?.kind === "string" &&
        n.value.fields.componentPath.value === "components/hero.tsx",
    );
    const definesOldPath = applied.nodes.some(
      (n) =>
        n.value.fields.type?.kind === "string" &&
        n.value.fields.type.value === "codeComponent" &&
        n.value.fields.path?.kind === "string" &&
        n.value.fields.path.value === "components/hero.tsx",
    );
    expect(referencesOldPath).toBe(false);
    expect(definesOldPath).toBe(false);
  });

  test("a move to the current path is a zero-command no-op", () => {
    const live = docWithComponent("export const Hero = () => null;");
    const result = lowerComponentMove(live, "components/hero.tsx", "components/hero.tsx");
    expect(result).toEqual({ kind: "commands", commands: [] });
  });

  test("rejects a move whose source path has no component", () => {
    const live = docWithComponent("export const Hero = () => null;");
    const result = lowerComponentMove(live, "components/ghost.tsx", "components/ghost-2.tsx");
    expect(result.kind).toBe("rejected");
  });

  test("rejects a move to a path that already exists", () => {
    const live = docWithTwoComponentsAndInstance();
    const result = lowerComponentMove(live, "components/hero.tsx", "components/promo.tsx");
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.diagnostics[0]!.message).toContain("already exists");
    }
  });

  test("rejects a move to an invalid file name", () => {
    const live = docWithComponent("export const Hero = () => null;");
    const result = lowerComponentMove(live, "components/hero.tsx", "components/hero.ts");
    expect(result.kind).toBe("rejected");
  });
});
describe("lowerComponentDelete", () => {
  test("removes only the target codeComponent node, leaving other definitions", () => {
    const live = docWithTwoComponentsAndInstance();
    const result = lowerComponentDelete(live, "components/promo.tsx");
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;

    const applied = applyBatch(live, result.commands) as TreeValue;
    const definitions = readComponentDefinitions(decode(applied));
    expect(definitions.map((d) => d.path)).toEqual(["components/hero.tsx"]);
  });

  test("does NOT cascade-delete component instance nodes referencing the deleted component", () => {
    const live = docWithTwoComponentsAndInstance();
    const result = lowerComponentDelete(live, "components/hero.tsx");
    if (result.kind !== "commands") throw new Error("expected commands");

    const applied = applyBatch(live, result.commands) as TreeValue;
    // The `component` INSTANCE node under the screen survives (degrades to a
    // placeholder in the designer) — matching the browser's removeCodeComponent.
    const instanceSurvives = applied.nodes.some(
      (node) =>
        node.value.fields.type?.kind === "string" && node.value.fields.type.value === "component",
    );
    expect(instanceSurvives).toBe(true);
    // Only the definition is gone.
    expect(readComponentDefinitions(decode(applied)).map((d) => d.path)).toEqual([
      "components/promo.tsx",
    ]);
  });

  test("rejects an unknown path", () => {
    const live = docWithComponent("export const Hero = () => null;");
    const result = lowerComponentDelete(live, "components/ghost.tsx");
    expect(result.kind).toBe("rejected");
  });
});

describe("validateComponentFileName", () => {
  test("accepts a well-formed .tsx basename", () => {
    expect(validateComponentFileName("hero.tsx")).toBeUndefined();
    expect(validateComponentFileName("pricing-option.tsx")).toBeUndefined();
    expect(validateComponentFileName("pricing.card.tsx")).toBeUndefined();
  });

  test("rejects a missing/wrong extension", () => {
    expect(validateComponentFileName("hero")).toContain(".tsx");
    expect(validateComponentFileName("hero.ts")).toContain(".tsx");
  });

  test("rejects an empty base name", () => {
    expect(validateComponentFileName(".tsx")).toContain("base name");
  });

  test("rejects path separators and traversal", () => {
    expect(validateComponentFileName("sub/hero.tsx")).toContain("path separator");
    expect(validateComponentFileName("sub\\hero.tsx")).toContain("path separator");
    expect(validateComponentFileName("..tsx")).toContain("..");
  });

  test("rejects unsupported characters", () => {
    expect(validateComponentFileName("hero widget.tsx")).toContain("unsupported");
    expect(validateComponentFileName("héro.tsx")).toContain("unsupported");
  });
});

describe("uniqueComponentFileName", () => {
  test("returns the base name when there is no collision", () => {
    expect(uniqueComponentFileName("hero.tsx", ["promo.tsx"])).toBe("hero.tsx");
  });

  test("appends -2, -3 before the extension on collision", () => {
    expect(uniqueComponentFileName("hero.tsx", ["hero.tsx"])).toBe("hero-2.tsx");
    expect(uniqueComponentFileName("hero.tsx", ["hero.tsx", "hero-2.tsx"])).toBe("hero-3.tsx");
  });

  test("uniqueness is case-insensitive", () => {
    expect(uniqueComponentFileName("Hero.tsx", ["hero.tsx"])).toBe("Hero-2.tsx");
  });

  test("treats an extensionless base as a stem", () => {
    expect(uniqueComponentFileName("hero", [])).toBe("hero.tsx");
    expect(uniqueComponentFileName("hero", ["hero.tsx"])).toBe("hero-2.tsx");
  });
});
