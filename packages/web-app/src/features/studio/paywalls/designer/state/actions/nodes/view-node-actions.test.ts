import { ViewNode } from "@voidhash/mimic-schema";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import { createViewNode } from "./view-node-actions";

function makeCtx(doc: OfflineDesignerDocument) {
  let storeState: Record<string, unknown> = {
    mimic: { document: doc, snapshot: doc.getSnapshot() },
    stateOverrideSelection: {},
  };
  return {
    dispatch: () => () => undefined,
    getState: () => ({
      ...storeState,
      mimic: { document: doc, snapshot: doc.getSnapshot() },
    }),
    setState: (partial: Record<string, unknown>) => {
      storeState = { ...storeState, ...partial };
    },
    transaction: (fn: never) => doc.transaction(fn),
  };
}

describe("createViewNode", () => {
  test("applies initialValues and undo/redo round-trips through fn/revert", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);
    const params = {
      initialValues: { name: "Row", style: { flexDirection: "row" as const } },
      parentId: screenId,
    };

    const result = createViewNode.fn(ctx as never, params);
    expect(result.nodeId).not.toBeNull();
    const nodeId = result.nodeId ?? "";

    const created = findTypedNode(doc.root, nodeId, ViewNode)?.get();
    expect(created?.data.name).toBe("Row");
    expect(created?.data.style.flexDirection).toBe("row");

    createViewNode.revert(ctx as never, params, result);
    expect(findTypedNode(doc.root, nodeId, ViewNode)).toBeUndefined();

    // Redo re-runs fn; the forward run must succeed again on the same params.
    const redone = createViewNode.fn(ctx as never, params);
    expect(redone.nodeId).not.toBeNull();
    expect(findTypedNode(doc.root, redone.nodeId ?? "", ViewNode)?.get()?.data.name).toBe("Row");
  });

  test("insertAffordance seeds cross-axis stretch + main-axis min size (column parent)", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    // The screen defaults to a column layout → main axis is height.
    const result = createViewNode.fn(ctx as never, {
      initialValues: { name: "Column", style: { flexDirection: "column" as const } },
      insertAffordance: true,
      parentId: screenId,
    });

    const style = findTypedNode(doc.root, result.nodeId ?? "", ViewNode)?.get()?.data.style;
    expect(style?.alignSelf).toBe("stretch");
    expect(style?.minHeight).toBe(100);
    expect(style?.width).toBe("auto");
    expect(style?.height).toBe("auto");
  });

  test("insertAffordance uses main-axis minWidth under a row parent", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    // Seed a row-direction parent view, then insert into it.
    let rowParentId = "";
    doc.transaction((root) => {
      const screen = root.findByIdAcrossTree(screenId);
      if (!screen) return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
      rowParentId = screen.children.insertLast({ type: "view", style: { flexDirection: "row" } }).id;
    });

    const result = createViewNode.fn(ctx as never, {
      initialValues: { name: "Row", style: { flexDirection: "row" as const } },
      insertAffordance: true,
      parentId: rowParentId,
    });

    const style = findTypedNode(doc.root, result.nodeId ?? "", ViewNode)?.get()?.data.style;
    expect(style?.alignSelf).toBe("stretch");
    expect(style?.minWidth).toBe(100);
  });

  test("without insertAffordance a view hugs (no stretch / min size)", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    const result = createViewNode.fn(ctx as never, {
      initialValues: { name: "Plain", style: { flexDirection: "column" as const } },
      parentId: screenId,
    });

    const style = findTypedNode(doc.root, result.nodeId ?? "", ViewNode)?.get()?.data.style;
    expect(style?.alignSelf).toBe("auto");
    expect(style?.minHeight).toBeUndefined();
    expect(style?.minWidth).toBeUndefined();
  });
});
