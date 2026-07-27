import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import {
  codeComponentDefinitions,
  componentDisplayName,
  componentFileName,
  selectCodeComponentNodes,
} from "../utils/code-components";
import { insertCodeComponent } from "../utils/code-component-writes";
import { createCodeComponent, renameComponentFile } from "./code-component-actions";
import { insertLocalComponentNode, repairLocalComponentReference } from "./nodes/component-node-actions";

/**
 * Minimal command context over an offline document: `getState` exposes the live
 * mimic snapshot + a mutable `codeComponents` slice; `dispatch` re-enters a
 * command's `fn`; `setState` shallow-merges. These design-mode document actions
 * only need `compiled`/`dirty` stubbed. The `compiled` map is empty — these
 * actions never read compiled artifacts (`insertLocalComponentNode` only prefills
 * props when given a `manifest`, which these tests do not).
 */
function makeCtx(doc: OfflineDesignerDocument) {
  let storeState: { codeComponents: Record<string, unknown> } = {
    codeComponents: {
      compiled: {},
      openTabs: [] as string[],
      activeTabPath: null,
      dirty: {} as Record<string, boolean>,
    },
  };
  const ctx = {
    dispatch:
      <TParams, TReturn>(command: { fn: (c: unknown, p: TParams) => TReturn }) =>
      (params: TParams): TReturn =>
        command.fn(ctx, params),
    getState: () => ({
      ...storeState,
      mimic: { document: doc, snapshot: doc.getSnapshot() },
    }),
    setState: (partial: Record<string, unknown>) => {
      storeState = { ...storeState, ...partial };
    },
  };
  return ctx;
}

/** Reads the current code-component definitions from the live document. */
function definitions(doc: OfflineDesignerDocument) {
  return codeComponentDefinitions(selectCodeComponentNodes({ mimic: { snapshot: doc.getSnapshot() } } as never));
}

/** Reads a component instance node's `componentPath` from the live snapshot. */
function instanceComponentPath(doc: OfflineDesignerDocument, nodeId: string): string | undefined {
  const node = doc.root.findByIdAcrossTree(nodeId);
  return node?.get()?.data?.componentPath as string | undefined;
}

describe("componentFileName / componentDisplayName", () => {
  test("componentFileName returns the basename with extension", () => {
    expect(componentFileName("components/pricing-option.tsx")).toBe("pricing-option.tsx");
    expect(componentFileName("pricing-option.tsx")).toBe("pricing-option.tsx");
  });

  test("componentDisplayName title-cases the stem", () => {
    expect(componentDisplayName("components/pricing-option.tsx")).toBe("Pricing Option");
    expect(componentDisplayName("components/hero_banner.tsx")).toBe("Hero Banner");
    expect(componentDisplayName("components/widget.tsx")).toBe("Widget");
  });
});

describe("createCodeComponent", () => {
  test("defaults to untitled.tsx and uniquifies case-insensitively", () => {
    const doc = createOfflineDesignerDocument();
    const ctx = makeCtx(doc);

    createCodeComponent.fn(ctx as never, {});
    createCodeComponent.fn(ctx as never, {});
    // A case-variant collides case-insensitively → disambiguated, but the
    // requested stem's own casing is preserved.
    createCodeComponent.fn(ctx as never, { fileName: "UNTITLED.tsx" });

    const paths = definitions(doc).map((definition) => definition.path);
    expect(paths).toEqual([
      "components/untitled.tsx",
      "components/untitled-2.tsx",
      "components/UNTITLED-3.tsx",
    ]);
  });

  test("appends .tsx to a bare file name", () => {
    const doc = createOfflineDesignerDocument();
    const ctx = makeCtx(doc);

    createCodeComponent.fn(ctx as never, { fileName: "hero" });
    expect(definitions(doc)[0]?.path).toBe("components/hero.tsx");
  });

  test("undo removes the created definition", () => {
    const doc = createOfflineDesignerDocument();
    const ctx = makeCtx(doc);

    const result = createCodeComponent.fn(ctx as never, { fileName: "hero.tsx" });
    expect(definitions(doc)).toHaveLength(1);

    createCodeComponent.revert(ctx as never, { fileName: "hero.tsx" }, result);
    expect(definitions(doc)).toHaveLength(0);
  });
});

describe("renameComponentFile", () => {
  /** Seeds a definition + one local instance referencing it. Returns their ids. */
  function seedDefinitionWithInstance(doc: OfflineDesignerDocument, path: string) {
    let definitionId = "";
    doc.transaction((root) => {
      const id = insertCodeComponent(root, { path, source: "// src" });
      if (id === null) throw new Error("failed to insert definition");
      definitionId = id;
    });
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);
    const { nodeId } = insertLocalComponentNode.fn(ctx as never, {
      parentId: screenId,
      componentPath: path,
    });
    if (nodeId === null) throw new Error("failed to insert instance");
    return { definitionId, instanceId: nodeId };
  }

  test("re-points every local instance and undo restores both", () => {
    const doc = createOfflineDesignerDocument();
    const { definitionId, instanceId } = seedDefinitionWithInstance(doc, "components/widget.tsx");
    const ctx = makeCtx(doc);

    const result = renameComponentFile.fn(ctx as never, {
      id: definitionId,
      fileName: "renamed.tsx",
    });

    expect(definitions(doc)[0]?.path).toBe("components/renamed.tsx");
    expect(instanceComponentPath(doc, instanceId)).toBe("components/renamed.tsx");
    expect(result.instanceIds).toContain(instanceId);

    renameComponentFile.revert(ctx as never, { id: definitionId, fileName: "renamed.tsx" }, result);

    expect(definitions(doc)[0]?.path).toBe("components/widget.tsx");
    expect(instanceComponentPath(doc, instanceId)).toBe("components/widget.tsx");
  });

  test("rejects a case-insensitive collision with another file (no-op)", () => {
    const doc = createOfflineDesignerDocument();
    doc.transaction((root) => {
      insertCodeComponent(root, { path: "components/a.tsx", source: "" });
    });
    const { definitionId } = seedDefinitionWithInstance(doc, "components/b.tsx");
    const ctx = makeCtx(doc);

    const result = renameComponentFile.fn(ctx as never, { id: definitionId, fileName: "A.tsx" });

    expect(result.previousPath).toBeNull();
    const paths = definitions(doc)
      .map((definition) => definition.path)
      .sort();
    expect(paths).toEqual(["components/a.tsx", "components/b.tsx"]);
  });

  test("rejects an invalid file name (no extension, no-op)", () => {
    const doc = createOfflineDesignerDocument();
    const { definitionId } = seedDefinitionWithInstance(doc, "components/widget.tsx");
    const ctx = makeCtx(doc);

    const result = renameComponentFile.fn(ctx as never, { id: definitionId, fileName: "widget" });
    expect(result.previousPath).toBeNull();
    expect(definitions(doc)[0]?.path).toBe("components/widget.tsx");
  });
});

describe("repairLocalComponentReference", () => {
  test("re-points an instance's componentPath and undo restores it", () => {
    const doc = createOfflineDesignerDocument();
    doc.transaction((root) => {
      insertCodeComponent(root, { path: "components/target.tsx", source: "" });
    });
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);
    const { nodeId } = insertLocalComponentNode.fn(ctx as never, {
      parentId: screenId,
      componentPath: "components/missing.tsx",
    });
    if (nodeId === null) throw new Error("failed to insert instance");

    const result = repairLocalComponentReference.fn(ctx as never, {
      nodeId,
      componentPath: "components/target.tsx",
    });
    expect(instanceComponentPath(doc, nodeId)).toBe("components/target.tsx");

    repairLocalComponentReference.revert(
      ctx as never,
      { nodeId, componentPath: "components/target.tsx" },
      result,
    );
    expect(instanceComponentPath(doc, nodeId)).toBe("components/missing.tsx");
  });
});
