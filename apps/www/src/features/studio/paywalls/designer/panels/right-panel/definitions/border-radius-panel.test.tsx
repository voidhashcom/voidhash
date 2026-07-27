// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateBorderRadiusStyle } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { BorderRadiusPanel } from "./border-radius-panel";
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

/** A view node with all four corners set uniformly to `r`. */
const uniform = (r: number) => ({
  borderTopLeftRadius: r,
  borderTopRightRadius: r,
  borderBottomRightRadius: r,
  borderBottomLeftRadius: r,
});

function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updateBorderRadiusStyle as never, calls as never);
  harness = mountPanelDefinition(BorderRadiusPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

/** The number text fields in document order. */
const textFields = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "textField");
/** The expand/collapse button (the only button in this panel). */
const toggleButton = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "button")[0]!;

describe("BorderRadiusPanel — snapshot structure", () => {
  test("uniform corners: single Radius field (scan icon) + expand button", () => {
    const { harness } = mount([{ type: "view", style: uniform(8) }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Border Radius");
    const fields = textFields(root);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.props.icon).toBe("scan");
    expect(fields[0]!.props.value).toBe("8");
    expect(toggleButton(root).props.icon).toBe("fullscreen");
    // Uniform reset affordance is present but hidden (no override active).
    expect(findNodeByType(root, "resetAffordance")?.props.show).toBe(false);
  });

  test("non-uniform corners seed the expanded view: 4 fields with corner icons", () => {
    const { harness } = mount([
      {
        type: "view",
        style: {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 3,
          borderBottomLeftRadius: 4,
        },
      },
    ]);
    const root = harness.tree().root;
    const fields = textFields(root);
    expect(fields).toHaveLength(4);
    expect(fields.map((f) => f.props.icon)).toEqual([
      "squareRoundCornerTopLeft",
      "squareRoundCorner",
      "squareRoundCornerBottomLeft",
      "squareRoundCornerBottomRight",
    ]);
    expect(fields.map((f) => f.props.value)).toEqual(["1", "2", "4", "3"]);
    // Collapse button (vault icon) in the expanded view.
    expect(toggleButton(root).props.icon).toBe("vault");
  });

  test("multi-select with a mixed corner seeds expanded + surfaces the mixed flag", () => {
    const { harness } = mount([
      { type: "view", style: uniform(4) },
      { type: "view", style: uniform(10) },
    ]);
    const root = harness.tree().root;
    // Any corner mixed → expanded seed; each field reflects its own mixed flag.
    expect(textFields(root)).toHaveLength(4);
    const topLeft = textFields(root)[0]!;
    expect(topLeft.props.mixed).toBe(true);
  });
});

describe("BorderRadiusPanel — behavior", () => {
  test("uniform typing is a draft that writes all four corners; commit ends it", () => {
    const { harness, nodeIds, calls } = mount([{ type: "view", style: uniform(0) }]);
    const field = textFields(harness.tree().root)[0]!;

    expect(harness.draftActive()).toBe(false);
    harness.dispatch(field.id, "onChange", ["12"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        borderBottomLeftRadius: 12,
      },
    });
    expect(harness.undoDepth()).toBe(0);

    harness.dispatch(field.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
    expect(harness.undoDepth()).toBe(0);
  });

  test("expand then collapse-to-uniform is a direct write of all four corners", async () => {
    const { harness, nodeIds, calls } = mount([{ type: "view", style: uniform(6) }]);
    // Expand: local state flips to the 4-field grid (a re-emit, no action).
    act(() => {
      harness.dispatch(toggleButton(harness.tree().root).id, "onClick");
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(4);
    expect(calls).toHaveLength(0);

    // Collapse: a DIRECT write of all four corners from the top-left value.
    act(() => {
      harness.dispatch(toggleButton(harness.tree().root).id, "onClick");
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: {
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        borderBottomLeftRadius: 6,
      },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("an individual corner types via draft with a single-corner payload", async () => {
    const { harness, nodeIds, calls } = mount([
      {
        type: "view",
        style: {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 3,
          borderBottomLeftRadius: 4,
        },
      },
    ]);
    const bottomRight = textFields(harness.tree().root)[3]!;
    harness.dispatch(bottomRight.id, "onChange", ["9"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: { borderBottomRightRadius: 9 },
    });
    expect(harness.undoDepth()).toBe(0);
  });

  test("override-active uniform reset writes the base value back", async () => {
    const { doc, harness, nodeIds, calls } = mount([{ type: "view", style: uniform(8) }]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { style: uniform(20) });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const reset = findNodeByType(harness.tree().root, "resetAffordance")!;
    expect(reset.props.label).toBe("border radius");
    expect(reset.props.show).toBe(true);
    // The uniform field now reflects the overridden value.
    expect(textFields(harness.tree().root)[0]!.props.value).toBe("20");

    harness.dispatch(reset.id, "onReset");
    // Resets all four corners to the base value (buildResetPatch over ALL_KEYS).
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "view" }],
      style: uniform(8),
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("expanded view state persists across a store-driven re-emit", async () => {
    const { harness, nodeIds } = mount([
      {
        type: "view",
        style: {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 3,
          borderBottomLeftRadius: 4,
        },
      },
    ]);
    // Seeded expanded (non-uniform). Drive an unrelated store change to force a
    // re-emit; the local `showIndividual` state must survive.
    act(() => {
      selectState(harness.store, nodeIds[0]!, null);
    });
    await flush();
    expect(textFields(harness.tree().root)).toHaveLength(4);
  });
});
