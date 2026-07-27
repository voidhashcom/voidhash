import { TextNode, ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import { findTypedNode } from "../utils/node-proxies";
import { endMove, startMove, updateMove } from "./move-actions";

const INITIAL_MOVE_STATE = {
  isActive: false,
  nodes: {},
  startScreenPoint: null,
};

interface MakeCtxOptions {
  /** Canvas-space bounding boxes keyed by node id (for offset fallback). */
  boundingBoxes?: Record<string, { x: number; y: number; width: number; height: number }>;
  /** Zoom scale; a value >1 exercises screen→canvas delta division. */
  scale?: number;
  /** Node ids reported as selected in presence. */
  selectedNodeIds?: string[];
  /** Per-node selected state-override id (drives override-aware writes). */
  stateOverrideSelection?: Record<string, string>;
}

/**
 * Builds a minimal command context over an offline document, faithful enough
 * for the move commands: `dispatch` re-enters the given command's `fn` with the
 * same ctx (so `updateMove` drives the real `updateLayoutStyle`), `transaction`
 * runs against the document, and `getState` exposes the live mimic snapshot.
 */
function makeCtx(doc: OfflineDesignerDocument, options: MakeCtxOptions) {
  const selectedNodeIds = options.selectedNodeIds ?? [];
  let storeState: Record<string, unknown> = {
    canvas: {
      boundingBoxes: options.boundingBoxes ?? {},
      scale: options.scale ?? 1,
      x: 0,
      y: 0,
    },
    highlightedNodeId: null,
    move: INITIAL_MOVE_STATE,
    stateOverrideSelection: options.stateOverrideSelection ?? {},
  };

  const ctx = {
    dispatch:
      <TParams, TReturn>(command: { fn: (c: unknown, p: TParams) => TReturn }) =>
      (params: TParams): TReturn =>
        command.fn(ctx, params),
    getState: () => ({
      ...storeState,
      mimic: {
        document: doc,
        presence: {
          self: {
            selectedNodeIds: selectedNodeIds.map((value, index) => ({
              id: `entry-${index}`,
              pos: `a${index}`,
              value,
            })),
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
  };

  return {
    ctx,
    getMoveState: () => storeState["move"] as typeof INITIAL_MOVE_STATE,
  };
}

/** Inserts one absolutely positioned view child under the seeded screen. */
function insertAbsoluteView(
  doc: OfflineDesignerDocument,
  style: Record<string, unknown> = {},
): string {
  const { screenId } = seededIds(doc);
  let viewId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const view = screen.children.insertLast({ type: "view" });
    viewId = view.id;
    view.as(ViewNode).data.style.update({ position: "absolute", ...style });
  });
  return viewId;
}

function styleOf(doc: OfflineDesignerDocument, viewId: string) {
  const data = findTypedNode(doc.root, viewId, ViewNode)?.get()?.data;
  if (data === undefined) throw new Error("expected the view node");
  return data.style;
}

/** Inserts one absolutely positioned text child under the seeded screen. */
function insertAbsoluteText(
  doc: OfflineDesignerDocument,
  style: Record<string, unknown> = {},
): string {
  const { screenId } = seededIds(doc);
  let textId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const text = screen.children.insertLast({ type: "text" });
    textId = text.id;
    text.as(TextNode).data.style.update({ position: "absolute", ...style });
  });
  return textId;
}

function textStyleOf(doc: OfflineDesignerDocument, textId: string) {
  const data = findTypedNode(doc.root, textId, TextNode)?.get()?.data;
  if (data === undefined) throw new Error("expected the text node");
  return data.style;
}

/**
 * Reads a text node's selected-state `overrides.style` record, or `{}` (mirrors
 * `stateStyleOf` for view nodes; state entries are CRDT-wrapped).
 */
function textStateStyleOf(doc: OfflineDesignerDocument, textId: string, stateId: string) {
  const states = findTypedNode(doc.root, textId, TextNode)?.get()?.data.states ?? [];
  const entry = states.find((state) => state.id === stateId) as
    | { value?: { overrides?: { style?: Record<string, unknown> } } }
    | undefined;
  return entry?.value?.overrides?.style ?? {};
}

/** A minimal always-true DNF condition for a seeded state entry. */
const ALWAYS_TRUE_CONDITION = {
  type: "or",
  value: [
    {
      type: "and",
      value: [
        {
          type: "equals",
          value: {
            left: { type: "literal", value: { key: "boolean", value: true } },
            right: { type: "literal", value: { key: "boolean", value: true } },
          },
        },
      ],
    },
  ],
} as const;

/**
 * Pushes one state override (with `style` overrides) onto a stateful node
 * (view or text); returns the entry id. Uses a structural cast so it drives
 * either node type's `data.states`.
 */
function seedStateOverride(
  doc: OfflineDesignerDocument,
  nodeId: string,
  style: Record<string, unknown>,
): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    if (!node) throw new Error("expected the stateful node");
    const created = (
      node as unknown as {
        data: { states: { push: (value: unknown) => { id: string } } };
      }
    ).data.states.push({
      id: `state-value-${Math.random().toString(36).slice(2, 8)}`,
      condition: ALWAYS_TRUE_CONDITION,
      name: "Hovered",
      overrides: { style },
    });
    entryId = created.id;
  });
  return entryId;
}

/**
 * Reads a view's selected-state `overrides.style` record, or `{}`. Snapshot
 * state entries are CRDT-wrapped as `{ id, pos, value }`, so the override style
 * sits at `entry.value.overrides.style`.
 */
function stateStyleOf(doc: OfflineDesignerDocument, viewId: string, stateId: string) {
  const states = findTypedNode(doc.root, viewId, ViewNode)?.get()?.data.states ?? [];
  const entry = states.find((state) => state.id === stateId) as
    | { value?: { overrides?: { style?: Record<string, unknown> } } }
    | undefined;
  return entry?.value?.overrides?.style ?? {};
}

describe("move-actions", () => {
  test("startMove seeds base offsets from numeric style values", () => {
    const doc = createOfflineDesignerDocument();
    const viewId = insertAbsoluteView(doc, { left: 20, top: 30 });

    const { ctx, getMoveState } = makeCtx(doc, { selectedNodeIds: [viewId] });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 100, y: 100 } });

    const move = getMoveState();
    expect(move.isActive).toBe(true);
    expect(move.nodes[viewId]).toEqual({
      baseLeft: 20,
      baseTop: 30,
      originalLeft: 20,
      originalTop: 30,
      stateId: null,
      originalStateOverrideStyle: {},
    });
  });

  test("startMove falls back to the parent bounding-box offset when left/top are auto", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    // Absolute view with no explicit left/top (both default to "auto").
    const viewId = insertAbsoluteView(doc);

    const { ctx, getMoveState } = makeCtx(doc, {
      boundingBoxes: {
        [screenId]: { x: 10, y: 10, width: 400, height: 400 },
        [viewId]: { x: 55, y: 80, width: 100, height: 100 },
      },
      selectedNodeIds: [viewId],
    });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });

    // Offset within parent: (55 - 10, 80 - 10) = (45, 70).
    expect(getMoveState().nodes[viewId]).toEqual({
      baseLeft: 45,
      baseTop: 70,
      originalLeft: "auto",
      originalTop: "auto",
      stateId: null,
      originalStateOverrideStyle: {},
    });
  });

  test("startMove ignores non-absolute view nodes", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    let viewId = "";
    doc.transaction((root) => {
      const screen = root.findByIdAcrossTree(screenId);
      if (!screen) throw new Error("expected the seeded screen node");
      // Relative (default) position — not draggable.
      viewId = screen.children.insertLast({ type: "view" }).id;
    });

    const { ctx, getMoveState } = makeCtx(doc, { selectedNodeIds: [viewId] });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });

    expect(getMoveState().isActive).toBe(false);
  });

  test("updateMove applies the screen delta divided by scale as a live left/top write", () => {
    const doc = createOfflineDesignerDocument();
    const viewId = insertAbsoluteView(doc, { left: 0, top: 0 });

    // scale 2 → a 100px screen delta is a 50 canvas-unit move.
    const { ctx } = makeCtx(doc, { scale: 2, selectedNodeIds: [viewId] });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 100, y: 60 } });

    expect(styleOf(doc, viewId).left).toBe(50);
    expect(styleOf(doc, viewId).top).toBe(30);
  });

  test("endMove commits final positions and revert restores the originals", () => {
    const doc = createOfflineDesignerDocument();
    const viewId = insertAbsoluteView(doc, { left: 10, top: 10 });

    const { ctx, getMoveState } = makeCtx(doc, { selectedNodeIds: [viewId] });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 40, y: 25 } });
    expect(styleOf(doc, viewId).left).toBe(50);
    expect(styleOf(doc, viewId).top).toBe(35);

    const result = endMove.fn(ctx as never, { screenPoint: { x: 40, y: 25 } });
    expect(getMoveState().isActive).toBe(false);
    expect(result.finalOffsets[viewId]).toEqual({ left: 50, top: 35 });
    expect(styleOf(doc, viewId).left).toBe(50);
    expect(styleOf(doc, viewId).top).toBe(35);

    endMove.revert(ctx as never, { screenPoint: { x: 40, y: 25 } }, result);
    expect(styleOf(doc, viewId).left).toBe(10);
    expect(styleOf(doc, viewId).top).toBe(10);
  });

  test("moves every selected absolute view node by the same delta", () => {
    const doc = createOfflineDesignerDocument();
    const first = insertAbsoluteView(doc, { left: 0, top: 0 });
    const second = insertAbsoluteView(doc, { left: 100, top: 100 });

    const { ctx } = makeCtx(doc, { selectedNodeIds: [first, second] });

    startMove.fn(ctx as never, { nodeIds: [first, second], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 15, y: 25 } });

    expect(styleOf(doc, first).left).toBe(15);
    expect(styleOf(doc, first).top).toBe(25);
    expect(styleOf(doc, second).left).toBe(115);
    expect(styleOf(doc, second).top).toBe(125);
  });

  test("dragging under a selected state override writes the override, not the base; undo restores the override", () => {
    const doc = createOfflineDesignerDocument();
    // Base has one left/top; the selected state override starts at a different one.
    const viewId = insertAbsoluteView(doc, { left: 10, top: 10 });
    const stateId = seedStateOverride(doc, viewId, { left: 40, top: 60 });

    const { ctx } = makeCtx(doc, {
      selectedNodeIds: [viewId],
      stateOverrideSelection: { [viewId]: stateId },
    });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });
    // Drag by (+5, +7): the override's effective base (40,60) shifts to (45,67).
    updateMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });

    // The draft-time write lands in the override; base is untouched.
    expect(stateStyleOf(doc, viewId, stateId)).toMatchObject({ left: 45, top: 67 });
    expect(styleOf(doc, viewId).left).toBe(10);
    expect(styleOf(doc, viewId).top).toBe(10);

    const result = endMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });
    expect(result.finalOffsets[viewId]).toEqual({ left: 45, top: 67 });
    expect(stateStyleOf(doc, viewId, stateId)).toMatchObject({ left: 45, top: 67 });
    expect(styleOf(doc, viewId).left).toBe(10);
    expect(styleOf(doc, viewId).top).toBe(10);

    // Undo restores the override's original left/top and still leaves base alone.
    endMove.revert(ctx as never, { screenPoint: { x: 5, y: 7 } }, result);
    expect(stateStyleOf(doc, viewId, stateId)).toMatchObject({ left: 40, top: 60 });
    expect(styleOf(doc, viewId).left).toBe(10);
    expect(styleOf(doc, viewId).top).toBe(10);
  });

  test("undoing a drag under a state override preserves structured override values", () => {
    const doc = createOfflineDesignerDocument();
    const viewId = insertAbsoluteView(doc, { left: 10, top: 10 });
    const stateId = seedStateOverride(doc, viewId, {
      left: 40,
      top: 60,
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(255, 0, 0, 1)", position: 0 },
          { color: "rgba(0, 0, 255, 1)", position: 1 },
        ],
      },
    });

    const { ctx } = makeCtx(doc, {
      selectedNodeIds: [viewId],
      stateOverrideSelection: { [viewId]: stateId },
    });

    startMove.fn(ctx as never, { nodeIds: [viewId], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });
    const result = endMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });
    endMove.revert(ctx as never, { screenPoint: { x: 5, y: 7 } }, result);

    // The revert replays the captured decoded override record; without
    // normalization the CRDT entry wrappers re-encode and every stop collapses
    // to the schema default color at position 0.
    const overrideStyle = stateStyleOf(doc, viewId, stateId);
    expect(overrideStyle).toMatchObject({ left: 40, top: 60 });
    const stops = (
      overrideStyle["backgroundGradient"] as
        | { stops: ReadonlyArray<{ value?: { color: string; position: number } }> }
        | undefined
    )?.stops.map((entry) => entry.value);
    expect(stops).toEqual([
      { color: "rgba(255, 0, 0, 1)", position: 0 },
      { color: "rgba(0, 0, 255, 1)", position: 1 },
    ]);
  });

  test("startMove seeds base offsets for an absolute text node from numeric style values", () => {
    const doc = createOfflineDesignerDocument();
    const textId = insertAbsoluteText(doc, { left: 20, top: 30 });

    const { ctx, getMoveState } = makeCtx(doc, { selectedNodeIds: [textId] });

    startMove.fn(ctx as never, { nodeIds: [textId], screenPoint: { x: 100, y: 100 } });

    const move = getMoveState();
    expect(move.isActive).toBe(true);
    expect(move.nodes[textId]).toEqual({
      baseLeft: 20,
      baseTop: 30,
      originalLeft: 20,
      originalTop: 30,
      stateId: null,
      originalStateOverrideStyle: {},
    });
  });

  test("startMove falls back to the parent bounding-box offset for an absolute text node with auto left/top", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const textId = insertAbsoluteText(doc);

    const { ctx, getMoveState } = makeCtx(doc, {
      boundingBoxes: {
        [screenId]: { x: 10, y: 10, width: 400, height: 400 },
        [textId]: { x: 55, y: 80, width: 100, height: 100 },
      },
      selectedNodeIds: [textId],
    });

    startMove.fn(ctx as never, { nodeIds: [textId], screenPoint: { x: 0, y: 0 } });

    // Offset within parent: (55 - 10, 80 - 10) = (45, 70).
    expect(getMoveState().nodes[textId]).toEqual({
      baseLeft: 45,
      baseTop: 70,
      originalLeft: "auto",
      originalTop: "auto",
      stateId: null,
      originalStateOverrideStyle: {},
    });
  });

  test("dragging an absolute text node writes its left/top and reverts to the original", () => {
    const doc = createOfflineDesignerDocument();
    const textId = insertAbsoluteText(doc, { left: 10, top: 10 });

    const { ctx, getMoveState } = makeCtx(doc, { selectedNodeIds: [textId] });

    startMove.fn(ctx as never, { nodeIds: [textId], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 40, y: 25 } });
    expect(textStyleOf(doc, textId).left).toBe(50);
    expect(textStyleOf(doc, textId).top).toBe(35);

    const result = endMove.fn(ctx as never, { screenPoint: { x: 40, y: 25 } });
    expect(getMoveState().isActive).toBe(false);
    expect(result.finalOffsets[textId]).toEqual({ left: 50, top: 35 });
    expect(textStyleOf(doc, textId).left).toBe(50);
    expect(textStyleOf(doc, textId).top).toBe(35);

    endMove.revert(ctx as never, { screenPoint: { x: 40, y: 25 } }, result);
    expect(textStyleOf(doc, textId).left).toBe(10);
    expect(textStyleOf(doc, textId).top).toBe(10);
  });

  test("moves a mixed selection of absolute view and text nodes by the same delta", () => {
    const doc = createOfflineDesignerDocument();
    const view = insertAbsoluteView(doc, { left: 0, top: 0 });
    const text = insertAbsoluteText(doc, { left: 100, top: 100 });

    const { ctx } = makeCtx(doc, { selectedNodeIds: [view, text] });

    startMove.fn(ctx as never, { nodeIds: [view, text], screenPoint: { x: 0, y: 0 } });
    updateMove.fn(ctx as never, { screenPoint: { x: 15, y: 25 } });

    expect(styleOf(doc, view).left).toBe(15);
    expect(styleOf(doc, view).top).toBe(25);
    expect(textStyleOf(doc, text).left).toBe(115);
    expect(textStyleOf(doc, text).top).toBe(125);
  });

  test("dragging a text node under a selected state override writes the override, not the base; undo restores the override", () => {
    const doc = createOfflineDesignerDocument();
    const textId = insertAbsoluteText(doc, { left: 10, top: 10 });
    const stateId = seedStateOverride(doc, textId, { left: 40, top: 60 });

    const { ctx } = makeCtx(doc, {
      selectedNodeIds: [textId],
      stateOverrideSelection: { [textId]: stateId },
    });

    startMove.fn(ctx as never, { nodeIds: [textId], screenPoint: { x: 0, y: 0 } });
    // Drag by (+5, +7): the override's effective base (40,60) shifts to (45,67).
    updateMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });

    // The draft-time write lands in the override; base is untouched.
    expect(textStateStyleOf(doc, textId, stateId)).toMatchObject({ left: 45, top: 67 });
    expect(textStyleOf(doc, textId).left).toBe(10);
    expect(textStyleOf(doc, textId).top).toBe(10);

    const result = endMove.fn(ctx as never, { screenPoint: { x: 5, y: 7 } });
    expect(result.finalOffsets[textId]).toEqual({ left: 45, top: 67 });
    expect(textStateStyleOf(doc, textId, stateId)).toMatchObject({ left: 45, top: 67 });
    expect(textStyleOf(doc, textId).left).toBe(10);
    expect(textStyleOf(doc, textId).top).toBe(10);

    // Undo restores the override's original left/top and still leaves base alone.
    endMove.revert(ctx as never, { screenPoint: { x: 5, y: 7 } }, result);
    expect(textStateStyleOf(doc, textId, stateId)).toMatchObject({ left: 40, top: 60 });
    expect(textStyleOf(doc, textId).left).toBe(10);
    expect(textStyleOf(doc, textId).top).toBe(10);
  });
});
