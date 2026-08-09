// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vite-plus/test";

import { updatePathStrokeStyle } from "../../../state/actions/features/path-stroke-style-actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { PathStrokePanel } from "./path-stroke-panel";
import {
  findNodeByLabel,
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
  walkTree,
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

function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updatePathStrokeStyle as never, calls as never);
  harness = mountPanelDefinition(PathStrokePanel, doc, { nodeIds });
  return { harness, nodeIds, calls };
}

/** The two toggle groups in document order: [Line Cap, Line Join]. */
const toggleGroups = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "toggleGroup");

describe("PathStrokePanel — snapshot structure", () => {
  test("disabled stroke: header + enable button, no content", () => {
    const { harness } = mount([{ type: "path" }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Stroke");
    const actions = findNodeByType(root, "sectionActions")!;
    expect(findNodeByType(actions, "button")?.props.icon).toBe("plus");
    expect(findNodeByType(root, "textField")).toBeUndefined();
    expect(toggleGroups(root)).toHaveLength(0);
  });

  test("enabled stroke: width field, cap/join toggles, color field", () => {
    const { harness } = mount([
      {
        type: "path",
        style: {
          strokeEnabled: true,
          strokeWidth: 3,
          strokeLinecap: "round",
          strokeLinejoin: "bevel",
          strokeColor: "rgba(1, 2, 3, 1)",
        },
      },
    ]);
    const root = harness.tree().root;

    // Width subsection: a number textField (square icon) + a `−` disable button.
    expect(findNodeByLabel(root, "Width")?.type).toBe("subsection");
    const width = findNodeByType(root, "textField")!;
    expect(width.props.kind).toBe("number");
    expect(width.props.icon).toBe("square");
    expect(width.props.value).toBe("3");
    const buttons = findNodesByType(root, "button");
    expect(buttons.map((b) => b.props.icon)).toEqual(["minus"]);

    // Line Cap + Line Join toggles, in order.
    const [cap, join] = toggleGroups(root);
    expect((cap!.props.options as { value: string }[]).map((o) => o.value)).toEqual([
      "butt",
      "round",
      "square",
    ]);
    expect(cap!.props.value).toBe("round");
    expect((join!.props.options as { value: string }[]).map((o) => o.value)).toEqual([
      "miter",
      "round",
      "bevel",
    ]);
    expect(join!.props.value).toBe("bevel");

    expect(findNodeByType(root, "colorField")?.props.value).toBe("rgba(1, 2, 3, 1)");

    // Cap/Join subsection titles present.
    const titles = [...walkTree(root)]
      .filter((n) => n.type === "subsection")
      .map((n) => n.props.title);
    expect(titles).toEqual(["Width", "Line Cap", "Line Join"]);
  });
});

describe("PathStrokePanel — behavior", () => {
  test("width field is a draft gesture: begin-on-first-change → commit", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { strokeEnabled: true, strokeWidth: 2 } },
    ]);
    const width = findNodeByType(harness.tree().root, "textField")!;

    // Typing begins the draft on the first change and writes live into it.
    expect(harness.draftActive()).toBe(false);
    harness.dispatch(width.id, "onChange", ["5"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeWidth: 5 },
    });
    expect(harness.undoDepth()).toBe(0);

    // A second change stays in the same draft (no second draft, no undo entry).
    harness.dispatch(width.id, "onChange", ["6"]);
    expect(calls).toHaveLength(2);
    expect(harness.undoDepth()).toBe(0);

    // Commit ends the gesture as a single step.
    harness.dispatch(width.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(0);
  });

  test("line cap toggle is a direct write with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { strokeEnabled: true, strokeLinecap: "butt" } },
    ]);
    const [cap] = toggleGroups(harness.tree().root);

    harness.dispatch(cap!.id, "onChange", ["round"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeLinecap: "round" },
    });
    expect(harness.undoDepth()).toBe(1);
    expect(harness.draftActive()).toBe(false);
  });

  test("line join toggle is a direct write with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { strokeEnabled: true, strokeLinejoin: "miter" } },
    ]);
    const [, join] = toggleGroups(harness.tree().root);

    harness.dispatch(join!.id, "onChange", ["bevel"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeLinejoin: "bevel" },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("color drag begins/commits a draft; enable/disable are direct writes", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "path", style: { strokeEnabled: true, strokeColor: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;

    harness.dispatch(color.id, "onDragStart");
    expect(harness.draftActive()).toBe(true);
    harness.dispatch(color.id, "onChange", ["rgba(7, 7, 7, 1)"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeColor: "rgba(7, 7, 7, 1)" },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(color.id, "onCommit");
    expect(harness.draftActive()).toBe(false);

    // The disable `−` button is a direct write.
    const disable = findNodeByType(harness.tree().root, "button")!;
    expect(disable.props.icon).toBe("minus");
    harness.dispatch(disable.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeEnabled: false },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("enable button writes strokeEnabled:true with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([{ type: "path" }]);
    const enable = findNodeByType(harness.tree().root, "button")!;
    expect(enable.props.icon).toBe("plus");
    harness.dispatch(enable.id, "onClick");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "path" }],
      style: { strokeEnabled: true },
    });
    expect(harness.undoDepth()).toBe(1);
  });
});
