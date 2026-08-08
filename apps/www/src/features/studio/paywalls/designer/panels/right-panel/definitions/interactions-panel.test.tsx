// @vitest-environment jsdom

import type { Action } from "@voidhash/mimic-schema";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// The action editor's product payload editor renders through app context that
// reads router params; outside a route `useParams({strict:false})` returns `{}`.
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({}) }));

/** Flushes React's coalesced re-render/re-emit microtask. */
const flush = () => act(async () => {});

import {
  addInteraction,
  removeInteraction,
  updateInteraction,
  updateInteractionActionOverride,
} from "../../../state/actions";
import {
  createOfflineDesignerDocument,
  type OfflineDesignerDocument,
} from "../../../state/testing/offline-document";
import { InteractionsPanel } from "./interactions-panel";
import {
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
  selectState,
  watchAction,
  type ActionCall,
  type PanelHarness,
} from "./testing/definition-harness";

let harness: PanelHarness | undefined;
const restore: (() => void)[] = [];
// oxlint-disable-next-line effect/noTestLifecycleHooks -- React panel harness teardown; the harness mounts into the DOM outside any Effect scope, so there is no Effect.acquireRelease equivalent to attach the disposal to.
afterEach(() => {
  while (restore.length) restore.pop()!();
  harness?.dispose();
  harness = undefined;
});

/** Seeds a `click`-triggered interaction with `action` onto a view node. */
function seedInteraction(doc: OfflineDesignerDocument, nodeId: string, action: Action): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    const created = (
      node as unknown as {
        data: { interactions: { push: (v: unknown) => { id: string } } };
      }
    ).data.interactions.push({
      action,
      id: `interaction-seed-${Math.random().toString(36).slice(2, 8)}`,
      trigger: { type: "click" },
    });
    entryId = created.id;
  });
  return entryId;
}

/**
 * Seeds a state entry carrying an action override for `interactionId`. Returns
 * the state array-entry id (the id used to select the state).
 */
function seedStateWithActionOverride(
  doc: OfflineDesignerDocument,
  nodeId: string,
  interactionId: string,
  action: Action,
): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = root.findByIdAcrossTree(nodeId);
    const created = (
      node as unknown as {
        data: { states: { push: (v: unknown) => { id: string } } };
      }
    ).data.states.push({
      id: `state-value-${Math.random().toString(36).slice(2, 8)}`,
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
      overrides: { actions: [{ interactionId, action }] },
    });
    entryId = created.id;
  });
  return entryId;
}

describe("InteractionsPanel — structure", () => {
  test("renders a row per interaction with a trigger select + action editor", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedInteraction(doc, nodeIds[0]!, { type: "close-paywall" });
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const root = harness.tree().root;
    expect(findNodeByType(root, "section")?.props.title).toBe("Interactions");
    const trigger = findNodeByType(root, "selectField")!;
    expect(trigger.props.options).toEqual([{ value: "click", label: "On click" }]);
    expect(trigger.props.value).toBe("click");
    const editor = findNodeByType(root, "actionEditorField")!;
    expect((editor.props.value as { type: string }).type).toBe("close-paywall");
    // The add + remove buttons are present.
    const icons = findNodesByType(root, "button").map((b) => b.props.icon);
    expect(icons).toContain("plus");
    expect(icons).toContain("minus");
  });

  test("no rows when the node has no interactions", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });
    expect(findNodeByType(harness.tree().root, "actionEditorField")).toBeUndefined();
    // Only the header add button.
    expect(findNodesByType(harness.tree().root, "button").map((b) => b.props.icon)).toEqual(["plus"]);
  });
});

describe("InteractionsPanel — effective action under a selected state", () => {
  test("the editor value is the state override, not the base action", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const interactionId = seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const stateId = seedStateWithActionOverride(doc, nodeIds[0]!, interactionId, {
      type: "close-paywall",
    });
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    // Base: no state selected → effective action is the base "none".
    expect(
      (findNodeByType(harness.tree().root, "actionEditorField")!.props.value as { type: string })
        .type,
    ).toBe("none");

    // Select the state → effective action is the override "close-paywall".
    act(() => selectState(harness!.store, nodeIds[0]!, stateId));
    await flush();
    expect(
      (findNodeByType(harness.tree().root, "actionEditorField")!.props.value as { type: string })
        .type,
    ).toBe("close-paywall");
  });
});

describe("InteractionsPanel — write branching", () => {
  test("no state selected → onChange writes the base via updateInteraction", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const interactionId = seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateInteraction as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    harness.dispatch(editor.id, "onChange", [{ type: "close-paywall" }]);
    expect(calls.at(-1)!.params).toEqual({
      interactionId,
      newAction: { type: "close-paywall" },
      nodeId: nodeIds[0],
    });
  });

  test("state selected → onChange writes an override via updateInteractionActionOverride", async () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const interactionId = seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const stateId = seedStateWithActionOverride(doc, nodeIds[0]!, interactionId, { type: "none" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateInteractionActionOverride as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });
    act(() => selectState(harness!.store, nodeIds[0]!, stateId));
    await flush();

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    harness.dispatch(editor.id, "onChange", [{ type: "close-paywall" }]);
    expect(calls.at(-1)!.params).toEqual({
      interactionId,
      newAction: { type: "close-paywall" },
      nodeId: nodeIds[0],
      stateId,
    });
  });

  test("an action-payload-sourced action is dropped (no write)", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateInteraction as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const editor = findNodeByType(harness.tree().root, "actionEditorField")!;
    // purchase-product with an action-payload source → toVisualAction returns null.
    harness.dispatch(editor.id, "onChange", [
      { type: "purchase-product", payload: { type: "action-payload", field: "productId" } },
    ]);
    expect(calls).toHaveLength(0);
  });
});

describe("InteractionsPanel — add / remove", () => {
  test("the add button dispatches addInteraction for the node", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(addInteraction as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const add = findNodesByType(harness.tree().root, "button").find((b) => b.props.icon === "plus")!;
    harness.dispatch(add.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({ nodeId: nodeIds[0] });
  });

  test("the remove button dispatches removeInteraction with the entry id", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const interactionId = seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(removeInteraction as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const remove = findNodesByType(harness.tree().root, "button").find(
      (b) => b.props.icon === "minus",
    )!;
    harness.dispatch(remove.id, "onClick");
    expect(calls.at(-1)!.params).toEqual({ interactionId, nodeId: nodeIds[0] });
  });

  test("the trigger select writes the trigger via updateInteraction", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "view" }]);
    const interactionId = seedInteraction(doc, nodeIds[0]!, { type: "none" });
    const calls: ActionCall<Record<string, unknown>>[] = [];
    restore.push(watchAction(updateInteraction as never, calls as never));
    harness = mountPanelDefinition(InteractionsPanel, doc, { nodeIds: [nodeIds[0]!] });

    const trigger = findNodeByType(harness.tree().root, "selectField")!;
    harness.dispatch(trigger.id, "onChange", ["click"]);
    expect(calls.at(-1)!.params).toEqual({
      interactionId,
      newTrigger: { type: "click" },
      nodeId: nodeIds[0],
    });
  });
});
