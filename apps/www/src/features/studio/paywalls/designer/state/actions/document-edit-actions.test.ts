import type { DocumentEdit } from "@voidhash/ai-shared";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import { selectDocumentRoot } from "../utils/document-root";
import { unwrapEntriesDeep } from "../utils/replay";
import { applyDocumentEdits } from "./document-edit-actions";

/**
 * A minimal command context over an offline document, faithful enough for
 * `applyDocumentEdits`: `getState` exposes the live mimic snapshot (so
 * `selectDocumentRoot` + the validator read the current tree), `transaction`
 * runs against the document. Undo is exercised by calling `.revert` directly
 * with the captured do-result (mirroring how the commander replays it).
 */
function makeCtx(doc: OfflineDesignerDocument) {
  const ctx = {
    dispatch:
      <TParams, TReturn>(command: { fn: (c: unknown, p: TParams) => TReturn }) =>
      (params: TParams): TReturn =>
        command.fn(ctx, params),
    getState: () => ({
      mimic: {
        document: doc,
        snapshot: doc.getSnapshot(),
      },
    }),
  };
  return ctx;
}

/** Runs the do-fn and returns its `{ inverses, result }` payload. */
function run(doc: OfflineDesignerDocument, edits: readonly DocumentEdit[]) {
  const ctx = makeCtx(doc);
  return applyDocumentEdits.fn(ctx as never, { edits });
}

/** Replays the undo (revert) for a previously run batch. */
function undo(
  doc: OfflineDesignerDocument,
  edits: readonly DocumentEdit[],
  result: ReturnType<typeof run>,
) {
  const ctx = makeCtx(doc);
  applyDocumentEdits.revert(ctx as never, { edits }, result);
}

/** The current children ids of a node in the committed snapshot. */
function childIds(doc: OfflineDesignerDocument, nodeId: string): string[] {
  const find = (node: { id: string; children: readonly { id: string }[] }): {
    id: string;
    children: readonly { id: string }[];
  } | null => {
    if (node.id === nodeId) return node;
    for (const child of node.children) {
      const found = find(child as never);
      if (found) return found;
    }
    return null;
  };
  const root = selectDocumentRoot({ mimic: { snapshot: doc.getSnapshot() } as never });
  const node = find(root as never);
  return node ? node.children.map((child) => child.id) : [];
}

/** The unwrapped `data` of a node in the committed snapshot. */
function nodeData(doc: OfflineDesignerDocument, nodeId: string): Record<string, unknown> | null {
  const proxy = doc.root.findByIdAcrossTree(nodeId);
  return (proxy?.get()?.data as Record<string, unknown> | undefined) ?? null;
}

describe("applyDocumentEdits — validation", () => {
  test("an invalid batch returns structured errors and opens no transaction", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const childrenBefore = childIds(doc, screenId);

    const { inverses, result } = run(doc, [
      { op: "insert", parentId: "does-not-exist", node: { type: "view" } },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("unknownParent");
    }
    // No inverse captured → no undo entry would be pushed; the document is untouched.
    expect(inverses).toEqual([]);
    expect(childIds(doc, screenId)).toEqual(childrenBefore);
  });
});

describe("applyDocumentEdits — insert + undo", () => {
  test("insert mints an id, returns it, and undo removes exactly the inserted subtree", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);

    const edits: DocumentEdit[] = [
      { op: "insert", parentId: screenId, node: { type: "view", children: [{ type: "text", text: "hi" }] } },
    ];
    const outcome = run(doc, edits);
    expect(outcome.result.ok).toBe(true);
    if (!outcome.result.ok) return;

    const mintedForOp = outcome.result.mintedIds["0"];
    // The whole subtree is minted, parent-first (view, then its text child).
    expect(mintedForOp && mintedForOp.length).toBe(2);
    const insertedId = mintedForOp![0]!;
    expect(childIds(doc, screenId)).toContain(insertedId);

    undo(doc, edits, outcome);
    expect(childIds(doc, screenId)).not.toContain(insertedId);
    expect(doc.root.findByIdAcrossTree(insertedId)).toBeUndefined();
  });
});

describe("applyDocumentEdits — update merge + undo", () => {
  test("style merge sets one field without wiping sibling fields, undo restores exactly", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);

    // Seed a view with two style fields.
    const seed = run(doc, [
      {
        op: "insert",
        parentId: screenId,
        node: { type: "view", style: { paddingTop: 10, paddingLeft: 4 } },
      },
    ]);
    if (!seed.result.ok) throw new Error("seed failed");
    const viewId = seed.result.mintedIds["0"]![0]!;

    // Update ONLY paddingTop.
    const edits: DocumentEdit[] = [{ op: "update", nodeId: viewId, set: { style: { paddingTop: 99 } } }];
    const outcome = run(doc, edits);
    expect(outcome.result.ok).toBe(true);

    const style = nodeData(doc, viewId)?.style as Record<string, unknown>;
    expect(style["paddingTop"]).toBe(99);
    // Sibling field untouched by the per-key merge.
    expect(style["paddingLeft"]).toBe(4);

    // Undo restores the previous value exactly.
    undo(doc, edits, outcome);
    const restored = nodeData(doc, viewId)?.style as Record<string, unknown>;
    expect(restored["paddingTop"]).toBe(10);
    expect(restored["paddingLeft"]).toBe(4);
  });

  test("undo of an update that ADDED a field removes it again", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const seed = run(doc, [{ op: "insert", parentId: screenId, node: { type: "text", text: "hello" } }]);
    if (!seed.result.ok) throw new Error("seed failed");
    const textId = seed.result.mintedIds["0"]![0]!;
    const before = nodeData(doc, textId)?.text;

    const edits: DocumentEdit[] = [{ op: "update", nodeId: textId, set: { text: "changed" } }];
    const outcome = run(doc, edits);
    expect(nodeData(doc, textId)?.text).toBe("changed");

    undo(doc, edits, outcome);
    expect(nodeData(doc, textId)?.text).toBe(before);
  });

  test("undo of an update to a nested style sub-key restores the object EXACTLY", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const seed = run(doc, [
      { op: "insert", parentId: screenId, node: { type: "view", style: { paddingTop: 10 } } },
    ]);
    if (!seed.result.ok) throw new Error("seed failed");
    const viewId = seed.result.mintedIds["0"]![0]!;
    // Snapshot the exact pre-edit style by LOGICAL value (CRDT array envelopes on
    // e.g. gradient stops carry churny ids/pos — compare unwrapped).
    const beforeStyle = unwrapEntriesDeep(nodeData(doc, viewId)?.style) as Record<string, unknown>;
    expect(beforeStyle["shadowRadius"]).toBe(0);

    const edits: DocumentEdit[] = [{ op: "update", nodeId: viewId, set: { style: { shadowRadius: 5 } } }];
    const outcome = run(doc, edits);
    const afterStyle = nodeData(doc, viewId)?.style as Record<string, unknown>;
    expect(afterStyle["shadowRadius"]).toBe(5);
    expect(afterStyle["paddingTop"]).toBe(10);

    undo(doc, edits, outcome);
    const restored = unwrapEntriesDeep(nodeData(doc, viewId)?.style) as Record<string, unknown>;
    // The whole style returns to its prior LOGICAL value — shadowRadius back to
    // its default, no leftover, every sibling untouched.
    expect(restored).toEqual(beforeStyle);
    expect(restored["shadowRadius"]).toBe(0);
    expect(restored["paddingTop"]).toBe(10);
  });
});

describe("applyDocumentEdits — overlapping batches are rejected (no transaction, no undo)", () => {
  test("mutate-then-remove the SAME node is rejected before any write", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const seed = run(doc, [{ op: "insert", parentId: screenId, node: { type: "view" } }]);
    if (!seed.result.ok) throw new Error("seed failed");
    const viewId = seed.result.mintedIds["0"]![0]!;
    const childrenBefore = childIds(doc, screenId);

    const { inverses, result } = run(doc, [
      { op: "update", nodeId: viewId, set: { name: "X" } },
      { op: "remove", nodeId: viewId },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "overlappingEdits")).toBe(true);
    }
    // No inverse captured → no undo entry; the document is untouched.
    expect(inverses).toEqual([]);
    expect(childIds(doc, screenId)).toEqual(childrenBefore);
  });

  test("nested removes (child inside removed parent) are rejected before any write", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const seed = run(doc, [
      { op: "insert", parentId: screenId, node: { type: "view", children: [{ type: "text", text: "hi" }] } },
    ]);
    if (!seed.result.ok) throw new Error("seed failed");
    const viewId = seed.result.mintedIds["0"]![0]!;
    const textId = seed.result.mintedIds["0"]![1]!;
    const childrenBefore = childIds(doc, screenId);

    const { inverses, result } = run(doc, [
      { op: "remove", nodeId: viewId },
      { op: "remove", nodeId: textId },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "overlappingEdits")).toBe(true);
    }
    expect(inverses).toEqual([]);
    expect(childIds(doc, screenId)).toEqual(childrenBefore);
  });
});

describe("applyDocumentEdits — batch atomicity + undo", () => {
  test("a multi-op batch undoes to the exact prior tree in one revert", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const beforeChildren = childIds(doc, screenId);

    const edits: DocumentEdit[] = [
      { op: "insert", parentId: screenId, node: { type: "view" } },
      { op: "insert", parentId: screenId, node: { type: "text", text: "a" } },
    ];
    const outcome = run(doc, edits);
    expect(outcome.result.ok).toBe(true);
    expect(childIds(doc, screenId).length).toBe(beforeChildren.length + 2);

    undo(doc, edits, outcome);
    expect(childIds(doc, screenId)).toEqual(beforeChildren);
  });

  test("remove captures the subtree and undo re-inserts it at its original index", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const seed = run(doc, [
      { op: "insert", parentId: screenId, node: { type: "view" } },
      { op: "insert", parentId: screenId, node: { type: "text", text: "keep" } },
    ]);
    if (!seed.result.ok) throw new Error("seed failed");
    const viewId = seed.result.mintedIds["0"]![0]!;
    const orderBefore = childIds(doc, screenId);

    const edits: DocumentEdit[] = [{ op: "remove", nodeId: viewId }];
    const outcome = run(doc, edits);
    expect(childIds(doc, screenId)).not.toContain(viewId);

    undo(doc, edits, outcome);
    // The subtree is restored at the same index (re-minted id, same position).
    const orderAfter = childIds(doc, screenId);
    expect(orderAfter.length).toBe(orderBefore.length);
    expect(orderAfter.indexOf(orderAfter[0]!)).toBe(0);
  });
});
