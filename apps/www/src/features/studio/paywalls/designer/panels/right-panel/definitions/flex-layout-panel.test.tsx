// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateLayoutStyle } from "../../../state/actions";
import { seededIds } from "../../../state/testing/offline-document";
import type { PanelNode } from "../../../panel-runtime/schema";
import { FlexLayoutPanel } from "./flex-layout-panel";
import {
  createOfflineDesignerDocument,
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
  seedStateOverride,
  selectState,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
let restoreWatch: (() => void)[] = [];
afterEach(() => {
  for (const restore of restoreWatch) restore();
  restoreWatch = [];
  harness?.dispose();
  harness = undefined;
});

/** A default flex style (all zeros / row) plus optional overrides. */
const layout = (overrides: Record<string, unknown> = {}) => ({
  flexDirection: "row",
  gap: 0,
  alignItems: "flex-start",
  justifyContent: "flex-start",
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  width: "auto",
  height: "auto",
  ...overrides,
});

function mount(
  seeds: Parameters<typeof seedNodes>[1],
  select?: (ctx: { nodeIds: string[]; screenId: string; rootId: string }) => string[],
) {
  const doc = createOfflineDesignerDocument();
  const { screenId, rootId } = seededIds(doc);
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = [watchAction(updateLayoutStyle as never, calls as never)];
  const selection = select ? select({ nodeIds, screenId, rootId }) : nodeIds;
  harness = mountPanelDefinition(FlexLayoutPanel, doc, { nodeIds: selection });
  return { doc, harness, nodeIds, calls, screenId, rootId };
}

/** All number/text fields (gap + padding + offsets) in document order. */
const textFields = (root: PanelNode) => findNodesByType(root, "textField");
const dimensionFields = (root: PanelNode) => findNodesByType(root, "dimensionField");

/** The padding expand/collapse button (`fullscreen` when uniform, `vault` when expanded). */
const paddingButton = (root: PanelNode) =>
  findNodesByType(root, "button").find(
    (b) => b.props.icon === "fullscreen" || b.props.icon === "vault",
  );

describe("FlexLayoutPanel — structure", () => {
  test("a view under the screen renders the Layout section with all three subsections", () => {
    const { harness } = mount([{ type: "view", style: layout() }]);
    const root = harness.tree().root;
    expect(findNodeByType(root, "section")?.props.title).toBe("Layout");
    // Direction toggle + alignment grid + two dimension fields.
    expect(findNodeByType(root, "toggleGroup")).toBeTruthy();
    expect(findNodeByType(root, "alignmentGrid")).toBeTruthy();
    expect(dimensionFields(root)).toHaveLength(2);
    expect(dimensionFields(root).map((f) => f.props.axis)).toEqual(["width", "height"]);
  });

  test("a view (non-screen) has enabled dimension inputs", () => {
    const { harness } = mount([{ type: "view", style: layout({ width: 120 }) }]);
    const [w] = dimensionFields(harness.tree().root);
    expect(w!.props.disabled).toBe(false);
  });

  test("a screen node disables the dimension inputs (editableDimensions=false)", () => {
    // The screen is styleful and parented (under the doc root), so the section
    // renders — but its dimension inputs are disabled, exactly like the old path.
    const { harness } = mount([{ type: "view" }], ({ screenId }) => [screenId]);
    const root = harness.tree().root;
    expect(findNodeByType(root, "section")?.props.title).toBe("Layout");
    for (const field of dimensionFields(root)) {
      expect(field.props.disabled).toBe(true);
    }
  });

  test("a parentless (root) selection renders an empty panel (no section)", () => {
    const { harness } = mount([{ type: "view" }], ({ rootId }) => [rootId]);
    const root = harness.tree().root;
    expect(findNodeByType(root, "section")).toBeUndefined();
  });

  test("multi-select with a mixed flexDirection surfaces the mixed flag on the toggle", () => {
    const { harness } = mount([
      { type: "view", style: layout({ flexDirection: "row" }) },
      { type: "view", style: layout({ flexDirection: "column" }) },
    ]);
    const toggle = findNodeByType(harness.tree().root, "toggleGroup")!;
    expect(toggle.props.mixed).toBe(true);
  });
});

describe("FlexLayoutPanel — flex behavior", () => {
  test("changing direction is a DIRECT write (one undo)", () => {
    const { harness, nodeIds, calls } = mount([{ type: "view", style: layout() }]);
    const toggle = findNodeByType(harness.tree().root, "toggleGroup")!;
    harness.dispatch(toggle.id, "onChange", ["column"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { flexDirection: "column" },
    });
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
  });

  test("alignment grid change writes {alignItems, justifyContent} DIRECT (one undo)", () => {
    const { harness, nodeIds, calls } = mount([{ type: "view", style: layout() }]);
    const grid = findNodeByType(harness.tree().root, "alignmentGrid")!;
    harness.dispatch(grid.id, "onChange", [
      { alignItems: "center", justifyContent: "flex-end" },
    ]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { alignItems: "center", justifyContent: "flex-end" },
    });
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
  });

  test("gap typing is a DRAFT (no undo); commit ends it", () => {
    const { harness, nodeIds, calls } = mount([{ type: "view", style: layout() }]);
    const gap = textFields(harness.tree().root)[0]!;
    expect(harness.draftActive()).toBe(false);
    harness.dispatch(gap.id, "onChange", ["8"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { gap: 8 },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(gap.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(0);
  });
});

describe("FlexLayoutPanel — dimensions", () => {
  test("width field: custom stored value flows to `value`; mode is custom", () => {
    const { harness } = mount([{ type: "view", style: layout({ width: 150 }) }]);
    const [w] = dimensionFields(harness.tree().root);
    expect(w!.props.mode).toBe("custom");
    expect(w!.props.value).toBe(150);
  });

  test("width fill in a row parent: onModeChange('custom') resets flex (main axis)", () => {
    // A row parent (the screen defaults to column, so seed the parent view's
    // direction) — here the seeded view sits under the screen (column), so WIDTH is
    // the stretch axis (alignSelf). Assert the alignSelf reset for custom.
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ width: "auto", alignSelf: "stretch" }) },
    ]);
    const [w] = dimensionFields(harness.tree().root);
    // Parent (screen) is column → width is the stretch axis → fill via alignSelf.
    expect(w!.props.mode).toBe("fill");
    harness.dispatch(w!.id, "onModeChange", ["custom"]);
    // custom in the stretch-parent direction resets alignSelf to "auto".
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { width: 100, alignSelf: "auto" },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("width hug in a stretch column parent opts out with alignSelf flex-start", () => {
    // The parent screen stretches by default (alignItems "stretch"), so an
    // "auto" cross size would keep filling. Hug writes alignSelf "flex-start" to
    // opt out and actually hug.
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ width: 120 }) },
    ]);
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onModeChange", ["hug"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { width: "auto", alignSelf: "flex-start" },
    });
  });

  test("width fill in a column parent sets width auto + alignSelf stretch", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ width: 120 }) },
    ]);
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onModeChange", ["fill"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { width: "auto", alignSelf: "stretch" },
    });
  });

  test("height fill in a column parent sets flex:1 (main axis for height)", () => {
    // Height is the MAIN axis under a column parent → fill via flex:1.
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ height: 80 }) },
    ]);
    const [, h] = dimensionFields(harness.tree().root);
    harness.dispatch(h!.id, "onModeChange", ["fill"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { height: "auto", flex: 1 },
    });
  });

  test("height custom in a column parent clears flex (main axis)", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ height: "auto", flex: 1 }) },
    ]);
    const [, h] = dimensionFields(harness.tree().root);
    expect(h!.props.mode).toBe("fill");
    harness.dispatch(h!.id, "onModeChange", ["custom"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { height: 100, flex: undefined },
    });
  });

  test("typing a custom width is a DRAFT with a single width payload", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ width: 100 }) },
    ]);
    const [w] = dimensionFields(harness.tree().root);
    harness.dispatch(w!.id, "onChange", ["175"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { width: 175 },
    });
    expect(harness.undoDepth()).toBe(0);
  });

  test("bounding box flows into the dimension field's computed prop", async () => {
    const { harness, nodeIds } = mount([{ type: "view", style: layout({ width: 100 }) }]);
    act(() => {
      harness.store.setState((state) => ({
        ...state,
        canvas: {
          ...state.canvas,
          boundingBoxes: {
            ...state.canvas.boundingBoxes,
            [nodeIds[0]!]: { x: 0, y: 0, width: 222.4, height: 96.6 },
          },
        },
      }));
    });
    await flush();
    const [w, h] = dimensionFields(harness.tree().root);
    // Rounded per the old DimensionsSubSection (Math.round).
    expect(w!.props.computed).toBe(222);
    expect(h!.props.computed).toBe(97);
  });
});

describe("FlexLayoutPanel — padding", () => {
  test("non-uniform padding seeds the expanded (4-field) view", () => {
    const { harness } = mount([
      { type: "view", style: layout({ paddingTop: 4, paddingBottom: 8 }) },
    ]);
    // Expanded → 4 padding fields (gap is a separate field, so 5 total).
    expect(textFields(harness.tree().root)).toHaveLength(5);
  });

  test("uniform padding seeds the collapsed (2-field) view; expand adds fields", async () => {
    const { harness } = mount([{ type: "view", style: layout() }]);
    // gap + 2 uniform padding fields = 3.
    expect(textFields(harness.tree().root)).toHaveLength(3);
    const button = paddingButton(harness.tree().root)!;
    expect(button.props.icon).toBe("fullscreen");
    act(() => {
      harness.dispatch(button.id, "onClick");
    });
    await flush();
    // gap + 4 per-side padding fields = 5; button flips to the collapse (vault) icon.
    expect(textFields(harness.tree().root)).toHaveLength(5);
    expect(paddingButton(harness.tree().root)!.props.icon).toBe("vault");
  });

  test("expanded padding state persists across a store-driven re-emit", async () => {
    const { harness, nodeIds } = mount([
      { type: "view", style: layout({ paddingTop: 4, paddingBottom: 8 }) },
    ]);
    // Force a re-emit via an unrelated store change; the seeded expanded state
    // (from non-uniform padding) must survive.
    act(() => {
      selectState(harness.store, nodeIds[0]!, null);
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(5);
  });

  test("collapse-to-uniform is a DIRECT write of all four sides (one undo)", async () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ paddingLeft: 6, paddingRight: 6, paddingTop: 10, paddingBottom: 12 }) },
    ]);
    // Seeded expanded (top≠bottom). Collapse writes left→L/R and top→T/B.
    const button = paddingButton(harness.tree().root)!;
    act(() => {
      harness.dispatch(button.id, "onClick");
    });
    await flush();
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { paddingLeft: 6, paddingRight: 6, paddingTop: 10, paddingBottom: 10 },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("individual padding typing is a DRAFT with a single-side payload", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ paddingTop: 4, paddingBottom: 8 }) },
    ]);
    // Expanded order: gap, paddingLeft, paddingTop, paddingRight, paddingBottom.
    const fields = textFields(harness.tree().root);
    const paddingRight = fields[3]!;
    harness.dispatch(paddingRight.id, "onChange", ["9"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { paddingRight: 9 },
    });
  });
});

describe("FlexLayoutPanel — override resets", () => {
  test("override-active gap reset writes the base value back (one undo)", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ gap: 4 }) },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { style: { gap: 20 } });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();
    // Find the gap reset affordance (label "layout gap").
    const gapReset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "layout gap",
    )!;
    expect(gapReset.props.show).toBe(true);
    harness.dispatch(gapReset.id, "onReset");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { gap: 4 },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("override-active alignment reset writes both base keys back", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ alignItems: "center", justifyContent: "center" }) },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { alignItems: "flex-end", justifyContent: "flex-end" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();
    const alignReset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "layout alignment",
    )!;
    expect(alignReset.props.show).toBe(true);
    harness.dispatch(alignReset.id, "onReset");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { alignItems: "center", justifyContent: "center" },
    });
  });

  test("override-active padding-horizontal reset writes both sides back (padding pair)", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "view", style: layout({ paddingLeft: 6, paddingRight: 6 }) },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { paddingLeft: 30, paddingRight: 30 },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();
    const hReset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "padding horizontal",
    )!;
    expect(hReset.props.show).toBe(true);
    harness.dispatch(hReset.id, "onReset");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { paddingLeft: 6, paddingRight: 6 },
    });
  });
});
