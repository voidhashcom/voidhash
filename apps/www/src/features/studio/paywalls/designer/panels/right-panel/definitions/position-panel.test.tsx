// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { performUndo } from "@voidhash/mimic/zustand-commander";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { applyPerNodeLayoutStyle, updateLayoutStyle } from "../../../state/actions";
import { seededIds } from "../../../state/testing/offline-document";
import type { PanelNode } from "../../../panel-runtime/schema";
import { PositionPanel } from "./position-panel";
import {
  createOfflineDesignerDocument,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
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

/** A minimal default position style (relative flow) plus optional overrides. */
const position = (overrides: Record<string, unknown> = {}) => ({
  position: "relative",
  left: "auto",
  top: "auto",
  right: "auto",
  bottom: "auto",
  ...overrides,
});

/** One entry of the per-node absolute-position action's `nodes` payload. */
type PerNodeSeed = { target: { nodeId: string; nodeType: string }; style: Record<string, unknown> };

function mount(
  seeds: Parameters<typeof seedNodes>[1],
  select?: (ctx: { nodeIds: string[]; screenId: string; rootId: string }) => string[],
) {
  const doc = createOfflineDesignerDocument();
  const { screenId, rootId } = seededIds(doc);
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  const perNodeCalls: ActionCall<{ nodes: PerNodeSeed[] }>[] = [];
  restoreWatch = [
    watchAction(updateLayoutStyle as never, calls as never),
    watchAction(applyPerNodeLayoutStyle as never, perNodeCalls as never),
  ];
  const selection = select ? select({ nodeIds, screenId, rootId }) : nodeIds;
  harness = mountPanelDefinition(PositionPanel, doc, { nodeIds: selection });
  return { doc, harness, nodeIds, calls, perNodeCalls, screenId, rootId };
}

/** All X/Y offset fields in document order. */
const textFields = (root: PanelNode) => findNodesByType(root, "textField");

/** The `Position` section's toggle button (the `scan`-iconed one). */
const positionToggle = (root: PanelNode) =>
  findNodesByType(root, "button").find((b) => b.props.icon === "scan");

/** The X (arrowRight) and Y (arrowDown) offset fields. */
const xField = (root: PanelNode) => textFields(root).find((f) => f.props.icon === "arrowRight");
const yField = (root: PanelNode) => textFields(root).find((f) => f.props.icon === "arrowDown");

/** Seeds a node + parent (screen) bounding box so `getOffsetWithinParent` resolves. */
function seedOffsetBoxes(
  harness: PanelHarness,
  nodeId: string,
  screenId: string,
  nodeBox: { x: number; y: number },
  screenBox: { x: number; y: number },
) {
  act(() => {
    harness.store.setState((state) => ({
      ...state,
      canvas: {
        ...state.canvas,
        boundingBoxes: {
          ...state.canvas.boundingBoxes,
          [nodeId]: { x: nodeBox.x, y: nodeBox.y, width: 10, height: 10 },
          [screenId]: { x: screenBox.x, y: screenBox.y, width: 100, height: 100 },
        },
      },
    }));
  });
}

describe("PositionPanel — structure", () => {
  test("the Position section renders for a view (toggle unpressed, X/Y always present)", () => {
    const { harness } = mount([{ type: "view", style: position() }]);
    const root = harness.tree().root;
    expect(findNodesByType(root, "section").some((s) => s.props.title === "Position")).toBe(true);
    // Unpressed → ghost variant. X/Y are always rendered (relative shows them disabled).
    expect(positionToggle(root)!.props.variant).toBe("ghost");
    expect(textFields(root)).toHaveLength(2);
    expect(xField(root)).toBeTruthy();
    expect(yField(root)).toBeTruthy();
  });

  test("the Position section renders for a text node", () => {
    const { harness } = mount([{ type: "text", style: position() }]);
    const root = harness.tree().root;
    expect(findNodesByType(root, "section").some((s) => s.props.title === "Position")).toBe(true);
    expect(textFields(root)).toHaveLength(2);
  });

  test("the Position section renders for a mixed view+text multi-selection", () => {
    const { harness } = mount([
      { type: "view", style: position() },
      { type: "text", style: position() },
    ]);
    const root = harness.tree().root;
    expect(findNodesByType(root, "section").some((s) => s.props.title === "Position")).toBe(true);
    expect(textFields(root)).toHaveLength(2);
  });
});

describe("PositionPanel — relative (disabled) offsets", () => {
  test("relative flow disables X/Y and shows the measured parent offset", async () => {
    const { harness, nodeIds, screenId } = mount([{ type: "view", style: position() }]);
    // Node at (40,55), parent (screen) at (10,15) → measured offset (30,40).
    seedOffsetBoxes(harness, nodeIds[0]!, screenId, { x: 40, y: 55 }, { x: 10, y: 15 });
    await flush();
    const root = harness.tree().root;
    expect(xField(root)!.props.disabled).toBe(true);
    expect(yField(root)!.props.disabled).toBe(true);
    expect(xField(root)!.props.value).toBe("30");
    expect(yField(root)!.props.value).toBe("40");
  });

  test("relative flow with missing boxes shows 0/0", () => {
    const { harness } = mount([{ type: "view", style: position() }]);
    const root = harness.tree().root;
    expect(xField(root)!.props.value).toBe("0");
    expect(yField(root)!.props.value).toBe("0");
  });
});

describe("PositionPanel — absolute (enabled) offsets", () => {
  test("when absolute the X/Y fields are enabled and the toggle is pressed (default variant)", () => {
    const { harness } = mount([
      { type: "view", style: position({ position: "absolute", left: 20, top: 30 }) },
    ]);
    const root = harness.tree().root;
    expect(positionToggle(root)!.props.variant).toBe("default");
    expect(xField(root)!.props.disabled).toBe(false);
    expect(yField(root)!.props.disabled).toBe(false);
    expect(xField(root)!.props.value).toBe("20");
    expect(yField(root)!.props.value).toBe("30");
  });

  test("an 'auto' offset renders as 0 in the X field", () => {
    const { harness } = mount([
      { type: "view", style: position({ position: "absolute", left: "auto", top: 5 }) },
    ]);
    expect(xField(harness.tree().root)!.props.value).toBe("0");
  });

  test("typing X writes left as a DRAFT; typing Y writes top", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: position({ position: "absolute", left: 0, top: 0 }) },
    ]);
    const x = xField(harness.tree().root)!;
    harness.dispatch(x.id, "onChange", ["48"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { left: 48 },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(x.id, "onCommit");
    expect(harness.draftActive()).toBe(false);

    const y = yField(harness.tree().root)!;
    harness.dispatch(y.id, "onChange", ["72"]);
    expect(calls[1]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { top: 72 },
    });
  });
});

describe("PositionPanel — toggle", () => {
  test("toggle ON is a per-node write seeding left/top from the parent offset (one undo)", async () => {
    const { harness, nodeIds, perNodeCalls, screenId } = mount([{ type: "view", style: position() }]);
    // Node at (40,55), parent (screen) at (10,15) → offset (30,40).
    seedOffsetBoxes(harness, nodeIds[0]!, screenId, { x: 40, y: 55 }, { x: 10, y: 15 });
    await flush();
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    expect(perNodeCalls[0]!.params).toEqual({
      nodes: [
        {
          target: { nodeId: nodeIds[0], nodeType: "view" },
          style: { position: "absolute", left: 30, top: 40 },
        },
      ],
    });
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
  });

  test("toggle ON with missing boxes falls back to left:0 top:0", () => {
    const { harness, nodeIds, perNodeCalls } = mount([{ type: "view", style: position() }]);
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    expect(perNodeCalls[0]!.params).toEqual({
      nodes: [
        {
          target: { nodeId: nodeIds[0], nodeType: "view" },
          style: { position: "absolute", left: 0, top: 0 },
        },
      ],
    });
  });

  test("toggle ON keeps an already-set numeric left/top instead of re-seeding", async () => {
    const { harness, nodeIds, perNodeCalls, screenId } = mount([
      { type: "view", style: position({ left: 12, top: 34 }) },
    ]);
    seedOffsetBoxes(harness, nodeIds[0]!, screenId, { x: 99, y: 99 }, { x: 0, y: 0 });
    await flush();
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    expect(perNodeCalls[0]!.params).toEqual({
      nodes: [
        {
          target: { nodeId: nodeIds[0], nodeType: "view" },
          style: { position: "absolute", left: 12, top: 34 },
        },
      ],
    });
  });

  test("toggle ON works on a text node (seeds from its own parent offset)", async () => {
    const { harness, nodeIds, perNodeCalls, screenId } = mount([{ type: "text", style: position() }]);
    seedOffsetBoxes(harness, nodeIds[0]!, screenId, { x: 60, y: 70 }, { x: 10, y: 10 });
    await flush();
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    expect(perNodeCalls[0]!.params).toEqual({
      nodes: [
        {
          target: { nodeId: nodeIds[0], nodeType: "text" },
          style: { position: "absolute", left: 50, top: 60 },
        },
      ],
    });
    expect(harness.undoDepth()).toBe(1);
    // The document actually flips the text node to absolute at its own offset.
    expect(harness.nodeStyle(nodeIds[0]!)).toMatchObject({
      position: "absolute",
      left: 50,
      top: 60,
    });
  });

  test("multi-select toggle ON seeds EACH node from its own offset (one undo)", async () => {
    const { harness, nodeIds, perNodeCalls, screenId } = mount([
      { type: "view", style: position() },
      { type: "text", style: position() },
    ]);
    // Both nodes share the screen parent (at (10,15)) but sit at different spots
    // — node0 at (40,55) → (30,40); node1 at (110,215) → (100,200).
    act(() => {
      harness.store.setState((state) => ({
        ...state,
        canvas: {
          ...state.canvas,
          boundingBoxes: {
            ...state.canvas.boundingBoxes,
            [screenId]: { x: 10, y: 15, width: 400, height: 400 },
            [nodeIds[0]!]: { x: 40, y: 55, width: 10, height: 10 },
            [nodeIds[1]!]: { x: 110, y: 215, width: 10, height: 10 },
          },
        },
      }));
    });
    await flush();
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    // Each node gets its OWN offset — not both stacked on the first node's spot.
    expect(perNodeCalls[0]!.params).toEqual({
      nodes: [
        {
          target: { nodeId: nodeIds[0], nodeType: "view" },
          style: { position: "absolute", left: 30, top: 40 },
        },
        {
          target: { nodeId: nodeIds[1], nodeType: "text" },
          style: { position: "absolute", left: 100, top: 200 },
        },
      ],
    });
    // A single undoable command → one undo entry for the whole multi-node toggle.
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
  });

  test("multi-select toggle ON lands each node at its own offset; undo restores all", async () => {
    const { harness, nodeIds, screenId } = mount([
      { type: "view", style: position() },
      { type: "view", style: position() },
    ]);
    act(() => {
      harness.store.setState((state) => ({
        ...state,
        canvas: {
          ...state.canvas,
          boundingBoxes: {
            ...state.canvas.boundingBoxes,
            [screenId]: { x: 0, y: 0, width: 400, height: 400 },
            [nodeIds[0]!]: { x: 25, y: 35, width: 10, height: 10 },
            [nodeIds[1]!]: { x: 70, y: 90, width: 10, height: 10 },
          },
        },
      }));
    });
    await flush();
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");

    // Both nodes land absolute at their OWN offsets (not stacked).
    expect(harness.nodeStyle(nodeIds[0]!)).toMatchObject({ position: "absolute", left: 25, top: 35 });
    expect(harness.nodeStyle(nodeIds[1]!)).toMatchObject({ position: "absolute", left: 70, top: 90 });

    // Undo restores BOTH nodes to the pre-toggle (relative) state in one step.
    act(() => {
      performUndo(harness.store);
    });
    await flush();
    expect(harness.nodeStyle(nodeIds[0]!).position).not.toBe("absolute");
    expect(harness.nodeStyle(nodeIds[1]!).position).not.toBe("absolute");
  });

  test("toggle OFF restores relative flow (all four insets back to auto)", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: position({ position: "absolute", left: 20, top: 30 }) },
    ]);
    const toggle = positionToggle(harness.tree().root)!;
    harness.dispatch(toggle.id, "onClick");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { position: "relative", left: "auto", top: "auto", right: "auto", bottom: "auto" },
    });
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(1);
  });
});

describe("PositionPanel — mixed", () => {
  test("a mixed `position` across a multi-selection disables the X/Y fields", () => {
    const { harness } = mount([
      { type: "view", style: position({ position: "absolute", left: 1, top: 1 }) },
      { type: "view", style: position() },
    ]);
    const root = harness.tree().root;
    // Section present, but with a mixed `position` the offset fields are read-only.
    expect(findNodesByType(root, "section").some((s) => s.props.title === "Position")).toBe(true);
    expect(textFields(root)).toHaveLength(2);
    expect(xField(root)!.props.disabled).toBe(true);
    expect(yField(root)!.props.disabled).toBe(true);
  });
});
