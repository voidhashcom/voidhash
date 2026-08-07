// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vite-plus/test";

import { updatePathFillStyle } from "../../../state/actions/features/path-fill-style-actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { PathFillPanel } from "./path-fill-panel";
import {
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

/** Mounts the path-fill panel over `seeds`, watching `updatePathFillStyle`. */
function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updatePathFillStyle as never, calls as never);
  harness = mountPanelDefinition(PathFillPanel, doc, { nodeIds });
  return { harness, nodeIds, calls };
}

describe("PathFillPanel — snapshot structure", () => {
  test("disabled fill: header + enable button, no content controls", () => {
    const { harness } = mount([{ type: "path" }]);
    const root = harness.tree().root;

    const section = findNodeByType(root, "section");
    expect(section?.props.title).toBe("Fill");
    // The `+` enable button lives in a sectionActions node.
    const actions = findNodeByType(root, "sectionActions");
    expect(actions).toBeDefined();
    const enableButton = findNodeByType(actions!, "button");
    expect(enableButton?.props.icon).toBe("plus");
    // No fill controls while disabled.
    expect(findNodeByType(root, "toggleGroup")).toBeUndefined();
    expect(findNodeByType(root, "colorField")).toBeUndefined();
  });

  test("enabled fill: fillRule toggle, disable button, color field", () => {
    const { harness } = mount([
      { type: "path", style: { fillEnabled: true, fillColor: "rgba(10, 20, 30, 1)" } },
    ]);
    const root = harness.tree().root;

    // No enable button in the header when already enabled.
    expect(findNodeByType(root, "sectionActions")).toBeUndefined();

    // The toggle + disable button share a stretch/space-between row (matching the
    // legacy `flex flex-row justify-between gap-2` — no items-center).
    const row = findNodeByType(root, "row")!;
    expect(row.props.align).toBe("stretch");
    expect(row.props.justify).toBe("between");

    const toggle = findNodeByType(root, "toggleGroup")!;
    const toggleOptions = toggle.props.options as { value: string; label?: string }[];
    expect(toggleOptions.map((o) => o.value)).toEqual(["nonzero", "evenodd"]);
    expect(toggle.props.value).toBe("nonzero");

    // The disable `−` button sits in the content row (not the header).
    const buttons = findNodesByType(root, "button");
    expect(buttons.map((b) => b.props.icon)).toEqual(["minus"]);

    const color = findNodeByType(root, "colorField");
    expect(color?.props.value).toBe("rgba(10, 20, 30, 1)");
    expect(color?.props.mixed).toBeUndefined();
  });

  test("multi-select shows the first node's fillRule (legacy section wires no mixed here)", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { fillEnabled: true, fillRule: "evenodd" } },
      { type: "path", style: { fillEnabled: true, fillRule: "nonzero" } },
    ]);
    const root = harness.tree().root;
    const toggle = findNodeByType(root, "toggleGroup")!;
    // The legacy path-fill section passes `value={fill.fillRule}` with no `mixed`
    // flag (it never reads `mixedKeys`), so the first node's value shows and no
    // mixed indicator appears — replicated exactly.
    expect(toggle.props.value).toBe("evenodd");
    expect(toggle.props.mixed).toBeUndefined();

    // A write targets ALL selected paths.
    harness.dispatch(toggle.id, "onChange", ["nonzero"]);
    expect(calls[0]!.params).toEqual({
      nodes: [
        { nodeId: nodeIds[0], nodeType: "path" },
        { nodeId: nodeIds[1], nodeType: "path" },
      ],
      style: { fillRule: "nonzero" },
    });
  });
});

describe("PathFillPanel — behavior", () => {
  test("color drag: begin → live change payload → commit is one gesture", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { fillEnabled: true, fillColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;

    // onDragStart begins a draft.
    harness.dispatch(color.id, "onDragStart");
    expect(harness.draftActive()).toBe(true);
    expect(harness.undoDepth()).toBe(0);

    // onChange mid-gesture dispatches the action with the EXACT payload into the
    // draft (no undo entry while the draft is active — the draft suppresses the
    // per-frame commander push).
    harness.dispatch(color.id, "onChange", ["rgba(9, 9, 9, 1)"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { fillColor: "rgba(9, 9, 9, 1)" },
    });
    expect(harness.undoDepth()).toBe(0);

    // onCommit clears the active draft and commits it as a SINGLE step (no
    // per-frame undo entries). Path styles are non-state-capable, so the write
    // is a document no-op — exactly as the legacy section behaves — but the
    // gesture lifecycle still resolves: the draft is no longer active and the
    // commander stack stays free of intermediate entries.
    harness.dispatch(color.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(0);
  });

  test("color drag discard clears the in-flight gesture", () => {
    const { harness } = mount([
      { type: "path", style: { fillEnabled: true, fillColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;

    harness.dispatch(color.id, "onDragStart");
    harness.dispatch(color.id, "onChange", ["rgba(5, 5, 5, 1)"]);
    expect(harness.draftActive()).toBe(true);
    const before = harness.submittedCount();
    harness.dispatch(color.id, "onDiscard");
    expect(harness.draftActive()).toBe(false);
    // A discarded draft submits nothing.
    expect(harness.submittedCount()).toBe(before);
    expect(harness.undoDepth()).toBe(0);
  });

  test("fillRule toggle is a direct write with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { fillEnabled: true, fillRule: "nonzero" } },
    ]);
    const toggle = findNodeByType(harness.tree().root, "toggleGroup")!;

    harness.dispatch(toggle.id, "onChange", ["evenodd"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { fillRule: "evenodd" },
    });
    // Direct (non-draft) write records exactly one commander undo entry.
    expect(harness.undoDepth()).toBe(1);
    expect(harness.draftActive()).toBe(false);
  });

  test("enable button writes fillEnabled:true with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([{ type: "path" }]);
    const enable = findNodeByType(harness.tree().root, "button")!;
    expect(enable.props.icon).toBe("plus");

    harness.dispatch(enable.id, "onClick");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { fillEnabled: true },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("disable button writes fillEnabled:false with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { fillEnabled: true } },
    ]);
    // The only button while enabled is the `−` disable button.
    const disable = findNodeByType(harness.tree().root, "button")!;
    expect(disable.props.icon).toBe("minus");

    harness.dispatch(disable.id, "onClick");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { fillEnabled: false },
    });
    expect(harness.undoDepth()).toBe(1);
  });
});
