// @vitest-environment jsdom

import type { VariableType } from "@voidhash/mimic-schema";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// The product literal editor renders a ProductInput reading TanStack Router
// params; outside a route `useParams({strict:false})` returns `{}`.
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({}) }));

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import type { PanelNode } from "../../../panel-runtime/schema";

import { addVariable, removeVariable, updateVariable } from "../../../state/actions";
import { createOfflineDesignerDocument, type OfflineDesignerDocument } from "../../../state/testing/offline-document";
import { VariablesPanel } from "./variables-panel";
import {
  findNodeByLabel,
  findNodesByType,
  findNodeByType,
  mountPanelDefinition,
  seedNodes,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
const restore: (() => void)[] = [];
afterEach(() => {
  while (restore.length) restore.pop()!();
  harness?.dispose();
  harness = undefined;
});

/** Seeds a local variable directly onto a node's `data.localVariables`. */
function seedVariable(
  doc: OfflineDesignerDocument,
  nodeId: string,
  name: string,
  value: VariableType,
): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    const created = (
      node as unknown as {
        data: { localVariables: { push: (v: unknown) => { id: string } } };
      }
    ).data.localVariables.push({ id: `internal-${name}`, name, value });
    entryId = created.id;
  });
  return entryId;
}

/** All popover trigger buttons (the variable rows). */
const rowButtons = (h: PanelHarness): PanelNode[] =>
  findNodesByType(h.tree().root, "button").filter((b) => typeof b.props.label === "string" && b.props.label !== "");

describe("VariablesPanel — rows", () => {
  test("renders a row per variable, including product display", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedVariable(doc, nodeIds[0]!, "greeting", { key: "string", value: "hi" });
    seedVariable(doc, nodeIds[0]!, "count", { key: "number", value: 3 });
    seedVariable(doc, nodeIds[0]!, "isPro", { key: "boolean", value: true });
    seedVariable(doc, nodeIds[0]!, "plan", { key: "product", value: { productId: "prod_1" } });
    seedVariable(doc, nodeIds[0]!, "noPlan", { key: "product", value: {} });
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    const labels = rowButtons(harness).map((b) => b.props.label as string);
    expect(labels.some((l) => l.startsWith("greeting"))).toBe(true);
    expect(labels.some((l) => l.startsWith("count") && l.endsWith("3"))).toBe(true);
    expect(labels.some((l) => l.startsWith("isPro") && l.endsWith("True"))).toBe(true);
    // Product with an id shows the "…" sentinel; empty product shows "None".
    expect(labels.some((l) => l.startsWith("plan") && l.endsWith("…"))).toBe(true);
    expect(labels.some((l) => l.startsWith("noPlan") && l.endsWith("None"))).toBe(true);
  });

  test("a boolean variable's value editor is a True/False toggle group", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedVariable(doc, nodeIds[0]!, "isPro", { key: "boolean", value: true });
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });
    const toggle = findNodeByType(harness.tree().root, "toggleGroup");
    expect(toggle?.props.options).toEqual([
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ]);
  });

  test("a product variable's value editor is a productField", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedVariable(doc, nodeIds[0]!, "plan", { key: "product", value: { productId: "prod_1" } });
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });
    const productField = findNodeByType(harness.tree().root, "productField");
    expect(productField?.props.productId).toBe("prod_1");
  });
});

describe("VariablesPanel — edit / commit-on-close", () => {
  /** The single row popover for a one-variable panel. */
  const popover = (h: PanelHarness) => findNodeByType(h.tree().root, "popover")!;

  test("editing name + value and closing persists both (only-if-changed)", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const entryId = seedVariable(doc, nodeIds[0]!, "greeting", { key: "string", value: "hi" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    // Open the row.
    harness.dispatch(popover(harness).id, "onOpenChange", [true]);
    await flush();

    const nameField = findNodeByLabel(harness.tree().root, "Name")!;
    const nameInput = findNodeByType(nameField, "textField")!;
    harness.dispatch(nameInput.id, "onChange", ["welcome"]);
    const valueField = findNodeByLabel(harness.tree().root, "Value")!;
    const valueInput = findNodeByType(valueField, "textField")!;
    harness.dispatch(valueInput.id, "onChange", ["hello"]);
    await flush();

    // Close → persists name + value (two updateVariable dispatches).
    harness.dispatch(popover(harness).id, "onOpenChange", [false]);
    await flush();
    expect(calls.map((c) => c.params)).toEqual([
      { newName: "welcome", nodeId: nodeIds[0], nodeType: "view", variableId: entryId },
      {
        newValue: { key: "string", value: "hello" },
        nodeId: nodeIds[0],
        nodeType: "view",
        variableId: entryId,
      },
    ]);
  });

  test("closing without changes is a no-op", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedVariable(doc, nodeIds[0]!, "greeting", { key: "string", value: "hi" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    harness.dispatch(popover(harness).id, "onOpenChange", [true]);
    await flush();
    harness.dispatch(popover(harness).id, "onOpenChange", [false]);
    await flush();
    expect(calls).toHaveLength(0);
  });

  test("removing a variable dispatches removeVariable with the entry id", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const entryId = seedVariable(doc, nodeIds[0]!, "greeting", { key: "string", value: "hi" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(removeVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    const minus = findNodesByType(harness.tree().root, "button").find((b) => b.props.icon === "minus")!;
    harness.dispatch(minus.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({
      nodeId: nodeIds[0],
      nodeType: "view",
      variableId: entryId,
    });
  });
});

describe("VariablesPanel — pending add flow", () => {
  /** Starts a pending variable of `type` via the header menu. */
  const startAdding = (h: PanelHarness, type: string) => {
    const menu = findNodeByType(h.tree().root, "menu")!;
    h.dispatch(menu.id, "onSelect", [type]);
  };

  test("selecting a type opens a pending row after the 200ms timer", async () => {
    vi.useFakeTimers();
    try {
      const doc = createOfflineDesignerDocument();
      const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
      harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

      act(() => startAdding(harness!, "string"));
      // Row exists but its popover is not yet open.
      let pop = findNodeByType(harness.tree().root, "popover")!;
      expect(pop.props.open).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      pop = findNodeByType(harness.tree().root, "popover")!;
      expect(pop.props.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("empty name is silently dropped on close (no addVariable)", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(addVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    startAdding(harness, "string");
    await new Promise((r) => setTimeout(r, 210));
    await flush();
    const pop = findNodeByType(harness.tree().root, "popover")!;
    expect(pop.props.open).toBe(true);
    harness.dispatch(pop.id, "onOpenChange", [false]);
    await flush();
    expect(calls).toHaveLength(0);
  });

  test("a too-long name toasts the exact error and adds nothing", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(addVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    startAdding(harness, "string");
    await new Promise((r) => setTimeout(r, 210));
    await flush();
    const nameInput = findNodeByType(findNodeByLabel(harness.tree().root, "Name")!, "textField")!;
    harness.dispatch(nameInput.id, "onChange", ["x".repeat(33)]);
    await flush();
    harness.dispatch(findNodeByType(harness.tree().root, "popover")!.id, "onOpenChange", [false]);
    await flush();
    expect(harness.hostLog.toastError).toEqual([
      "Variable name must be less than 32 characters",
    ]);
    expect(calls).toHaveLength(0);
  });

  test("a duplicate name toasts the exact error and adds nothing", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedVariable(doc, nodeIds[0]!, "greeting", { key: "string", value: "hi" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(addVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    startAdding(harness, "string");
    await new Promise((r) => setTimeout(r, 210));
    await flush();
    // The pending row is the LAST popover (appended after the seeded row); its
    // Name field is likewise the last one.
    const names = findNodesByType(harness.tree().root, "textField").filter(
      (t) => t.props.placeholder === "Variable name",
    );
    harness.dispatch(names.at(-1)!.id, "onChange", ["greeting"]);
    await flush();
    const pendingPopover = findNodesByType(harness.tree().root, "popover").at(-1)!;
    harness.dispatch(pendingPopover.id, "onOpenChange", [false]);
    await flush();
    expect(harness.hostLog.toastError).toEqual(["A variable with this name already exists"]);
    expect(calls).toHaveLength(0);
  });

  test("a valid name adds the variable with the exact payload (trimmed)", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(addVariable as never, calls as never));
    harness = mountPanelDefinition(VariablesPanel, doc, { nodeIds: [nodeIds[0]!] });

    startAdding(harness, "number");
    await new Promise((r) => setTimeout(r, 210));
    await flush();
    const nameInput = findNodeByType(findNodeByLabel(harness.tree().root, "Name")!, "textField")!;
    harness.dispatch(nameInput.id, "onChange", ["  score  "]);
    await flush();
    harness.dispatch(findNodeByType(harness.tree().root, "popover")!.id, "onOpenChange", [false]);
    await flush();
    expect(calls.at(-1)!.params).toEqual({
      name: "score",
      nodeId: nodeIds[0],
      nodeType: "view",
      type: "number",
    });
    expect(harness.hostLog.toastError).toEqual([]);
  });
});
