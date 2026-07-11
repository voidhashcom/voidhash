import { TextNode, ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import { unwrapEntriesDeep } from "../../utils/replay";
import { addNodeState, removeNodeState, updateNodeState } from "./state-actions";

const sampleCondition = {
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
} as const;

function makeDesignerDoc() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  const ids = { flexId: "", textId: "" };
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const flex = screen.children.insertLast({ type: "view" });
    ids.flexId = flex.id;
    ids.textId = flex.children.insertLast({ type: "text" }).id;
  });
  return { doc, ids };
}

function makeCtx(doc: OfflineDesignerDocument, initialSelection: Record<string, string> = {}) {
  let storeState: Record<string, unknown> = {
    mimic: { document: doc, snapshot: doc.getSnapshot() },
    stateOverrideSelection: initialSelection,
  };
  return {
    ctx: {
      dispatch: () => () => undefined,
      getState: () => storeState,
      setState: (partial: Record<string, unknown>) => {
        storeState = { ...storeState, ...partial };
      },
      transaction: (fn: never) => doc.transaction(fn),
    },
    selection: () => storeState["stateOverrideSelection"] as Record<string, string>,
  };
}

function rawViewStates(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ViewNode)?.get()?.data;
  if (data === undefined) {
    throw new Error("expected a flex node");
  }
  return data.states;
}

function rawTextStates(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, TextNode)?.get()?.data;
  if (data === undefined) {
    throw new Error("expected a text node");
  }
  return data.states;
}

describe("addNodeState", () => {
  test("adds one entry storing the condition verbatim and undo removes it", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const params = {
      condition: sampleCondition,
      name: "Selected",
      nodeId: ids.flexId,
      nodeType: "view" as const,
    };

    const result = addNodeState.fn(ctx as never, params);

    const entries = rawViewStates(doc, ids.flexId);
    expect(entries).toHaveLength(1);
    expect(result.stateId).toBe(entries[0]?.id);
    expect(entries[0]?.value?.name).toBe("Selected");
    // snapshot conditions are entry-wrapped; unwrap for input comparison
    expect(unwrapEntriesDeep(entries[0]?.value?.condition)).toEqual(sampleCondition);

    addNodeState.revert(ctx as never, params, result);
    expect(rawViewStates(doc, ids.flexId)).toHaveLength(0);
  });

  test("works for non-flex stateful nodes", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);

    const result = addNodeState.fn(ctx as never, {
      condition: sampleCondition,
      name: "Highlighted",
      nodeId: ids.textId,
      nodeType: "text" as const,
    });

    const entries = rawTextStates(doc, ids.textId);
    expect(entries).toHaveLength(1);
    expect(result.stateId).toBe(entries[0]?.id);
  });
});

describe("updateNodeState", () => {
  test("rename undo round trip leaves the condition byte-identical", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const added = addNodeState.fn(ctx as never, {
      condition: sampleCondition,
      name: "Selected",
      nodeId: ids.flexId,
      nodeType: "view" as const,
    });
    const stateId = added.stateId;
    if (stateId === null) throw new Error("expected a state entry id");
    const beforeCondition = JSON.stringify(rawViewStates(doc, ids.flexId)[0]?.value?.condition);

    const params = { newName: "Active", nodeId: ids.flexId, nodeType: "view" as const, stateId };
    const result = updateNodeState.fn(ctx as never, params);

    expect(result).toEqual({ previousCondition: null, previousName: "Selected" });
    expect(rawViewStates(doc, ids.flexId)[0]?.value?.name).toBe("Active");

    updateNodeState.revert(ctx as never, params, result);
    const entry = rawViewStates(doc, ids.flexId)[0];
    expect(entry?.value?.name).toBe("Selected");
    expect(JSON.stringify(entry?.value?.condition)).toBe(beforeCondition);
  });

  test("condition undo round trip restores the previous condition", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const added = addNodeState.fn(ctx as never, {
      condition: sampleCondition,
      name: "Selected",
      nodeId: ids.flexId,
      nodeType: "view" as const,
    });
    const stateId = added.stateId;
    if (stateId === null) throw new Error("expected a state entry id");

    const newCondition = {
      type: "or",
      value: [
        {
          type: "and",
          value: [
            {
              type: "equals",
              value: {
                left: { type: "literal", value: { key: "number", value: 1 } },
                right: { type: "literal", value: { key: "number", value: 2 } },
              },
            },
          ],
        },
      ],
    } as const;
    const params = { newCondition, nodeId: ids.flexId, nodeType: "view" as const, stateId };
    const result = updateNodeState.fn(ctx as never, params);

    expect(result.previousName).toBe(null);
    expect(unwrapEntriesDeep(rawViewStates(doc, ids.flexId)[0]?.value?.condition)).toEqual(
      newCondition,
    );

    updateNodeState.revert(ctx as never, params, result);
    expect(unwrapEntriesDeep(rawViewStates(doc, ids.flexId)[0]?.value?.condition)).toEqual(
      sampleCondition,
    );
  });

  test("no-ops for unknown state ids", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const result = updateNodeState.fn(ctx as never, {
      newName: "Active",
      nodeId: ids.flexId,
      nodeType: "view" as const,
      stateId: "missing",
    });
    expect(result).toEqual({ previousCondition: null, previousName: null });
  });
});

describe("removeNodeState", () => {
  test("removes the entry and undo restores its value and the selection", () => {
    const { doc, ids } = makeDesignerDoc();
    const seedCtx = makeCtx(doc).ctx;
    const added = addNodeState.fn(seedCtx as never, {
      condition: sampleCondition,
      name: "Selected",
      nodeId: ids.flexId,
      nodeType: "view" as const,
    });
    const stateId = added.stateId;
    if (stateId === null) throw new Error("expected a state entry id");
    const beforeValue = JSON.stringify(rawViewStates(doc, ids.flexId)[0]?.value);

    const { ctx, selection } = makeCtx(doc, { [ids.flexId]: stateId });
    const params = { nodeId: ids.flexId, nodeType: "view" as const, stateId };
    const result = removeNodeState.fn(ctx as never, params);

    expect(rawViewStates(doc, ids.flexId)).toHaveLength(0);
    expect(result.previousSelectedStateId).toBe(stateId);
    expect(JSON.stringify(result.removedState)).toBe(beforeValue);
    expect(selection()[ids.flexId]).toBeUndefined();

    removeNodeState.revert(ctx as never, params, result);

    const restored = rawViewStates(doc, ids.flexId);
    expect(restored).toHaveLength(1);
    // the restored element matches the removed one verbatim, modulo the
    // regenerated inner array-entry ids/positions
    expect(unwrapEntriesDeep(restored[0]?.value)).toEqual(
      unwrapEntriesDeep(JSON.parse(beforeValue)),
    );
    // selection re-points at the restored entry's fresh id
    expect(selection()[ids.flexId]).toBe(restored[0]?.id);
  });

  test("unknown payloads forged into the undo stack are dropped without throwing", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const params = { nodeId: ids.flexId, nodeType: "view" as const, stateId: "whatever" };

    removeNodeState.revert(ctx as never, params, {
      previousSelectedStateId: null,
      removedState: { condition: { type: "unknown-kind" }, id: "x", name: "Broken" },
    });

    expect(rawViewStates(doc, ids.flexId)).toHaveLength(0);
  });

  test("returns null payloads for unknown state ids", () => {
    const { doc, ids } = makeDesignerDoc();
    const { ctx } = makeCtx(doc);
    const result = removeNodeState.fn(ctx as never, {
      nodeId: ids.flexId,
      nodeType: "view" as const,
      stateId: "missing",
    });
    expect(result).toEqual({ previousSelectedStateId: null, removedState: null });
  });
});
