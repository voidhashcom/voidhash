// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateTextFillStyle } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { TextFillPanel } from "./text-fill-panel";
import {
  findNodeByType,
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

function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updateTextFillStyle as never, calls as never);
  harness = mountPanelDefinition(TextFillPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

describe("TextFillPanel — snapshot structure", () => {
  test("single node: Fill section wrapping a color field in a reset affordance", () => {
    const { harness } = mount([{ type: "text", style: { color: "rgba(4, 5, 6, 1)" } }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Fill");
    const reset = findNodeByType(root, "resetAffordance")!;
    expect(reset.props.label).toBe("text color");
    // No override selected → the reset affordance is hidden.
    expect(reset.props.show).toBe(false);

    const color = findNodeByType(root, "colorField")!;
    expect(color.props.value).toBe("rgba(4, 5, 6, 1)");
    // Single selection → not mixed (the section always passes the boolean).
    expect(color.props.mixed).toBe(false);
  });

  test("multi-select with differing color surfaces the mixed flag", () => {
    const { harness } = mount([
      { type: "text", style: { color: "rgba(1, 1, 1, 1)" } },
      { type: "text", style: { color: "rgba(2, 2, 2, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;
    expect(color.props.mixed).toBe(true);
  });

  test("override-active state shows the reset affordance", async () => {
    const { doc, harness, nodeIds } = mount([
      { type: "text", style: { color: "rgba(0, 0, 0, 1)" } },
    ]);
    // Seed a state with a `color` override, then select it: the reset context
    // becomes active and the affordance is shown.
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { color: "rgba(255, 0, 0, 1)" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const reset = findNodeByType(harness.tree().root, "resetAffordance")!;
    expect(reset.props.show).toBe(true);
    // The color field now reflects the effective (overridden) color.
    expect(findNodeByType(harness.tree().root, "colorField")?.props.value).toBe(
      "rgba(255, 0, 0, 1)",
    );
  });
});

describe("TextFillPanel — behavior", () => {
  test("color drag: begin → live change payload → commit is one gesture", () => {
    const { harness, nodeIds, calls } = mount([
      { type: "text", style: { color: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;

    harness.dispatch(color.id, "onDragStart");
    expect(harness.draftActive()).toBe(true);
    expect(harness.undoDepth()).toBe(0);

    harness.dispatch(color.id, "onChange", ["rgba(9, 9, 9, 1)"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { color: "rgba(9, 9, 9, 1)" },
    });
    // Draft suppresses per-frame undo entries.
    expect(harness.undoDepth()).toBe(0);

    // Commit ends the gesture. Text is state-capable, so the write persisted:
    // the draft commits as ONE document batch.
    const before = harness.submittedCount();
    harness.dispatch(color.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
    expect(harness.submittedCount()).toBe(before + 1);
    // The committed base color reflects the gesture's final value.
    expect(harness.nodeStyle(nodeIds[0]!).color).toBe("rgba(9, 9, 9, 1)");
    // The gesture recorded no intermediate commander entries.
    expect(harness.undoDepth()).toBe(0);
  });

  test("color drag discard reverts the in-flight gesture", () => {
    const { harness, nodeIds } = mount([
      { type: "text", style: { color: "rgba(0, 0, 0, 1)" } },
    ]);
    const color = findNodeByType(harness.tree().root, "colorField")!;

    harness.dispatch(color.id, "onDragStart");
    harness.dispatch(color.id, "onChange", ["rgba(5, 5, 5, 1)"]);
    const before = harness.submittedCount();
    harness.dispatch(color.id, "onDiscard");
    expect(harness.draftActive()).toBe(false);
    // A discarded draft submits nothing; the committed color is unchanged.
    expect(harness.submittedCount()).toBe(before);
    expect(harness.nodeStyle(nodeIds[0]!).color).toBe("rgba(0, 0, 0, 1)");
  });

  test("onReset writes the base color back via buildResetPatch", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "text", style: { color: "rgba(0, 0, 0, 1)" } },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, {
      style: { color: "rgba(255, 0, 0, 1)" },
    });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const reset = findNodeByType(harness.tree().root, "resetAffordance")!;
    expect(reset.props.show).toBe(true);

    harness.dispatch(reset.id, "onReset");
    // onReset writes the BASE color (from buildResetPatch(["color"])) — a direct
    // write of the base value, which clears the state override entry.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { color: "rgba(0, 0, 0, 1)" },
    });
    expect(harness.undoDepth()).toBe(1);
  });
});
