// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { performRedo, performUndo } from "@voidhash/mimic/zustand-commander";

import { updateFillStyle } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { FillPanel } from "./fill-panel";
import {
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
let restoreWatch: (() => void) | undefined;
// oxlint-disable-next-line effect/noTestLifecycleHooks -- React panel harness teardown; the harness mounts into the DOM outside any Effect scope, so there is no Effect.acquireRelease equivalent to attach the disposal to.
afterEach(() => {
  restoreWatch?.();
  restoreWatch = undefined;
  harness?.dispose();
  harness = undefined;
});

interface FillCall {
  nodes: unknown;
  style: Record<string, unknown>;
}

/** Mounts the fill panel over `seeds`, watching `updateFillStyle`. */
function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<FillCall>[] = [];
  restoreWatch = watchAction(updateFillStyle as never, calls as never);
  harness = mountPanelDefinition(FillPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

/** A gradient with N evenly-spaced opaque grey stops. */
const gradientWith = (n: number) => ({
  kind: "linear" as const,
  startX: 0.5,
  startY: 0,
  endX: 0.5,
  endY: 1,
  stops: Array.from({ length: n }, (_, i) => ({
    color: `rgba(${i}, ${i}, ${i}, 1)`,
    position: n === 1 ? 0 : i / (n - 1),
  })),
});

/** The single `fillField` node in the tree. */
const fillField = (harness: PanelHarness) => findNodeByType(harness.tree().root, "fillField")!;

/** Unwraps a committed CRDT gradient's stops (`{ id, pos, value }` → `value`). */
const committedStops = (
  harness: PanelHarness,
  nodeId: string,
): { color: string; position: number }[] => {
  const style = harness.nodeStyle(nodeId);
  const gradient = style.backgroundGradient as { stops: { value: unknown }[] };
  return gradient.stops.map((s) => s.value as { color: string; position: number });
};

describe("FillPanel — snapshot structure", () => {
  test("disabled fill: header + enable button, no fill body", () => {
    const { harness } = mount([{ type: "view", style: { backgroundEnabled: false } }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Fill");
    const actions = findNodeByType(root, "sectionActions")!;
    expect(findNodeByType(actions, "button")?.props.icon).toBe("plus");
    // No fill body while disabled.
    expect(findNodeByType(root, "fillField")).toBeUndefined();
  });

  test("solid default: fillField (solid, hex label) + disable button", () => {
    const { harness } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundColor: "rgba(18, 52, 86, 1)" },
      },
    ]);
    const root = harness.tree().root;
    // No enable button while enabled.
    expect(findNodeByType(root, "sectionActions")).toBeUndefined();

    const ff = findNodeByType(root, "fillField")!;
    expect(ff.props.backgroundType).toBe("solid");
    expect(ff.props.backgroundColor).toBe("rgba(18, 52, 86, 1)");
    // Solid label is the uppercase hex of the color.
    expect(ff.props.label).toBe("#123456");
    expect(ff.props.isTypeMixed).toBe(false);
    // Exactly the eight write-bearing events cross the wire (open + selection are
    // host-local; stop mutations consolidate into onGradientChange).
    expect([...ff.events].sort()).toEqual(
      [
        "onColorChange",
        "onCommit",
        "onDiscard",
        "onGestureStart",
        "onGradientChange",
        "onImageResizeModeChange",
        "onImageUrlChange",
        "onTypeChange",
      ].sort(),
    );
    expect(ff.events.length).toBeLessThanOrEqual(8);

    // The disable `−` button sits next to the field.
    const buttons = findNodesByType(root, "button");
    expect(buttons.map((b) => b.props.icon)).toEqual(["minus"]);
  });

  test("gradient with N stops flows through as a clean {color,position} array", () => {
    const { harness } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: gradientWith(3) },
      },
    ]);
    const ff = fillField(harness);
    expect(ff.props.backgroundType).toBe("gradient");
    // Linear label.
    expect(ff.props.label).toBe("Linear");
    const gradient = ff.props.gradient as { stops: { color: string; position: number }[] };
    expect(gradient.stops).toHaveLength(3);
    expect(gradient.stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    // Stops are the unwrapped write shape (no CRDT `{ id, pos, value }` envelope).
    for (const stop of gradient.stops) {
      expect(Object.keys(stop).sort()).toEqual(["color", "position"]);
    }
  });

  test("image fill: label 'Image' and the image value flows through", () => {
    const { harness } = mount([
      {
        type: "view",
        style: {
          backgroundEnabled: true,
          backgroundType: "image",
          backgroundImage: { url: "https://cdn.test/a.png", resizeMode: "contain" },
        },
      },
    ]);
    const ff = fillField(harness);
    expect(ff.props.backgroundType).toBe("image");
    expect(ff.props.label).toBe("Image");
    expect(ff.props.image).toEqual({ url: "https://cdn.test/a.png", resizeMode: "contain" });
  });

  test("multi-select with mixed type: isTypeMixed + 'Mixed' label", () => {
    const { harness } = mount([
      { type: "view", style: { backgroundEnabled: true, backgroundType: "solid" } },
      { type: "view", style: { backgroundEnabled: true, backgroundType: "gradient" } },
    ]);
    const ff = fillField(harness);
    expect(ff.props.isTypeMixed).toBe(true);
    expect(ff.props.label).toBe("Mixed");
  });
});

describe("FillPanel — type / enable / image direct writes", () => {
  test("type change is a direct write (one undo)", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { backgroundEnabled: true, backgroundType: "solid" } },
    ]);
    const ff = fillField(harness);
    harness.dispatch(ff.id, "onTypeChange", ["gradient"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundType: "gradient" },
    });
    expect(harness.undoDepth()).toBe(1);
    expect(harness.draftActive()).toBe(false);
  });

  test("enable button writes backgroundEnabled:true; disable writes false", async () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { backgroundEnabled: false } },
    ]);
    const enable = findNodeByType(harness.tree().root, "button")!;
    expect(enable.props.icon).toBe("plus");
    act(() => {
      harness.dispatch(enable.id, "onClick");
    });
    await flush();
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundEnabled: true },
    });
    expect(harness.undoDepth()).toBe(1);

    const disable = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.icon === "minus",
    )!;
    harness.dispatch(disable.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundEnabled: false },
    });
  });

  test("image url + resize mode write the whole image object (one undo each)", () => {
    const { harness, nodeIds, calls } = mount([
      {
        type: "view",
        style: {
          backgroundEnabled: true,
          backgroundType: "image",
          backgroundImage: { url: "https://cdn.test/a.png", resizeMode: "cover" },
        },
      },
    ]);
    const ff = fillField(harness);
    harness.dispatch(ff.id, "onImageUrlChange", ["https://cdn.test/b.png"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundImage: { url: "https://cdn.test/b.png", resizeMode: "cover" } },
    });
    expect(harness.undoDepth()).toBe(1);

    harness.dispatch(fillField(harness).id, "onImageResizeModeChange", ["stretch"]);
    expect(calls.at(-1)!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundImage: { url: "https://cdn.test/b.png", resizeMode: "stretch" } },
    });
    expect(harness.undoDepth()).toBe(2);
  });
});

describe("FillPanel — gradient gesture loop", () => {
  const NEXT_GRADIENT = {
    kind: "linear" as const,
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    stops: [
      { color: "rgba(1, 2, 3, 1)", position: 0 },
      { color: "rgba(4, 5, 6, 1)", position: 0.5 },
      { color: "rgba(7, 8, 9, 1)", position: 1 },
    ],
  };

  test("begin → live gradient change → commit is 0 undo + 1 committed batch", async () => {
    const { harness, nodeIds, calls } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: gradientWith(2) },
      },
    ]);
    const ff = fillField(harness);

    harness.dispatch(ff.id, "onGestureStart");
    expect(harness.draftActive()).toBe(true);
    const before = harness.submittedCount();

    harness.dispatch(ff.id, "onGradientChange", [NEXT_GRADIENT]);
    // The live write carries the WHOLE rebuilt gradient (clean {color,position}).
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundGradient: NEXT_GRADIENT },
    });
    // No undo entry while the draft is active.
    expect(harness.undoDepth()).toBe(0);

    harness.dispatch(ff.id, "onCommit");
    await flush();
    expect(harness.draftActive()).toBe(false);
    // Exactly one committed batch for the whole gesture.
    expect(harness.submittedCount()).toBe(before + 1);
    // The commit persisted with all THREE stops intact — the CRDT unwrap/rewrap
    // did NOT collapse the gradient back to defaults (THE regression this guards).
    const stops = committedStops(harness, nodeIds[0]!);
    expect(stops).toHaveLength(3);
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    expect(stops.map((s) => s.color)).toEqual([
      "rgba(1, 2, 3, 1)",
      "rgba(4, 5, 6, 1)",
      "rgba(7, 8, 9, 1)",
    ]);
    // The re-read fillField prop also reflects the three committed stops.
    const reReadGradient = fillField(harness).props.gradient as {
      stops: { position: number }[];
    };
    expect(reReadGradient.stops).toHaveLength(3);
  });

  test("discard reverts the in-flight gesture (committed style unchanged)", async () => {
    const { harness, nodeIds } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: gradientWith(2) },
      },
    ]);
    const ff = fillField(harness);
    const beforeStops = committedStops(harness, nodeIds[0]!);
    const before = harness.submittedCount();

    harness.dispatch(ff.id, "onGestureStart");
    harness.dispatch(ff.id, "onGradientChange", [NEXT_GRADIENT]);
    expect(harness.draftActive()).toBe(true);

    harness.dispatch(ff.id, "onDiscard");
    await flush();
    expect(harness.draftActive()).toBe(false);
    // A discarded draft submits nothing and leaves nodeStyle unchanged.
    expect(harness.submittedCount()).toBe(before);
    expect(harness.undoDepth()).toBe(0);
    expect(committedStops(harness, nodeIds[0]!)).toEqual(beforeStops);
  });

  test("solid color drag: begin → live color change → commit is one gesture", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { backgroundEnabled: true, backgroundColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const ff = fillField(harness);
    harness.dispatch(ff.id, "onGestureStart");
    expect(harness.draftActive()).toBe(true);
    harness.dispatch(ff.id, "onColorChange", ["rgba(9, 9, 9, 1)"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { backgroundColor: "rgba(9, 9, 9, 1)" },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(ff.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
  });
});

describe("FillPanel — no-op suppression", () => {
  // The no-op guarantee is at the DOCUMENT layer: `applyStyleUpdate`'s per-key
  // `styleValuesEqual` check drops keys equal to the effective value, so a write
  // of an identical value submits NO transaction and leaves `nodeStyle`
  // untouched. (The commander still records an undo entry per dispatch — it does
  // not inspect the result — so the guarantee is measured via `submittedCount`
  // and `nodeStyle`, not the undo depth.)
  test("re-writing the identical background type submits no transaction", () => {
    const { harness, nodeIds } = mount([
      { type: "view", style: { backgroundEnabled: true, backgroundType: "gradient" } },
    ]);
    const ff = fillField(harness);
    const before = harness.submittedCount();
    const styleBefore = { ...harness.nodeStyle(nodeIds[0]!) };
    harness.dispatch(ff.id, "onTypeChange", ["gradient"]);
    expect(harness.submittedCount()).toBe(before);
    expect(harness.nodeStyle(nodeIds[0]!)).toEqual(styleBefore);
  });

  test("re-writing the identical color submits no transaction; a real change does", () => {
    const { harness, nodeIds } = mount([
      { type: "view", style: { backgroundEnabled: true, backgroundColor: "rgba(5, 5, 5, 1)" } },
    ]);
    const ff = fillField(harness);
    const before = harness.submittedCount();
    harness.dispatch(ff.id, "onColorChange", ["rgba(5, 5, 5, 1)"]);
    // The identical write is dropped — no new document transaction.
    expect(harness.submittedCount()).toBe(before);
    expect(harness.nodeStyle(nodeIds[0]!).backgroundColor).toBe("rgba(5, 5, 5, 1)");
    // A genuinely different color DOES submit.
    harness.dispatch(ff.id, "onColorChange", ["rgba(9, 9, 9, 1)"]);
    expect(harness.submittedCount()).toBe(before + 1);
    expect(harness.nodeStyle(nodeIds[0]!).backgroundColor).toBe("rgba(9, 9, 9, 1)");
  });
});

describe("FillPanel — override reset", () => {
  test("override-active shows the fill reset; onReset writes the base values back", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundColor: "rgba(0, 0, 0, 1)" },
      },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { backgroundColor: "rgba(255, 0, 0, 1)" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const reset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "fill",
    )!;
    expect(reset.props.show).toBe(true);
    harness.dispatch(reset.id, "onReset");
    // The reset writes the base fill values back (backgroundColor from base).
    expect(calls[0]!.params.style).toMatchObject({ backgroundColor: "rgba(0, 0, 0, 1)" });
  });

  test("disabled + enabled override shows the enable-reset on the add button", async () => {
    const { doc, harness, nodeIds } = mount([
      { type: "view", style: { backgroundEnabled: false } },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { backgroundEnabled: true },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    // The effective backgroundEnabled is true (override), so the body renders and
    // its "fill" reset shows.
    const shown = findNodesByType(harness.tree().root, "resetAffordance").filter(
      (r) => r.props.show === true,
    );
    expect(shown.length).toBeGreaterThan(0);
    for (const r of shown) expect(r.props.label).toBe("fill");
  });
});

describe("FillPanel — undo/redo round-trip", () => {
  test("undo after a direct gradient write restores the prior stops exactly", async () => {
    const { harness, nodeIds } = mount([
      {
        type: "view",
        style: { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: gradientWith(2) },
      },
    ]);
    const priorStops = committedStops(harness, nodeIds[0]!);
    expect(priorStops).toHaveLength(2);

    // A DIRECT gradient write (no gesture) records one commander undo entry — the
    // gradient-shape write path that undo/redo must round-trip. (A gesture's draft
    // commits through the mimic document's own undo, not the commander stack.)
    const ff = fillField(harness);
    harness.dispatch(ff.id, "onGradientChange", [
      {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(11, 11, 11, 1)", position: 0 },
          { color: "rgba(22, 22, 22, 1)", position: 0.3 },
          { color: "rgba(33, 33, 33, 1)", position: 1 },
        ],
      },
    ]);
    await flush();
    expect(committedStops(harness, nodeIds[0]!)).toHaveLength(3);
    expect(harness.undoDepth()).toBe(1);

    // Undo restores the PRIOR two stops EXACTLY (the unwrapEntriesDeep discipline —
    // undo replays the decoded base snapshot through normalizeStyleForWrite so the
    // stops don't collapse to gradient defaults).
    act(() => {
      performUndo(harness.store);
    });
    await flush();
    const restored = committedStops(harness, nodeIds[0]!);
    expect(restored).toEqual(priorStops);

    // Redo re-applies the three-stop gradient with all stops intact.
    act(() => {
      performRedo(harness.store);
    });
    await flush();
    const redone = committedStops(harness, nodeIds[0]!);
    expect(redone).toHaveLength(3);
    expect(redone.map((s) => s.position)).toEqual([0, 0.3, 1]);
  });
});
