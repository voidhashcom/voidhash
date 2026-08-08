// @vitest-environment jsdom

import { act } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import { updateTypographyStyle } from "../../../state/actions";
import { createOfflineDesignerDocument } from "../../../state/testing/offline-document";
import { TypographyPanel } from "./typography-panel";
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

/** A text node with the given typography fields (schema fills the rest). */
const typo = (over: Record<string, unknown> = {}) => ({
  fontSize: 16,
  fontWeight: "400",
  textAlign: "left",
  lineHeight: 1.5,
  letterSpacing: 0,
  ...over,
});

function mount(seeds: Parameters<typeof seedNodes>[1]) {
  const doc = createOfflineDesignerDocument();
  const { nodeIds } = seedNodes(doc, seeds);
  const calls: ActionCall<{ nodes: unknown; style: Record<string, unknown> }>[] = [];
  restoreWatch = watchAction(updateTypographyStyle as never, calls as never);
  harness = mountPanelDefinition(TypographyPanel, doc, { nodeIds });
  return { doc, harness, nodeIds, calls };
}

/** The select fields in document order: [Font Family, Font Weight]. */
const selects = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "selectField");
/** The text fields in document order: [Font Size, Line Height, Letter Spacing]. */
const textFields = (root: Parameters<typeof findNodesByType>[0]) =>
  findNodesByType(root, "textField");

describe("TypographyPanel — snapshot structure", () => {
  test("single node: family(disabled)/weight selects, size/lineHeight/letter fields, align toggle", () => {
    const { harness } = mount([{ type: "text", style: typo() }]);
    const root = harness.tree().root;

    expect(findNodeByType(root, "section")?.props.title).toBe("Typography");

    const [family, weight] = selects(root);
    expect(family!.props.disabled).toBe(true);
    expect((family!.props.options as { value: string }[])[0]!.value).toBe("geist-variable");
    expect(weight!.props.value).toBe("400");
    expect((weight!.props.options as { value: string }[]).map((o) => o.value)).toEqual([
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
    ]);

    const [size, lineHeight, letter] = textFields(root);
    expect(size!.props.icon).toBe("type");
    expect(size!.props.value).toBe("16");
    expect(lineHeight!.props.icon).toBe("a");
    // lineHeight 1.5 (not Auto) → the field is enabled, showing the number.
    expect(lineHeight!.props.disabled).toBe(false);
    expect(lineHeight!.props.value).toBe("1.5");
    expect(letter!.props.value).toBe("0");

    const align = findNodeByType(root, "toggleGroup")!;
    expect(align.props.value).toBe("left");
    expect((align.props.options as { value: string }[]).map((o) => o.value)).toEqual([
      "left",
      "center",
      "right",
    ]);
  });

  test("lineHeight 0 renders as Auto: disabled field, trailing menu present", () => {
    const { harness } = mount([{ type: "text", style: typo({ lineHeight: 0 }) }]);
    const root = harness.tree().root;
    const lineHeight = textFields(root)[1]!;
    expect(lineHeight.props.disabled).toBe(true);
    expect(lineHeight.props.value).toBe("Auto");
    // The trailing menu is the object { items } — Auto + a "Fixed (1.5)" default.
    const trailing = lineHeight.props.trailingMenu as { items: { value: string; label: string }[] };
    expect(trailing.items.map((i) => i.value)).toEqual(["auto", "fixed"]);
    expect(trailing.items[1]!.label).toBe("Fixed (1.5)");
  });

  test("multi-select surfaces mixed flags; textAlign mixed clears the toggle value", () => {
    const { harness } = mount([
      { type: "text", style: typo({ fontSize: 12, textAlign: "left" }) },
      { type: "text", style: typo({ fontSize: 20, textAlign: "right" }) },
    ]);
    const root = harness.tree().root;
    expect(textFields(root)[0]!.props.mixed).toBe(true); // font size
    const align = findNodeByType(root, "toggleGroup")!;
    expect(align.props.mixed).toBe(true);
    // The renderer maps `mixed` → empty value, so no segment is highlighted.
  });
});

describe("TypographyPanel — behavior", () => {
  test("font weight select is a direct write with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ fontWeight: "400" }) }]);
    const weight = selects(harness.tree().root)[1]!;
    harness.dispatch(weight.id, "onChange", ["700"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { fontWeight: "700" },
    });
    expect(harness.undoDepth()).toBe(1);
    expect(harness.draftActive()).toBe(false);
  });

  test("font size typing is a draft; commit ends the gesture", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ fontSize: 16 }) }]);
    const size = textFields(harness.tree().root)[0]!;
    harness.dispatch(size.id, "onChange", ["24"]);
    expect(harness.draftActive()).toBe(true);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { fontSize: 24 },
    });
    expect(harness.undoDepth()).toBe(0);
    harness.dispatch(size.id, "onCommit");
    expect(harness.draftActive()).toBe(false);
  });

  test("letter spacing typing is a draft with a letterSpacing payload", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ letterSpacing: 0 }) }]);
    const letter = textFields(harness.tree().root)[2]!;
    harness.dispatch(letter.id, "onChange", ["0.5"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { letterSpacing: 0.5 },
    });
    expect(harness.draftActive()).toBe(true);
  });

  test("textAlign toggle is a direct write with one undo entry", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ textAlign: "left" }) }]);
    const align = findNodeByType(harness.tree().root, "toggleGroup")!;
    harness.dispatch(align.id, "onChange", ["center"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { textAlign: "center" },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("lineHeight Auto→Fixed via trailing menu writes 1.5 when currently Auto", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ lineHeight: 0 }) }]);
    const lineHeight = textFields(harness.tree().root)[1]!;
    harness.dispatch(lineHeight.id, "onTrailingSelect", ["fixed"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { lineHeight: 1.5 },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("lineHeight Fixed→Auto via trailing menu writes 0", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ lineHeight: 2 }) }]);
    const lineHeight = textFields(harness.tree().root)[1]!;
    harness.dispatch(lineHeight.id, "onTrailingSelect", ["auto"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { lineHeight: 0 },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("lineHeight Fixed→Fixed keeps the current value", () => {
    const { harness, nodeIds, calls } = mount([{ type: "text", style: typo({ lineHeight: 2 }) }]);
    const lineHeight = textFields(harness.tree().root)[1]!;
    // Currently Fixed (2): selecting "fixed" keeps 2.
    harness.dispatch(lineHeight.id, "onTrailingSelect", ["fixed"]);
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { lineHeight: 2 },
    });
  });

  test("override-active lineHeight reset writes the base value back", async () => {
    const { doc, harness, nodeIds, calls } = mount([
      { type: "text", style: typo({ lineHeight: 1.5 }) },
    ]);
    const stateId = seedStateOverride(doc, nodeIds[0]!, { style: { lineHeight: 3 } });
    act(() => {
      selectState(harness.store, nodeIds[0]!, stateId);
    });
    await flush();

    const reset = findNodesByType(harness.tree().root, "resetAffordance").find(
      (r) => r.props.label === "line height",
    )!;
    expect(reset.props.show).toBe(true);
    // The field reflects the overridden value.
    expect(textFields(harness.tree().root)[1]!.props.value).toBe("3");

    harness.dispatch(reset.id, "onReset");
    expect(calls[0]!.params).toEqual({
      nodes: [{ nodeId: nodeIds[0], nodeType: "text" }],
      style: { lineHeight: 1.5 },
    });
    expect(harness.undoDepth()).toBe(1);
  });

  test("all five reset affordances exist with the expected labels", () => {
    const { harness } = mount([{ type: "text", style: typo() }]);
    const labels = findNodesByType(harness.tree().root, "resetAffordance").map(
      (r) => r.props.label,
    );
    expect(labels).toEqual([
      "font weight",
      "font size",
      "line height",
      "letter spacing",
      "text align",
    ]);
  });
});
