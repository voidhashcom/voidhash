import { PaywallDesignerDocument } from "@voidhash/mimic-schema";
import type { DocumentEdit } from "@voidhash/ai-shared";
import { describe, expect, test } from "vitest";

import { applyDocumentEditsToTree, writeComponentSourceToTree } from "./service-write.ts";

/** Encode a decoded document input into the raw live tree the write path reads. */
const encode = (roots: unknown): unknown => PaywallDesignerDocument.encode(roots as never);

/** The screen id in an encoded live tree (the edit target). */
const screenIdOf = (tree: unknown): string =>
  (tree as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }).nodes.find(
    (node) => node.value.fields.type?.value === "screen",
  )!.id;

/** Whether the raw tree contains a node with `id` carrying a string field `key === value`. */
const treeHasNodeWithField = (tree: unknown, id: string, key: string, value: string): boolean =>
  (tree as { nodes: { id: string; value: { fields: Record<string, { value?: unknown }> } }[] }).nodes.some(
    (node) => node.id === id && node.value.fields[key]?.value === value,
  );

describe("applyDocumentEditsToTree", () => {
  const liveTree = () =>
    encode([{ type: "root", name: "Paywall", children: [{ type: "screen", name: "Main" }] }]);

  test("insert emits a tree.insert carrying the pre-minted target id (id survives reconcile)", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    const { result, mintedIds } = applyDocumentEditsToTree({
      tree,
      edits: [{ op: "insert", parentId: screenId, node: { type: "view", name: "Card" } }] as DocumentEdit[],
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;

    const minted = mintedIds["0"]!;
    expect(minted).toHaveLength(1);
    const newId = minted[0]!;

    // The reconcile emitted a tree.insert whose node.id IS the minted id — proving
    // the pre-minted id survives encode + reconcile and is addressable next.
    const insert = result.commands.find(
      (c) => (c as { kind: string }).kind === "tree.insert",
    ) as { node: { id: string } } | undefined;
    expect(insert).toBeDefined();
    expect(insert!.node.id).toBe(newId);
  });

  test("update touches only the edited node (no-op elsewhere → minimal commands)", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    const { result } = applyDocumentEditsToTree({
      tree,
      edits: [{ op: "update", nodeId: screenId, set: { name: "Renamed" } }] as DocumentEdit[],
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // Exactly the name field changed → a single object.set, no inserts/moves/deletes.
    expect(result.commands.every((c) => (c as { kind: string }).kind === "object.set")).toBe(true);
  });

  test("a no-op edit batch (empty target diff) reconciles to zero commands", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    // Setting the name to its current value is a no-op.
    const { result } = applyDocumentEditsToTree({
      tree,
      edits: [{ op: "update", nodeId: screenId, set: { name: "Main" } }] as DocumentEdit[],
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    expect(result.commands).toEqual([]);
  });

  test("a malformed tree is rejected on the typed channel", () => {
    const { result } = applyDocumentEditsToTree({
      tree: { not: "a tree" },
      edits: [{ op: "update", nodeId: "x", set: {} }] as DocumentEdit[],
    });
    expect(result.kind).toBe("rejected");
  });

  test("an entry-wrapped array-bearing node emits NO commands when untouched", () => {
    // A view whose `localVariables` is an authored entry-wrapped array — decode
    // wraps each item in an `{id,pos,value}` envelope. An UNRELATED edit (renaming
    // the screen) must not re-emit that array: reconcile compares arrays by logical
    // value (envelope-agnostic), so the untouched view yields zero commands.
    const tree = encode([
      {
        type: "root",
        name: "Paywall",
        children: [
          {
            type: "screen",
            name: "Main",
            children: [
              {
                type: "view",
                name: "Stateful",
                localVariables: [
                  { id: "var_1", name: "plan", value: { key: "string", value: "yearly" } },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const screenId = screenIdOf(tree);
    // Read the array-bearing view's id so we can assert nothing addresses it.
    const viewId = (tree as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }).nodes.find(
      (node) => node.value.fields.type?.value === "view",
    )!.id;

    const { result } = applyDocumentEditsToTree({
      tree,
      edits: [{ op: "update", nodeId: screenId, set: { name: "Renamed" } }] as DocumentEdit[],
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // Only the screen's name changed — no command touches the array-bearing view.
    const touchesView = result.commands.some((c) => {
      const path = (c as { path?: unknown }).path;
      return typeof path === "string" ? path.includes(viewId) : JSON.stringify(c).includes(viewId);
    });
    expect(touchesView).toBe(false);
    // And every emitted command is the single name set on the screen.
    expect(result.commands.every((c) => (c as { kind: string }).kind === "object.set")).toBe(true);
  });
});

describe("writeComponentSourceToTree", () => {
  test("creates the library + codeComponent for a new path", () => {
    const tree = encode([
      { type: "root", name: "Paywall", children: [{ type: "screen", name: "Main" }] },
    ]);
    const result = writeComponentSourceToTree({
      tree,
      path: "components/hero.tsx",
      source: "export default () => null;",
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // A fresh library + codeComponent are inserted.
    const inserts = result.commands.filter((c) => (c as { kind: string }).kind === "tree.insert");
    const types = inserts.map(
      (c) =>
        (c as unknown as { node: { value: { fields: { type: { value: string } } } } }).node.value
          .fields.type.value,
    );
    expect(types).toContain("library");
    expect(types).toContain("codeComponent");
  });

  test("replaces an existing component's source in place (id preserved)", () => {
    const tree = encode([
      {
        type: "root",
        name: "Paywall",
        children: [
          { type: "screen", name: "Main" },
          {
            type: "library",
            children: [{ type: "codeComponent", path: "components/hero.tsx", source: "old" }],
          },
        ],
      },
    ]);
    // Read the existing codeComponent id.
    const ccId = (tree as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }).nodes.find(
      (node) => node.value.fields.type?.value === "codeComponent",
    )!.id;

    const result = writeComponentSourceToTree({
      tree,
      path: "components/hero.tsx",
      source: "new source",
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // No inserts (the node already exists) — only a field update on the same id.
    expect(result.commands.some((c) => (c as { kind: string }).kind === "tree.insert")).toBe(false);
    const update = result.commands.find(
      (c) => (c as { kind: string; key?: string }).kind === "object.set" && (c as { key?: string }).key === "source",
    ) as { path: unknown; value: { value?: string } } | undefined;
    expect(update).toBeDefined();
    // The update carries the new source and the target tree still has the same id.
    expect(treeHasNodeWithField(tree, ccId, "path", "components/hero.tsx")).toBe(true);
  });

  test("rejects an invalid component file name", () => {
    const tree = encode([
      { type: "root", name: "Paywall", children: [{ type: "screen", name: "Main" }] },
    ]);
    const result = writeComponentSourceToTree({
      tree,
      path: "components/../evil.tsx",
      source: "x",
    });
    expect(result.kind).toBe("rejected");
  });
});
