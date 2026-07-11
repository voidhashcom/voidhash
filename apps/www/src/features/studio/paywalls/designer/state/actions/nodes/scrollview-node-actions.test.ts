import { ScrollViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import { createScrollViewNode, updateScrollViewNode } from "./scrollview-node-actions";

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

describe("createScrollViewNode", () => {
  test("applies initialValues and undo/redo round-trips through fn/revert", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);
    const params = {
      initialValues: { name: "Feed", style: { flexDirection: "row" as const } },
      parentId: screenId,
    };

    const result = createScrollViewNode.fn(ctx as never, params);
    expect(result.nodeId).not.toBeNull();
    const nodeId = result.nodeId ?? "";

    const created = findTypedNode(doc.root, nodeId, ScrollViewNode)?.get();
    expect(created?.data.name).toBe("Feed");
    expect(created?.data.style.flexDirection).toBe("row");
    // RN ScrollView defaults materialize on insert.
    expect(created?.data.horizontal).toBe(false);
    expect(created?.data.showsScrollIndicator).toBe(true);

    createScrollViewNode.revert(ctx as never, params, result);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)).toBeUndefined();

    // Redo re-runs fn; the forward run must succeed again on the same params.
    const redone = createScrollViewNode.fn(ctx as never, params);
    expect(redone.nodeId).not.toBeNull();
    expect(findTypedNode(doc.root, redone.nodeId ?? "", ScrollViewNode)?.get()?.data.name).toBe(
      "Feed",
    );
  });

  test("insertAffordance seeds cross-axis stretch + main-axis min size (column parent)", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    // The screen defaults to a column layout → main axis is height.
    const result = createScrollViewNode.fn(ctx as never, {
      initialValues: { name: "Column", style: { flexDirection: "column" as const } },
      insertAffordance: true,
      parentId: screenId,
    });

    const style = findTypedNode(doc.root, result.nodeId ?? "", ScrollViewNode)?.get()?.data.style;
    expect(style?.alignSelf).toBe("stretch");
    expect(style?.minHeight).toBe(100);
    expect(style?.width).toBe("auto");
    expect(style?.height).toBe("auto");
  });

  test("without insertAffordance a scrollView hugs (no stretch / min size)", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    const result = createScrollViewNode.fn(ctx as never, {
      initialValues: { name: "Plain", style: { flexDirection: "column" as const } },
      parentId: screenId,
    });

    const style = findTypedNode(doc.root, result.nodeId ?? "", ScrollViewNode)?.get()?.data.style;
    expect(style?.alignSelf).toBe("auto");
    expect(style?.minHeight).toBeUndefined();
    expect(style?.minWidth).toBeUndefined();
  });
});

describe("updateScrollViewNode", () => {
  test("toggles the horizontal/showsScrollIndicator flags and undo restores them", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const ctx = makeCtx(doc);

    const created = createScrollViewNode.fn(ctx as never, { parentId: screenId });
    const nodeId = created.nodeId ?? "";
    // RN ScrollView defaults.
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.horizontal).toBe(false);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.showsScrollIndicator).toBe(
      true,
    );

    const params = { id: nodeId, updates: { horizontal: true, showsScrollIndicator: false } };
    const result = updateScrollViewNode.fn(ctx as never, params);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.horizontal).toBe(true);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.showsScrollIndicator).toBe(
      false,
    );

    updateScrollViewNode.revert(ctx as never, params, result);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.horizontal).toBe(false);
    expect(findTypedNode(doc.root, nodeId, ScrollViewNode)?.get()?.data.showsScrollIndicator).toBe(
      true,
    );
  });
});
