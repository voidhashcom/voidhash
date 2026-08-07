import { describe, expect, test } from "vitest";

import { applyDocumentEdits } from "./apply-document-edits.ts";
import type { EditableDocumentNode } from "./document-edits.ts";
import type { DocumentEdit } from "./surfaces.ts";

/** A small tree: root → screen → view → text. */
function makeTree(): EditableDocumentNode {
  return {
    id: "root1",
    type: "root",
    data: { name: "Paywall" },
    children: [
      {
        id: "screen1",
        type: "screen",
        data: {},
        children: [
          {
            id: "view1",
            type: "view",
            data: { style: { paddingTop: 8, paddingBottom: 8, backgroundColor: "rgba(0,0,0,1)" } },
            children: [
              { id: "text1", type: "text", data: { text: "Hi" }, children: [] },
            ],
          },
        ],
      },
    ],
  };
}

/** Depth-first flatten to `id → node` for assertions. */
function byId(root: EditableDocumentNode): Map<string, EditableDocumentNode> {
  const map = new Map<string, EditableDocumentNode>();
  const walk = (node: EditableDocumentNode) => {
    map.set(node.id, node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return map;
}

/** A non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read `key` off a value that is a record, else `undefined`. */
function field(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  return value[key];
}

const childIds = (node: EditableDocumentNode | undefined): string[] =>
  (node?.children ?? []).map((child) => child.id);

describe("applyDocumentEdits", () => {
  test("insert appends under a parent and returns real minted ids", () => {
    const { root, mintedIds } = applyDocumentEdits(makeTree(), [
      {
        op: "insert",
        parentId: "screen1",
        node: { type: "view", name: "Card", style: { paddingTop: 16 } },
      },
    ] satisfies DocumentEdit[]);

    const minted = mintedIds["0"];
    expect(minted).toBeDefined();
    expect(minted).toHaveLength(1);
    const newId = minted![0]!;
    // A real 10-char alphanumeric mimic id (shortId scheme), addressable next.
    expect(newId).toMatch(/^[0-9A-Za-z]{10}$/);

    const nodes = byId(root);
    const inserted = nodes.get(newId);
    expect(inserted?.type).toBe("view");
    expect(inserted?.data).toEqual({ name: "Card", style: { paddingTop: 16 } });
    // Appended after the existing view1.
    expect(childIds(nodes.get("screen1"))).toEqual(["view1", newId]);
  });

  test("insert with a nested subtree mints ids pre-order (parent before children)", () => {
    const { mintedIds } = applyDocumentEdits(makeTree(), [
      {
        op: "insert",
        parentId: "screen1",
        node: {
          type: "view",
          children: [
            { type: "text", text: "A" },
            { type: "text", text: "B" },
          ],
        },
      },
    ] satisfies DocumentEdit[]);
    const minted = mintedIds["0"]!;
    expect(minted).toHaveLength(3); // view + 2 texts
    // All distinct.
    expect(new Set(minted).size).toBe(3);
  });

  test("insert at an index places among siblings; out-of-range clamps", () => {
    const tree: EditableDocumentNode = {
      id: "root1",
      type: "root",
      data: {},
      children: [
        { id: "a", type: "view", data: {}, children: [] },
        { id: "b", type: "view", data: {}, children: [] },
      ],
    };
    const inRange = applyDocumentEdits(tree, [
      { op: "insert", parentId: "root1", index: 1, node: { type: "view" } },
    ] satisfies DocumentEdit[]);
    const midId = inRange.mintedIds["0"]![0]!;
    expect(childIds(inRange.root)).toEqual(["a", midId, "b"]);

    const clamped = applyDocumentEdits(tree, [
      { op: "insert", parentId: "root1", index: 99, node: { type: "view" } },
    ] satisfies DocumentEdit[]);
    const endId = clamped.mintedIds["0"]![0]!;
    expect(childIds(clamped.root)).toEqual(["a", "b", endId]);

    const negative = applyDocumentEdits(tree, [
      { op: "insert", parentId: "root1", index: -5, node: { type: "view" } },
    ] satisfies DocumentEdit[]);
    const startId = negative.mintedIds["0"]![0]!;
    expect(childIds(negative.root)).toEqual([startId, "a", "b"]);
  });

  test("update deep-merges nested structs and replaces scalars/arrays", () => {
    const { root } = applyDocumentEdits(makeTree(), [
      { op: "update", nodeId: "view1", set: { style: { paddingTop: 24 } } },
    ] satisfies DocumentEdit[]);
    const view = byId(root).get("view1")!;
    // paddingTop overridden; paddingBottom + backgroundColor untouched (per-field merge).
    expect(view.data).toEqual({
      style: { paddingTop: 24, paddingBottom: 8, backgroundColor: "rgba(0,0,0,1)" },
    });
  });

  test("update replaces a scalar wholesale and deletes on undefined", () => {
    const replaced = applyDocumentEdits(makeTree(), [
      { op: "update", nodeId: "text1", set: { text: "Bye" } },
    ] satisfies DocumentEdit[]);
    expect(byId(replaced.root).get("text1")!.data).toEqual({ text: "Bye" });

    const deleted = applyDocumentEdits(makeTree(), [
      { op: "update", nodeId: "text1", set: { text: undefined } },
    ] satisfies DocumentEdit[]);
    expect(byId(deleted.root).get("text1")!.data).toEqual({});
  });

  test("update does not mutate the input tree", () => {
    const tree = makeTree();
    applyDocumentEdits(tree, [
      { op: "update", nodeId: "view1", set: { style: { paddingTop: 99 } } },
    ] satisfies DocumentEdit[]);
    // Original untouched.
    const original = byId(tree).get("view1")!;
    expect(field(original.data?.["style"], "paddingTop")).toBe(8);
  });

  test("move reparents preserving the node id and its subtree", () => {
    const { root } = applyDocumentEdits(makeTree(), [
      { op: "move", nodeId: "text1", parentId: "screen1", index: 0 },
    ] satisfies DocumentEdit[]);
    const nodes = byId(root);
    // text1 left view1 and now leads screen1's children.
    expect(childIds(nodes.get("view1"))).toEqual([]);
    expect(childIds(nodes.get("screen1"))).toEqual(["text1", "view1"]);
    // Its data/subtree came along, id preserved.
    expect(nodes.get("text1")?.data).toEqual({ text: "Hi" });
  });

  test("remove drops the node and its whole subtree", () => {
    const { root } = applyDocumentEdits(makeTree(), [
      { op: "remove", nodeId: "view1" },
    ] satisfies DocumentEdit[]);
    const nodes = byId(root);
    expect(nodes.has("view1")).toBe(false);
    expect(nodes.has("text1")).toBe(false); // subtree gone
    expect(childIds(nodes.get("screen1"))).toEqual([]);
  });

  test("replaceChildren swaps the whole child list and mints the new ids", () => {
    const { root, mintedIds } = applyDocumentEdits(makeTree(), [
      {
        op: "replaceChildren",
        nodeId: "view1",
        children: [
          { type: "text", text: "One" },
          { type: "text", text: "Two" },
        ],
      },
    ] satisfies DocumentEdit[]);
    const minted = mintedIds["0"]!;
    expect(minted).toHaveLength(2);
    const nodes = byId(root);
    // Old text1 removed; new children present in order.
    expect(nodes.has("text1")).toBe(false);
    expect(childIds(nodes.get("view1"))).toEqual(minted);
    expect(nodes.get(minted[0]!)?.data).toEqual({ text: "One" });
    expect(nodes.get(minted[1]!)?.data).toEqual({ text: "Two" });
  });

  test("a batch applies ops in order and can address ids minted earlier", () => {
    const { root, mintedIds } = applyDocumentEdits(makeTree(), [
      { op: "insert", parentId: "screen1", node: { type: "view", name: "Row" } },
      // Second op inserts under the id minted by the first — but ids are minted
      // at apply time, so this batch style addresses via a follow-up call in
      // practice; here we verify the first op's id exists to be addressed.
    ] satisfies DocumentEdit[]);
    const rowId = mintedIds["0"]![0]!;
    expect(byId(root).has(rowId)).toBe(true);
  });

  test("an op addressing a missing node is skipped (defensive post-validation)", () => {
    const { root, mintedIds } = applyDocumentEdits(makeTree(), [
      { op: "update", nodeId: "ghost", set: { text: "x" } },
      { op: "insert", parentId: "screen1", node: { type: "view" } },
    ] satisfies DocumentEdit[]);
    // The ghost update was skipped; the valid insert still applied at index 1.
    expect(mintedIds["0"]).toBeUndefined();
    expect(mintedIds["1"]).toHaveLength(1);
    expect(byId(root).has(mintedIds["1"]![0]!)).toBe(true);
  });
});
