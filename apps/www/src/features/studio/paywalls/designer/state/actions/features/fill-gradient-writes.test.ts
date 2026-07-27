import { ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import { addNodeState } from "./state-actions";
import { applyStyleUpdate, type StyleTarget, undoStyleUpdate } from "./style-action-helpers";

// End-to-end coverage of structured (gradient) style writes through the REAL
// mimic CRDT document, exercising the decoded/logical shape boundary that the
// mock in style-action-helpers.test.ts cannot reproduce.

function makeDesignerDoc() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  let flexId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    flexId = screen.children.insertLast({ type: "view", name: "Card" }).id;
  });
  return { doc, flexId };
}

function rawStyle(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ViewNode)?.get()?.data;
  if (data === undefined) throw new Error("expected a view node");
  return data.style;
}

function gradientStops(doc: OfflineDesignerDocument, nodeId: string) {
  const gradient = rawStyle(doc, nodeId).backgroundGradient as unknown as
    | { stops: ReadonlyArray<{ value?: { color: string; position: number } }> }
    | undefined;
  return (gradient?.stops ?? []).map((entry) => entry.value);
}

function mimicOf(doc: OfflineDesignerDocument) {
  return { document: doc, snapshot: doc.getSnapshot() } as never;
}

const GRADIENT = {
  kind: "linear" as const,
  startX: 0,
  startY: 0,
  endX: 1,
  endY: 1,
  stops: [
    { color: "rgba(255, 0, 0, 1)", position: 0 },
    { color: "rgba(0, 255, 0, 1)", position: 0.5 },
    { color: "rgba(0, 0, 255, 1)", position: 1 },
  ],
};

describe("gradient style writes (real document)", () => {
  test("writes a gradient to the base style with logical stops preserved", () => {
    const { doc, flexId } = makeDesignerDoc();
    const nodes: StyleTarget[] = [{ nodeId: flexId, nodeType: "view" }];

    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
      {},
      ((fn: never) => doc.transaction(fn)) as never,
    );

    expect(rawStyle(doc, flexId).backgroundType).toBe("gradient");
    expect(gradientStops(doc, flexId)).toEqual(GRADIENT.stops);
  });

  test("editing another base field preserves a non-default gradient's stops", () => {
    const { doc, flexId } = makeDesignerDoc();
    const nodes: StyleTarget[] = [{ nodeId: flexId, nodeType: "view" }];

    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
      {},
      ((fn: never) => doc.transaction(fn)) as never,
    );

    // A base-style write touching only backgroundColor must not flatten the
    // carried-along gradient (regression: decoded wrapped stops re-encoded to
    // schema defaults).
    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundColor: "rgba(1, 2, 3, 1)" },
      {},
      ((fn: never) => doc.transaction(fn)) as never,
    );

    expect(gradientStops(doc, flexId)).toEqual(GRADIENT.stops);
  });

  test("undo of a base edit restores the node's gradient stops intact", () => {
    const { doc, flexId } = makeDesignerDoc();
    const nodes: StyleTarget[] = [{ nodeId: flexId, nodeType: "view" }];

    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
      {},
      ((fn: never) => doc.transaction(fn)) as never,
    );

    const previous = applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundColor: "rgba(9, 9, 9, 1)" },
      {},
      ((fn: never) => doc.transaction(fn)) as never,
    );

    undoStyleUpdate(mimicOf(doc), nodes, previous, ((fn: never) => doc.transaction(fn)) as never);

    expect(gradientStops(doc, flexId)).toEqual(GRADIENT.stops);
  });

  test("writes a gradient into a selected state override with logical stops", () => {
    const { doc, flexId } = makeDesignerDoc();
    const nodes: StyleTarget[] = [{ nodeId: flexId, nodeType: "view" }];
    const stateId = makeState(doc, flexId);

    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
      { [flexId]: stateId },
      ((fn: never) => doc.transaction(fn)) as never,
    );

    expect(overrideGradientStops(doc, flexId, stateId)).toEqual(GRADIENT.stops);
  });

  test("undo restores a previous gradient override intact", () => {
    const { doc, flexId } = makeDesignerDoc();
    const nodes: StyleTarget[] = [{ nodeId: flexId, nodeType: "view" }];
    const stateId = makeState(doc, flexId);
    const selection = { [flexId]: stateId };

    applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundGradient: GRADIENT },
      selection,
      ((fn: never) => doc.transaction(fn)) as never,
    );

    const changed = {
      ...GRADIENT,
      stops: [
        { color: "rgba(10, 20, 30, 1)", position: 0.25 },
        { color: "rgba(40, 50, 60, 1)", position: 0.75 },
      ],
    };
    const previous = applyStyleUpdate(
      mimicOf(doc),
      nodes,
      { backgroundGradient: changed },
      selection,
      ((fn: never) => doc.transaction(fn)) as never,
    );
    expect(overrideGradientStops(doc, flexId, stateId)).toEqual(changed.stops);

    undoStyleUpdate(mimicOf(doc), nodes, previous, ((fn: never) => doc.transaction(fn)) as never);
    expect(overrideGradientStops(doc, flexId, stateId)).toEqual(GRADIENT.stops);
  });
});

function makeState(doc: OfflineDesignerDocument, nodeId: string): string {
  const ctx = {
    dispatch: () => () => undefined,
    getState: () => ({ mimic: { document: doc, snapshot: doc.getSnapshot() } }),
    setState: () => undefined,
    transaction: (fn: never) => doc.transaction(fn),
  };
  const { stateId } = addNodeState.fn(ctx as never, {
    condition: {
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
    },
    name: "Hovered",
    nodeId,
    nodeType: "view" as const,
  });
  if (stateId === null) throw new Error("expected a state id");
  return stateId;
}

function overrideGradientStops(doc: OfflineDesignerDocument, nodeId: string, stateId: string) {
  const state = findTypedNode(doc.root, nodeId, ViewNode)
    ?.get()
    ?.data.states.find((entry) => entry.id === stateId);
  const gradient = (
    state?.value?.overrides.style as
      | { backgroundGradient?: { stops: ReadonlyArray<{ value?: unknown }> } }
      | undefined
  )?.backgroundGradient;
  return gradient?.stops.map((s) => s.value);
}
