// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { setStateOverrideSelection } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { StatesPanel } from "./states-panel";
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
afterEach(() => {
  restoreWatch?.();
  restoreWatch = undefined;
  harness?.dispose();
  harness = undefined;
});

interface SelectionCall {
  nodeId: string;
  stateId: string | null;
}

/** Mounts the states panel over `seeds`, watching `setStateOverrideSelection`. */
function mount(seeds: Parameters<typeof seedNodes>[1], extraNodeIds?: string[]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<SelectionCall>[] = [];
  restoreWatch = watchAction(setStateOverrideSelection as never, calls as never);
  harness = mountPanelDefinition(StatesPanel, doc, {
    nodeIds: extraNodeIds ? [nodeIds[0]!, ...extraNodeIds] : [nodeIds[0]!],
  });
  return { doc, harness, nodeIds, calls };
}

/** Removes a state entry directly on the doc (to exercise the stale-cleanup effect). */
function removeState(doc: ReturnType<typeof createOfflineDesignerDocument>, nodeId: string, stateId: string) {
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    (node as unknown as { data: { states: { remove: (id: string) => void } } }).data.states.remove(
      stateId,
    );
  });
}

describe("StatesPanel — structure", () => {
  test("state buttons render Default + one per node state", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedStateOverride(doc, nodeIds[0]!, { name: "Hovered", style: {} });
    seedStateOverride(doc, nodeIds[0]!, { name: "Pressed", style: {} });
    harness = mountPanelDefinition(StatesPanel, doc, { nodeIds: [nodeIds[0]!] });

    const buttons = findNodesByType(harness.tree().root, "button");
    // Settings + Default + 2 state buttons.
    const labels = buttons.map((b) => b.props.label).filter(Boolean);
    expect(labels).toEqual(["Default", "Hovered", "Pressed"]);
    const settings = buttons.find((b) => b.props.icon === "settings");
    expect(settings).toBeDefined();
  });

  test("no state buttons (only Settings) when the node has no states", () => {
    const { harness } = mount([{ type: "view" }]);
    const buttons = findNodesByType(harness.tree().root, "button");
    expect(buttons.map((b) => b.props.label).filter(Boolean)).toEqual([]);
    expect(findNodeByType(harness.tree().root, "column")).toBeUndefined();
  });
});

describe("StatesPanel — selection", () => {
  test("selecting a state dispatches setStateOverrideSelection with the state id", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { name: "Hovered", style: {} });
    const calls: ActionCall<SelectionCall>[] = [];
    restoreWatch = watchAction(setStateOverrideSelection as never, calls as never);
    harness = mountPanelDefinition(StatesPanel, doc, { nodeIds: [nodeIds[0]!] });

    const hovered = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.label === "Hovered",
    )!;
    harness.dispatch(hovered.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({ nodeId: nodeIds[0], stateId });
    // A plain (non-undoable) selection action does not touch the undo stack.
    expect(harness.undoDepth()).toBe(0);
  });

  test("selecting Default dispatches stateId: null", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { name: "Hovered", style: {} });
    const calls: ActionCall<SelectionCall>[] = [];
    restoreWatch = watchAction(setStateOverrideSelection as never, calls as never);
    harness = mountPanelDefinition(StatesPanel, doc, { nodeIds: [nodeIds[0]!] });
    act(() => selectState(harness!.store, nodeIds[0]!, stateId));

    const def = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.label === "Default",
    )!;
    harness.dispatch(def.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({ nodeId: nodeIds[0], stateId: null });
  });

  test("buttons are disabled on a multi-node selection", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }, { type: "view" }]);
    seedStateOverride(doc, nodeIds[0]!, { name: "Hovered", style: {} });
    harness = mountPanelDefinition(StatesPanel, doc, { nodeIds });

    const stateButtons = findNodesByType(harness.tree().root, "button").filter((b) =>
      ["Default", "Hovered"].includes(b.props.label as string),
    );
    expect(stateButtons.length).toBe(2);
    for (const b of stateButtons) expect(b.props.disabled).toBe(true);
  });
});

describe("StatesPanel — stale-selection cleanup", () => {
  test("deleting the selected state clears the override selection", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { name: "Hovered", style: {} });
    const calls: ActionCall<SelectionCall>[] = [];
    restoreWatch = watchAction(setStateOverrideSelection as never, calls as never);
    harness = mountPanelDefinition(StatesPanel, doc, { nodeIds: [nodeIds[0]!] });
    act(() => selectState(harness!.store, nodeIds[0]!, stateId));
    await flush();

    // Delete the selected state under the selection.
    act(() => removeState(doc, nodeIds[0]!, stateId));
    await flush();

    // The definition's stale-cleanup effect fired setStateOverrideSelection(null).
    expect(calls.at(-1)!.params).toEqual({ nodeId: nodeIds[0], stateId: null });
    expect(harness.store.getState().stateOverrideSelection[nodeIds[0]!] ?? null).toBe(null);
  });
});

describe("StatesPanel — host services", () => {
  test("the Settings button opens the host State Manager for the node", () => {
    const { harness, nodeIds } = mount([{ type: "view" }]);
    const settings = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.icon === "settings",
    )!;
    harness.dispatch(settings.id, "onClick");
    expect(harness.hostLog.openStateManager).toEqual([nodeIds[0]]);
  });
});
