// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateShapeNode } from "../../../state/actions";
import type { PanelNode } from "../../../panel-runtime/schema";
import { ShapeLayoutPanel } from "./shape-layout-panel";
import {
  createOfflineDesignerDocument,
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
let restoreWatch: (() => void) | undefined;
afterEach(() => {
  restoreWatch?.();
  restoreWatch = undefined;
  harness?.dispose();
  harness = undefined;
});

function mount(style: Record<string, unknown>) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, [{ type: "shape", style }]);
  const calls: ActionCall<{ id: string; updates: { style: Record<string, unknown> } }>[] = [];
  restoreWatch = watchAction(updateShapeNode as never, calls as never);
  harness = mountPanelDefinition(ShapeLayoutPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

const dimensionFields = (root: PanelNode) => findNodesByType(root, "dimensionField");

describe("ShapeLayoutPanel — structure", () => {
  test("a shape renders the Layout section with two dimension fields and NO resets", () => {
    const { harness } = mount({ width: 100, height: 80 });
    const root = harness.tree().root;
    expect(findNodeByType(root, "section")?.props.title).toBe("Layout");
    expect(dimensionFields(root)).toHaveLength(2);
    expect(dimensionFields(root).map((f) => f.props.axis)).toEqual(["width", "height"]);
    // Shapes have no state overrides → no reset affordances anywhere in the tree.
    expect(findNodeByType(root, "resetAffordance")).toBeUndefined();
  });

  test("stored custom width flows to the field value; mode is custom", () => {
    const { harness } = mount({ width: 140, height: 90 });
    const [w] = dimensionFields(harness.tree().root);
    expect(w!.props.mode).toBe("custom");
    expect(w!.props.value).toBe(140);
  });
});

describe("ShapeLayoutPanel — dimensions via updateShapeNode", () => {
  test("typing a custom width is a DRAFT that calls updateShapeNode with the width", () => {
    const { harness, nodeIds, calls } = mount({ width: 100, height: 80 });
    const [w] = dimensionFields(harness.tree().root);
    expect(harness.draftActive()).toBe(false);
    harness.dispatch(w!.id, "onChange", ["175"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      id: nodeIds[0],
      updates: { style: { width: 175 } },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(w!.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
  });

  test("a committed custom width persists on the shape node's style", async () => {
    const { harness, nodeIds } = mount({ width: 100, height: 80 });
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onChange", ["210"]);
    harness.dispatch(w!.id, "onCommit");
    await flush();
    // updateShapeNode writes to the document, so the committed style reflects it.
    expect(harness.nodeStyle(nodeIds[0]!).width).toBe(210);
  });

  test("width hug (menu) is a DIRECT updateShapeNode write of width auto + alignSelf flex-start", async () => {
    const { harness, nodeIds, calls } = mount({ width: 120, height: 80 });
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onModeChange", ["hug"]);
    // Parent (screen) defaults to column and stretches its children → width is the
    // stretch axis → Hug opts out with alignSelf "flex-start".
    expect(calls[0]!.params).toEqual({
      id: nodeIds[0],
      updates: { style: { width: "auto", alignSelf: "flex-start" } },
    });
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
    await flush();
    expect(harness.nodeStyle(nodeIds[0]!).width).toBe("auto");
  });

  test("width fill (menu) sets width auto + alignSelf stretch (stretch axis)", () => {
    const { harness, nodeIds, calls } = mount({ width: 120, height: 80 });
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onModeChange", ["fill"]);
    expect(calls[0]!.params).toEqual({
      id: nodeIds[0],
      updates: { style: { width: "auto", alignSelf: "stretch" } },
    });
  });

  test("height fill (menu) sets flex:1 (main axis under a column parent)", () => {
    const { harness, nodeIds, calls } = mount({ width: 120, height: 80 });
    const [, h] = dimensionFields(harness.tree().root);
    harness.dispatch(h!.id, "onModeChange", ["fill"]);
    expect(calls[0]!.params).toEqual({
      id: nodeIds[0],
      updates: { style: { height: "auto", flex: 1 } },
    });
  });

  test("height custom (menu) from fill clears flex (main axis)", () => {
    const { harness, nodeIds, calls } = mount({ width: 120, height: "auto", flex: 1 });
    const [, h] = dimensionFields(harness.tree().root);
    expect(h!.props.mode).toBe("fill");
    harness.dispatch(h!.id, "onModeChange", ["custom"]);
    expect(calls[0]!.params).toEqual({
      id: nodeIds[0],
      updates: { style: { height: 100, flex: undefined } },
    });
  });

  test("bounding box flows into the shape dimension field's computed prop", async () => {
    const { harness, nodeIds } = mount({ width: 100, height: 80 });
    act(() => {
      harness.store.setState((state) => ({
        ...state,
        canvas: {
          ...state.canvas,
          boundingBoxes: {
            ...state.canvas.boundingBoxes,
            [nodeIds[0]!]: { x: 0, y: 0, width: 111.7, height: 55.2 },
          },
        },
      }));
    });
    await flush();
    const [w, h] = dimensionFields(harness.tree().root);
    expect(w!.props.computed).toBe(112);
    expect(h!.props.computed).toBe(55);
  });
});
