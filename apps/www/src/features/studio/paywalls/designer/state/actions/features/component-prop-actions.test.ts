import { describe, expect, test } from "vite-plus/test";
import { performUndo } from "@voidhash/mimic/zustand-commander";

import { createDesignerStore } from "../../designer-store";
import type { PaywallDesignerStoreType } from "../../designer-store";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { readComponentPropEntries } from "../../utils/component-node-writes";
import type { ComponentPropBindingPlain } from "../../utils/component-prop-values";
import {
  removeComponentPropForNodes,
  updateComponentPropBindingForNodes,
} from "./component-prop-actions";

/** Inserts N component nodes under the seeded screen, returning their ids. */
function seedComponentNodes(
  doc: OfflineDesignerDocument,
  count: number,
  seeds: readonly (readonly { name: string; value: unknown }[])[] = [],
): string[] {
  const { screenId } = seededIds(doc);
  const ids: string[] = [];
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    for (let i = 0; i < count; i++) {
      const node = (
        screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
      ).insertLast({
        type: "component",
        componentSlug: "card",
        componentVersion: 1,
        contentHash: `hash-${i}`,
        name: `card-${i}`,
        previewState: "default",
      });
      ids.push(node.id);
      const props = seeds[i] ?? [];
      const proxy = node as unknown as {
        data: { props: { push: (v: unknown) => void } };
      };
      for (const binding of props) {
        proxy.data.props.push({ name: binding.name, value: binding.value });
      }
    }
  });
  return ids;
}

/** Reads the stored binding for a prop on a node, or `undefined` when absent. */
function storedProp(
  doc: OfflineDesignerDocument,
  nodeId: string,
  propName: string,
): unknown {
  return readComponentPropEntries(doc.root, nodeId).find((entry) => entry.name === propName)?.raw;
}

/**
 * A minimal commander command shape: an `fn` (forward) plus a `revert`. Both
 * batched actions match this — the executor/host dispatch them the same way.
 */
interface TestCommand<P, R> {
  fn: (ctx: unknown, params: P) => R;
  revert: (ctx: unknown, params: P, result: R) => void;
}

/**
 * Dispatches an undoable action on a real designer store the way production
 * does (one dispatch → one undo entry, via the same `_commander.undoStack`
 * shape {@link performUndo} reverts), then exposes the store so the test can
 * assert `undoStack.length` and call {@link performUndo}. Reproduces the eight
 * lines of `createDispatchFromApi` rather than depending on the internal hook.
 */
function makeStore(doc: OfflineDesignerDocument): {
  store: PaywallDesignerStoreType;
  dispatch: <P, R>(command: TestCommand<P, R>, params: P) => R;
  undoDepth: () => number;
} {
  const store = createDesignerStore(doc as unknown as Parameters<typeof createDesignerStore>[0]);
  const storeApi = store as unknown as {
    getState: () => { _commander: { undoStack: unknown[] } };
    setState: (updater: (state: unknown) => unknown) => void;
  };
  return {
    store,
    dispatch: (command, params) => {
      const ctx = { getState: () => store.getState() };
      const result = command.fn(ctx, params);
      storeApi.setState((state) => {
        const s = state as { _commander: { undoStack: unknown[]; redoStack: unknown[] } };
        return {
          ...s,
          _commander: {
            ...s._commander,
            undoStack: [...s._commander.undoStack, { command, params, result, timestamp: 0 }],
            redoStack: [],
          },
        };
      });
      return result;
    },
    undoDepth: () => storeApi.getState()._commander.undoStack.length,
  };
}

const stringBinding = (value: string): ComponentPropBindingPlain => ({
  type: "literal",
  value: { key: "string", value },
});

/** The raw stored binding shape a string literal round-trips to. */
const storedStringBinding = (value: string) => ({
  type: "literal",
  value: { key: "string", value },
});

describe("updateComponentPropBindingForNodes", () => {
  test("writes the binding to every node in one transaction", () => {
    const doc = createOfflineDesignerDocument();
    const ids = seedComponentNodes(doc, 3);
    const { dispatch } = makeStore(doc);

    dispatch(updateComponentPropBindingForNodes, {
      nodeIds: ids,
      propName: "title",
      binding: stringBinding("Hello"),
    });

    for (const id of ids) {
      expect(storedProp(doc, id, "title")).toEqual(storedStringBinding("Hello"));
    }
  });

  test("three nodes yield ONE undo entry; performUndo restores all prior bindings", () => {
    const doc = createOfflineDesignerDocument();
    // Node 0 starts with a stored title; nodes 1 and 2 have none.
    const ids = seedComponentNodes(doc, 3, [
      [{ name: "title", value: { type: "literal", value: { key: "string", value: "Original" } } }],
      [],
      [],
    ]);
    const { dispatch, undoDepth, store } = makeStore(doc);

    dispatch(updateComponentPropBindingForNodes, {
      nodeIds: ids,
      propName: "title",
      binding: stringBinding("Changed"),
    });

    // Exactly one undo entry for the whole batch.
    expect(undoDepth()).toBe(1);
    for (const id of ids) {
      expect(storedProp(doc, id, "title")).toEqual(storedStringBinding("Changed"));
    }

    const undone = performUndo(store as never);
    expect(undone).toBe(true);
    expect(undoDepth()).toBe(0);

    // Node 0 restored to its original binding; nodes with no prior binding have
    // the entry removed entirely.
    expect(storedProp(doc, ids[0]!, "title")).toEqual(storedStringBinding("Original"));
    expect(storedProp(doc, ids[1]!, "title")).toBeUndefined();
    expect(storedProp(doc, ids[2]!, "title")).toBeUndefined();
  });

  test("skips missing nodes without throwing and still records one entry", () => {
    const doc = createOfflineDesignerDocument();
    const ids = seedComponentNodes(doc, 1);
    const { dispatch, undoDepth, store } = makeStore(doc);

    dispatch(updateComponentPropBindingForNodes, {
      nodeIds: [...ids, "does-not-exist"],
      propName: "title",
      binding: stringBinding("Only real"),
    });

    expect(undoDepth()).toBe(1);
    expect(storedProp(doc, ids[0]!, "title")).toEqual(storedStringBinding("Only real"));

    performUndo(store as never);
    expect(storedProp(doc, ids[0]!, "title")).toBeUndefined();
  });
});

describe("removeComponentPropForNodes", () => {
  test("removes the entry from every node and undo re-adds the removed ones", () => {
    const doc = createOfflineDesignerDocument();
    const ids = seedComponentNodes(doc, 3, [
      [{ name: "title", value: { type: "literal", value: { key: "string", value: "A" } } }],
      [{ name: "title", value: { type: "literal", value: { key: "string", value: "B" } } }],
      // Node 2 has no stored title.
      [],
    ]);
    const { dispatch, undoDepth, store } = makeStore(doc);

    dispatch(removeComponentPropForNodes, { nodeIds: ids, propName: "title" });

    expect(undoDepth()).toBe(1);
    for (const id of ids) {
      expect(storedProp(doc, id, "title")).toBeUndefined();
    }

    const undone = performUndo(store as never);
    expect(undone).toBe(true);
    expect(storedProp(doc, ids[0]!, "title")).toEqual(storedStringBinding("A"));
    expect(storedProp(doc, ids[1]!, "title")).toEqual(storedStringBinding("B"));
    // Node 2 had nothing removed, so undo re-adds nothing.
    expect(storedProp(doc, ids[2]!, "title")).toBeUndefined();
  });
});
