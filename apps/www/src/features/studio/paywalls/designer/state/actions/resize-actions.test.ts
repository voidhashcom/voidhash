import { ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import { findTypedNode } from "../utils/node-proxies";
import { endResize, startResize, updateResize } from "./resize-actions";

const INITIAL_RESIZE_STATE = {
  currentNodeDimensions: {},
  handle: null,
  initialCombinedBounds: null,
  initialNodeDimensions: {},
  isActive: false,
  originalDocumentState: {},
  originalStateOverrideStyles: {},
  startScreenPoint: null,
  stateOverrideTargets: {},
};

function makeResizeCtx(doc: OfflineDesignerDocument, selectedNodeId: string) {
  let storeState: Record<string, unknown> = {
    canvas: {
      boundingBoxes: {
        [selectedNodeId]: { height: 100, width: 100, x: 0, y: 0 },
      },
      scale: 1,
      x: 0,
      y: 0,
    },
    highlightedNodeId: null,
    resize: INITIAL_RESIZE_STATE,
    stateOverrideSelection: {},
  };
  return {
    ctx: {
      dispatch: () => () => undefined,
      getState: () => ({
        ...storeState,
        mimic: {
          document: doc,
          presence: {
            self: {
              selectedNodeIds: [{ id: "entry-0", pos: "a0", value: selectedNodeId }],
              user: { color: "#fff", name: "Tester" },
            },
          },
          snapshot: doc.getSnapshot(),
        },
      }),
      setState: (partial: Record<string, unknown>) => {
        storeState = { ...storeState, ...partial };
      },
      transaction: (fn: never) => doc.transaction(fn),
    },
    getResizeState: () => storeState["resize"] as typeof INITIAL_RESIZE_STATE,
  };
}

describe("endResize undo round trip", () => {
  test("commits resized dimensions and revert restores the originals", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    let flexId = "";
    doc.transaction((root) => {
      const screen = root.findByIdAcrossTree(screenId);
      if (!screen) throw new Error("expected the seeded screen node");
      flexId = screen.children.insertLast({ type: "view" }).id;
    });

    const { ctx, getResizeState } = makeResizeCtx(doc, flexId);
    const styleOf = () => {
      const data = findTypedNode(doc.root, flexId, ViewNode)?.get()?.data;
      if (data === undefined) throw new Error("expected the flex node");
      return data.style;
    };

    startResize.fn(ctx as never, { handle: "se", screenPoint: { x: 0, y: 0 } });
    expect(getResizeState().isActive).toBe(true);

    updateResize.fn(ctx as never, {
      maintainAspectRatio: false,
      screenPoint: { x: 50, y: 30 },
    });
    expect(styleOf().width).toBe(150);
    expect(styleOf().height).toBe(130);

    const result = endResize.fn(ctx as never, {});
    expect(getResizeState().isActive).toBe(false);
    expect(result.finalDimensions[flexId]).toEqual({ height: 130, type: "view", width: 150 });
    expect(styleOf().width).toBe(150);
    expect(styleOf().height).toBe(130);
    // Resizing a container-stretched child (alignSelf "auto", filling the cross
    // axis by default) writes a numeric size and leaves alignSelf untouched — a
    // numeric size defeats stretch on its own.
    expect(styleOf().alignSelf).toBe("auto");

    // The pre-resize snapshot materializes the schema defaults ("auto" = hug),
    // so the captured originals — and the undo restore — are those values.
    endResize.revert(ctx as never, {}, result);
    expect(styleOf().width).toBe("auto");
    expect(styleOf().height).toBe("auto");
  });
});
