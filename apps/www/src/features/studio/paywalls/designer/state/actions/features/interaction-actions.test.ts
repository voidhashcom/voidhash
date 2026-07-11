import { ViewNode, type Action } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import {
  addInteraction,
  removeInteraction,
  updateInteraction,
  updateInteractionActionOverride,
} from "./interaction-actions";

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

function rawViewData(doc: OfflineDesignerDocument, nodeId: string) {
  const data = findTypedNode(doc.root, nodeId, ViewNode)?.get()?.data;
  if (data === undefined) {
    throw new Error("expected a flex node");
  }
  return data;
}

function pushViewState(doc: OfflineDesignerDocument, nodeId: string, name: string): string {
  let entryId = "";
  doc.transaction((root) => {
    const node = findTypedNode(root, nodeId, ViewNode);
    if (!node) throw new Error("expected a flex node");
    entryId = node.data.states.push({
      condition: sampleCondition,
      id: `state-el-${name}`,
      name,
    }).id;
  });
  return entryId;
}

function rawActionOverrides(doc: OfflineDesignerDocument, nodeId: string, stateEntryId: string) {
  const stateEntry = rawViewData(doc, nodeId).states.find(
    (candidate) => candidate.id === stateEntryId,
  );
  if (stateEntry?.value === undefined) {
    throw new Error("expected the state entry");
  }
  return stateEntry.value.overrides.actions;
}

describe("addInteraction", () => {
  test("creates one entry and undo removes it (entry-id addressed)", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const params = { nodeId: flexId };

    const result = addInteraction.fn(ctx as never, params);

    const entries = rawViewData(doc, flexId).interactions;
    expect(entries).toHaveLength(1);
    expect(result.interactionId).toBe(entries[0]?.id);
    expect(entries[0]?.value?.trigger).toEqual({ type: "click" });
    expect(entries[0]?.value?.action).toEqual({ type: "none" });

    addInteraction.revert(ctx as never, params, result);
    expect(rawViewData(doc, flexId).interactions).toHaveLength(0);
  });
});

describe("updateInteraction", () => {
  test("updates in place and undo restores the previous values", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addInteraction.fn(ctx as never, { nodeId: flexId });
    const interactionId = added.interactionId;
    if (interactionId === null) throw new Error("expected an interaction entry id");

    const params = {
      interactionId,
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
    };
    const result = updateInteraction.fn(ctx as never, params);

    let entries = rawViewData(doc, flexId).interactions;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.value?.action).toEqual({ type: "close-paywall" });
    expect(result.previousAction).toEqual({ type: "none" });
    expect(result.previousTrigger).toBe(null);

    updateInteraction.revert(ctx as never, params, result);
    entries = rawViewData(doc, flexId).interactions;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.value?.action).toEqual({ type: "none" });
  });

  test("no-ops for unknown interaction ids", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const result = updateInteraction.fn(ctx as never, {
      interactionId: "missing",
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
    });
    expect(result).toEqual({ previousAction: null, previousTrigger: null });
  });
});

describe("updateInteractionActionOverride", () => {
  test("find-or-update never duplicates entries and undo round trips", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addInteraction.fn(ctx as never, { nodeId: flexId });
    const interactionId = added.interactionId;
    if (interactionId === null) throw new Error("expected an interaction entry id");
    const stateEntryId = pushViewState(doc, flexId, "Selected");

    const firstParams = {
      interactionId,
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    };
    const firstResult = updateInteractionActionOverride.fn(ctx as never, firstParams);
    expect(firstResult).toEqual({ hadOverride: false, previousOverrideRaw: undefined });

    let overrides = rawActionOverrides(doc, flexId, stateEntryId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.value).toEqual({
      action: { type: "close-paywall" },
      interactionId,
    });

    const secondParams = {
      interactionId,
      newAction: {
        payload: { productId: "product-1", type: "literal" },
        type: "purchase-product",
      } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    };
    const secondResult = updateInteractionActionOverride.fn(ctx as never, secondParams);
    expect(secondResult.hadOverride).toBe(true);
    expect(secondResult.previousOverrideRaw).toEqual({ type: "close-paywall" });

    overrides = rawActionOverrides(doc, flexId, stateEntryId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.value?.action).toEqual({
      payload: { productId: "product-1", type: "literal" },
      type: "purchase-product",
    });

    updateInteractionActionOverride.revert(ctx as never, secondParams, secondResult);
    overrides = rawActionOverrides(doc, flexId, stateEntryId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.value?.action).toEqual({ type: "close-paywall" });

    updateInteractionActionOverride.revert(ctx as never, firstParams, firstResult);
    expect(rawActionOverrides(doc, flexId, stateEntryId)).toHaveLength(0);
  });

  test("setting the base action removes the override", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addInteraction.fn(ctx as never, { nodeId: flexId });
    const interactionId = added.interactionId;
    if (interactionId === null) throw new Error("expected an interaction entry id");
    const stateEntryId = pushViewState(doc, flexId, "Selected");

    updateInteractionActionOverride.fn(ctx as never, {
      interactionId,
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    });
    expect(rawActionOverrides(doc, flexId, stateEntryId)).toHaveLength(1);

    // the interaction's base action is { type: "none" }
    const result = updateInteractionActionOverride.fn(ctx as never, {
      interactionId,
      newAction: { type: "none" } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    });
    expect(result.hadOverride).toBe(true);
    expect(rawActionOverrides(doc, flexId, stateEntryId)).toHaveLength(0);
  });

  test("unknown previous override variants are dropped on undo without throwing", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addInteraction.fn(ctx as never, { nodeId: flexId });
    const interactionId = added.interactionId;
    if (interactionId === null) throw new Error("expected an interaction entry id");
    const stateEntryId = pushViewState(doc, flexId, "Selected");

    const params = {
      interactionId,
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    };
    updateInteractionActionOverride.fn(ctx as never, params);

    // a forged undo payload carrying an unknown action variant is dropped
    updateInteractionActionOverride.revert(ctx as never, params, {
      hadOverride: true,
      previousOverrideRaw: { payload: { weird: true }, type: "future-kind" },
    });
    const overrides = rawActionOverrides(doc, flexId, stateEntryId);
    expect(overrides[0]?.value?.action).toEqual({ type: "close-paywall" });
  });
});

describe("removeInteraction", () => {
  test("removes the interaction with its overrides; undo restores and re-keys them", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const added = addInteraction.fn(ctx as never, { nodeId: flexId });
    const interactionId = added.interactionId;
    if (interactionId === null) throw new Error("expected an interaction entry id");
    const stateEntryId = pushViewState(doc, flexId, "Selected");
    updateInteractionActionOverride.fn(ctx as never, {
      interactionId,
      newAction: { type: "close-paywall" } as Action,
      nodeId: flexId,
      stateId: stateEntryId,
    });
    const interactionValue = rawViewData(doc, flexId).interactions[0]?.value;

    const params = { interactionId, nodeId: flexId };
    const result = removeInteraction.fn(ctx as never, params);

    expect(rawViewData(doc, flexId).interactions).toHaveLength(0);
    expect(rawActionOverrides(doc, flexId, stateEntryId)).toHaveLength(0);
    expect(result.removedInteraction).toEqual(interactionValue);
    expect(result.removedActionOverrides).toEqual([
      { raw: { type: "close-paywall" }, stateEntryId },
    ]);

    removeInteraction.revert(ctx as never, params, result);

    const restored = rawViewData(doc, flexId).interactions;
    expect(restored).toHaveLength(1);
    expect(restored[0]?.value).toEqual(interactionValue);

    const overrides = rawActionOverrides(doc, flexId, stateEntryId);
    expect(overrides).toHaveLength(1);
    // re-keyed to the restored interaction's fresh entry id
    expect(overrides[0]?.value?.interactionId).toBe(restored[0]?.id);
    expect(overrides[0]?.value?.action).toEqual({ type: "close-paywall" });
  });

  test("no-ops for unknown interaction ids", () => {
    const { doc, flexId } = makeDesignerDoc();
    const ctx = makeCtx(doc);
    const result = removeInteraction.fn(ctx as never, {
      interactionId: "missing",
      nodeId: flexId,
    });
    expect(result).toEqual({ removedActionOverrides: [], removedInteraction: null });
  });
});
