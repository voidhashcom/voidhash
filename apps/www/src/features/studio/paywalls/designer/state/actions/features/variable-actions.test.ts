import { ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import { addVariable, removeVariable, updateVariable } from "./variable-actions";

function makeDesignerDoc() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  let flexId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    flexId = screen.children.insertLast({ type: "view" }).id;
  });
  return { doc, flexId };
}

function makeCtx(doc: OfflineDesignerDocument) {
  let storeState: Record<string, unknown> = {
    mimic: { document: doc, snapshot: doc.getSnapshot() },
    stateOverrideSelection: {},
  };
  return {
    dispatch: () => () => undefined,
    getState: () => storeState,
    setState: (partial: Record<string, unknown>) => {
      storeState = { ...storeState, ...partial };
    },
    transaction: (fn: never) => doc.transaction(fn),
  };
}

function rawVariables(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ViewNode)?.get()?.data;
  if (data === undefined) {
    throw new Error("expected a flex node");
  }
  return data.localVariables;
}

describe("addVariable", () => {
  test("adds one entry and undo removes it (entry-id addressed)", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const params = {
      name: "selected",
      nodeId: flexId,
      nodeType: "view" as const,
      type: "boolean" as const,
    };

    const result = addVariable.fn(ctx as never, params);

    const entries = rawVariables(doc, flexId);
    expect(entries).toHaveLength(1);
    expect(result.variableId).toBe(entries[0]?.id);
    expect(entries[0]?.value?.name).toBe("selected");
    expect(entries[0]?.value?.value).toEqual({ key: "boolean", value: false });

    addVariable.revert(ctx as never, params, result);
    expect(rawVariables(doc, flexId)).toHaveLength(0);
  });
});

describe("updateVariable", () => {
  test("rename and value undo round trips restore the previous values", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addVariable.fn(ctx as never, {
      name: "selected",
      nodeId: flexId,
      nodeType: "view" as const,
      type: "boolean" as const,
    });
    const variableId = added.variableId;
    if (variableId === null) throw new Error("expected a variable entry id");

    const params = {
      newName: "isSelected",
      newValue: { key: "boolean", value: true },
      nodeId: flexId,
      nodeType: "view" as const,
      variableId,
    };
    const result = updateVariable.fn(ctx as never, params);

    expect(result.previousName).toBe("selected");
    expect(result.previousValue).toEqual({ key: "boolean", value: false });
    let entry = rawVariables(doc, flexId)[0];
    expect(entry?.value?.name).toBe("isSelected");
    expect(entry?.value?.value).toEqual({ key: "boolean", value: true });

    updateVariable.revert(ctx as never, params, result);
    entry = rawVariables(doc, flexId)[0];
    expect(entry?.value?.name).toBe("selected");
    expect(entry?.value?.value).toEqual({ key: "boolean", value: false });
  });

  test("unknown value payloads are dropped without throwing", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addVariable.fn(ctx as never, {
      name: "selected",
      nodeId: flexId,
      nodeType: "view" as const,
      type: "boolean" as const,
    });
    const variableId = added.variableId;
    if (variableId === null) throw new Error("expected a variable entry id");

    const result = updateVariable.fn(ctx as never, {
      newValue: { key: "future-kind", value: { weird: true } },
      nodeId: flexId,
      nodeType: "view" as const,
      variableId,
    });

    // the unknown variant was dropped: no write happened, nothing captured
    expect(result).toEqual({ previousName: null, previousValue: null });
    expect(rawVariables(doc, flexId)[0]?.value?.value).toEqual({ key: "boolean", value: false });
  });

  test("no-ops for unknown variable ids", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const result = updateVariable.fn(ctx as never, {
      newName: "isSelected",
      nodeId: flexId,
      nodeType: "view" as const,
      variableId: "missing",
    });
    expect(result).toEqual({ previousName: null, previousValue: null });
  });
});

describe("removeVariable", () => {
  test("removes the entry and undo restores its value byte-identical", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addVariable.fn(ctx as never, {
      name: "selected",
      nodeId: flexId,
      nodeType: "view" as const,
      type: "boolean" as const,
    });
    const variableId = added.variableId;
    if (variableId === null) throw new Error("expected a variable entry id");
    const beforeValue = JSON.stringify(rawVariables(doc, flexId)[0]?.value);

    const params = { nodeId: flexId, nodeType: "view" as const, variableId };
    const result = removeVariable.fn(ctx as never, params);

    expect(rawVariables(doc, flexId)).toHaveLength(0);
    expect(JSON.stringify(result.removedVariable)).toBe(beforeValue);

    removeVariable.revert(ctx as never, params, result);
    const restored = rawVariables(doc, flexId);
    expect(restored).toHaveLength(1);
    expect(JSON.stringify(restored[0]?.value)).toBe(beforeValue);
  });

  test("returns null for unknown variable ids", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const result = removeVariable.fn(ctx as never, {
      nodeId: flexId,
      nodeType: "view" as const,
      variableId: "missing",
    });
    expect(result).toEqual({ removedVariable: null });
  });
});
