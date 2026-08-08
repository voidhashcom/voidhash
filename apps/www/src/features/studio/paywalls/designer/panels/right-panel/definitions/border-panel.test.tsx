// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateBorderStyle } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { BorderPanel } from "./border-panel";
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
// oxlint-disable-next-line effect/noTestLifecycleHooks -- module-scoped fixture teardown: disposes the panel harness and unwinds the `watchAction` store patches between tests. Both are installed by synchronous React renders inside each `it`, outside any Effect scope, so there is no Scope for Effect.acquireRelease to attach a finalizer to.
afterEach(() => {
  restoreWatch?.();
  restoreWatch = undefined;
  harness?.dispose();
  harness = undefined;
});

/** All four side widths equal to `w`. */
const uniformWidth = (w: number) => ({
  borderTopWidth: w,
  borderRightWidth: w,
  borderBottomWidth: w,
  borderLeftWidth: w,
});

function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updateBorderStyle as never, calls as never);
  harness = mountPanelDefinition(BorderPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

const textFields = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "textField");
const buttons = (root: Parameters<typeof findNodesByType>[0]) => findNodesByType(root, "button");

describe("BorderPanel — snapshot structure", () => {
  test("disabled border: header + enable button, no width content", () => {
    const { harness } = mount([{ type: "view", style: { borderEnabled: false } }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Border");
    const actions = findNodeByType(root, "sectionActions")!;
    expect(findNodeByType(actions, "button")?.props.icon).toBe("plus");
    // No body: no width field, no color field.
    expect(textFields(root)).toHaveLength(0);
    expect(findNodeByType(root, "colorField")).toBeUndefined();
  });

  test("enabled + uniform: Width subsection (single field), expand+disable buttons, color", () => {
    const { harness } = mount([
      {
        type: "view",
        style: { borderEnabled: true, ...uniformWidth(2), borderColor: "rgba(9, 9, 9, 1)" },
      },
    ]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "subsection")?.props.title).toBe("Width");
    const width = textFields(root);
    expect(width).toHaveLength(1);
    expect(width[0]!.props.icon).toBe("square");
    expect(width[0]!.props.value).toBe("2");
    // Buttons in order: expand (fullscreen), disable (minus).
    expect(buttons(root).map((b) => b.props.icon)).toEqual(["fullscreen", "minus"]);
    expect(findNodeByType(root, "colorField")?.props.value).toBe("rgba(9, 9, 9, 1)");
  });

  test("enabled + non-uniform seeds the expanded view: 4 per-side width fields", () => {
    const { harness } = mount([
      {
        type: "view",
        style: {
          borderEnabled: true,
          borderTopWidth: 1,
          borderRightWidth: 2,
          borderBottomWidth: 3,
          borderLeftWidth: 4,
          borderColor: "rgba(0, 0, 0, 1)",
        },
      },
    ]);
    const root = harness.tree().root;
    const fields = textFields(root);
    expect(fields).toHaveLength(4);
    // Document order: left, top, right, bottom (the 2×2 grid layout).
    expect(fields.map((f) => f.props.icon)).toEqual([
      "squareDashedTopSolidLeft",
      "squareDashedTopSolid",
      "squareDashedTopSolidRight",
      "squareDashedTopSolidBottom",
    ]);
    expect(fields.map((f) => f.props.value)).toEqual(["4", "1", "2", "3"]);
    // Collapse (vault) + disable (minus) buttons.
    expect(buttons(root).map((b) => b.props.icon)).toEqual(["vault", "minus"]);
  });
});

describe("BorderPanel — behavior", () => {
  test("enable button writes borderEnabled:true; disable writes false", async () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { borderEnabled: false } },
    ]);
    const enable = findNodeByType(harness.tree().root, "button")!;
    expect(enable.props.icon).toBe("plus");
    act(() => {
      harness.dispatch(enable.id, "onClick");
    });
    await flush();
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderEnabled: true },
    });
    expect(harness.undoDepth()).toBe(1);

    // The body now renders; the disable `−` button writes false.
    const disable = buttons(harness.tree().root).find((b) => b.props.icon === "minus")!;
    harness.dispatch(disable.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderEnabled: false },
    });
  });

  test("uniform width typing is a draft writing all four sides", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { borderEnabled: true, ...uniformWidth(1) } },
    ]);
    const width = textFields(harness.tree().root)[0]!;
    harness.dispatch(width.id, "onChange", ["5"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: {
        borderTopWidth: 5,
        borderRightWidth: 5,
        borderBottomWidth: 5,
        borderLeftWidth: 5,
      },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(width.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
  });

  test("expand then collapse-to-uniform is a direct write of all four sides", async () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { borderEnabled: true, ...uniformWidth(3) } },
    ]);
    const expand = buttons(harness.tree().root).find((b) => b.props.icon === "fullscreen")!;
    act(() => {
      harness.dispatch(expand.id, "onClick");
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(4);
    expect(calls).toHaveLength(0);

    const collapse = buttons(harness.tree().root).find((b) => b.props.icon === "vault")!;
    act(() => {
      harness.dispatch(collapse.id, "onClick");
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: {
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderTopWidth: 3,
        borderBottomWidth: 3,
      },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("an individual side types via draft with a single-side payload", () => {
    const { harness, nodeIds, calls } = mount([
      {
        type: "view",
        style: {
          borderEnabled: true,
          borderTopWidth: 1,
          borderRightWidth: 2,
          borderBottomWidth: 3,
          borderLeftWidth: 4,
        },
      },
    ]);
    // Left is the first field.
    const left = textFields(harness.tree().root)[0]!;
    harness.dispatch(left.id, "onChange", ["7"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderLeftWidth: 7 },
    });
    expect(harness.draftActive()).toBe(true);
  });

  test("color drag is a begin/commit draft gesture", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "view", style: { borderEnabled: true, borderColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;
    harness.dispatch(color.id, "onDragStart");
    expect(harness.draftActive()).toBe(true);
    harness.dispatch(color.id, "onChange", ["rgba(1, 2, 3, 1)"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderColor: "rgba(1, 2, 3, 1)" },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(color.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
  });

  test("reset hierarchy: borderEnabled reset short-circuits width/color resets", async () => {
    // Base disabled; the override RE-ENABLES the border AND changes its color. The
    // body renders (effective borderEnabled === true) and both `borderEnabled` +
    // `borderColor` are overridden, so the enabled reset must win and the color +
    // width resets must be short-circuited.
    const { doc, harness, nodeIds } = mount([
      {
        type: "view",
        style: { borderEnabled: false, ...uniformWidth(2), borderColor: "rgba(0, 0, 0, 1)" },
      },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { borderEnabled: true, borderColor: "rgba(5, 5, 5, 1)" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const resets = findNodesByType(harness.tree().root, "resetAffordance");
    // Every SHOWN reset is a "border enabled" reset; the border color reset is
    // present in the tree (body visible) but short-circuited to hidden.
    const shown = resets.filter((r) => r.props.show === true);
    expect(shown.length).toBeGreaterThan(0);
    for (const r of shown) expect(r.props.label).toBe("border enabled");
    const colorReset = resets.find((r) => r.props.label === "border color")!;
    expect(colorReset.props.show).toBe(false);
  });

  test("border color override reset writes the base color back (no enabled override)", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "view", style: { borderEnabled: true, borderColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { borderColor: "rgba(255, 0, 0, 1)" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const colorReset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "border color",
    )!;
    expect(colorReset.props.show).toBe(true);
    harness.dispatch(colorReset.id, "onReset");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderColor: "rgba(0, 0, 0, 1)" },
    });
    expect(harness.undoDepth()).toBe(1);
  });
});
