// @vitest-environment jsdom

import { Panel, type PanelContext } from "@voidhash/paywalls/panel";
import { useStore } from "zustand/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { usePaywallDesignerStore } from "../../../../state/designer-store";
import { createOfflineDesignerDocument } from "../../../../state/testing/offline-document";
import { useDefinitionSelection } from "../definition-selection";
import {
  findNodeByLabel,
  findNodeByType,
  findNodesByType,
  mountPanelDefinition,
  seedNodes,
  type PanelHarness,
} from "./definition-harness";

let harness: PanelHarness | undefined;
// oxlint-disable-next-line effect/noTestLifecycleHooks -- React panel harness teardown; the harness mounts into the DOM outside any Effect scope, so there is no Effect.acquireRelease equivalent to attach the disposal to.
afterEach(() => {
  harness?.dispose();
  harness = undefined;
});

/** A trivial definition that renders the store `stateOverrideSelection` key count. */
function StoreCountDefinition(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const selection = useStore(store, (s) => s.stateOverrideSelection);
  return (
    <Panel>
      <Panel.Field label="Count">
        <Panel.TextField kind="number" value={Object.keys(selection).length} placeholder="count" />
      </Panel.Field>
    </Panel>
  );
}

/** A definition echoing the selection node-id count from the selection channel. */
function SelectionCountDefinition(_ctx: PanelContext) {
  const { nodeIds } = useDefinitionSelection();
  return (
    <Panel>
      <Panel.Text content={`ids:${nodeIds.length}`} />
    </Panel>
  );
}

describe("definition-harness", () => {
  test("mounts a definition over a real store and asserts a valid tree", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "path" }]);
    harness = mountPanelDefinition(StoreCountDefinition, doc, { nodeIds });

    const tree = harness.tree();
    expect(tree.version).toBe(1);
    expect(tree.root.type).toBe("panel");
    // The store hook resolved inside the reconciler (no override selection yet).
    const textField = findNodeByType(tree.root, "textField");
    expect(textField?.props.value).toBe(0);
    // Real store + commander slice are live.
    expect(harness.undoDepth()).toBe(0);
    expect(harness.draftActive()).toBe(false);
  });

  test("the selection channel carries the seeded node ids to the definition", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "path" }, { type: "path" }]);
    harness = mountPanelDefinition(SelectionCountDefinition, doc, { nodeIds });

    const text = findNodeByType(harness.tree().root, "text");
    expect(text?.props.content).toBe("ids:2");
  });

  test("seedNodes writes style overrides onto the created node", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [
      { type: "path", style: { fillEnabled: true, fillColor: "rgba(1, 2, 3, 1)" } },
    ]);
    harness = mountPanelDefinition(StoreCountDefinition, doc, { nodeIds });
    const style = harness.nodeStyle(nodeIds[0]!);
    expect(style.fillEnabled).toBe(true);
    expect(style.fillColor).toBe("rgba(1, 2, 3, 1)");
  });

  test("finders locate nodes by type and label", () => {
    const doc = createOfflineDesignerDocument();
    const { nodeIds } = seedNodes(doc, [{ type: "path" }]);
    harness = mountPanelDefinition(StoreCountDefinition, doc, { nodeIds });
    const root = harness.tree().root;
    expect(findNodesByType(root, "field")).toHaveLength(1);
    expect(findNodeByLabel(root, "Count")?.type).toBe("field");
  });
});
