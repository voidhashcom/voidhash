import {
  treeValue,
  type Command,
  type ObjectValue,
  type TreeValue,
  type Value,
} from "@voidhash/mimic-core";
import { PaywallDesignerDocument } from "@voidhash/mimic-schema";
import type { DocumentEdit } from "@voidhash/ai-shared";
import { describe, expect, test } from "vitest";

import { applyDocumentEditsToTree, writeComponentSourceToTree } from "./service-write.ts";

/** Narrow an encoded mimic value to the tree it always is in these tests. */
const asTree = (value: Value | undefined): TreeValue => {
  if (value?.kind === "tree") {
    return value;
  }
  return treeValue([]);
};

/** Encode a decoded document input into the raw live tree the write path reads. */
const encode = (roots: unknown): TreeValue => asTree(PaywallDesignerDocument.encodeOptional(roots));

/** Reads a string field off a node's object value, or `undefined` when absent/non-string. */
const stringField = (object: ObjectValue, key: string): string | undefined => {
  const field = object.fields[key];
  if (field?.kind === "string") {
    return field.value;
  }
  return undefined;
};

/** The id of the (single) node of `type` in an encoded live tree. */
const nodeIdOfType = (tree: TreeValue, type: string): string =>
  tree.nodes.find((node) => stringField(node.value, "type") === type)!.id;

/** The screen id in an encoded live tree (the edit target). */
const screenIdOf = (tree: TreeValue): string => nodeIdOfType(tree, "screen");

/** Whether the raw tree contains a node with `id` carrying a string field `key === value`. */
const treeHasNodeWithField = (
  tree: TreeValue,
  id: string,
  key: string,
  value: string,
): boolean =>
  tree.nodes.some((node) => node.id === id && stringField(node.value, key) === value);

/** Whether any string anywhere inside a mimic value mentions `id`. */
const valueMentions = (value: Value, id: string): boolean => {
  if (value.kind === "string") {
    return value.value.includes(id);
  }
  if (value.kind === "object") {
    return Object.values(value.fields).some((field) => valueMentions(field, id));
  }
  if (value.kind === "array") {
    return value.items.some((item) => item.id === id || valueMentions(item.value, id));
  }
  if (value.kind === "tree") {
    return value.nodes.some(
      (node) => node.id === id || node.parent === id || valueMentions(node.value, id),
    );
  }
  return false;
};

/** Whether a command addresses or carries the node `id` anywhere. */
const commandMentions = (command: Command, id: string): boolean => {
  if (command.path.some((segment) => segment.kind !== "field" && segment.id === id)) {
    return true;
  }
  if (command.kind === "tree.insert") {
    return (
      command.node.id === id ||
      command.node.parent === id ||
      valueMentions(command.node.value, id)
    );
  }
  if (command.kind === "tree.move") {
    return command.id === id || command.parent === id;
  }
  if (command.kind === "tree.delete" || command.kind === "array.delete") {
    return command.id === id;
  }
  if (command.kind === "array.move") {
    return command.id === id;
  }
  if (command.kind === "array.insert") {
    return command.item.id === id || valueMentions(command.item.value, id);
  }
  if (command.kind === "object.delete") {
    return command.key === id;
  }
  return valueMentions(command.value, id);
};

/** The `type` of every node inserted by a command batch. */
const insertedNodeTypes = (commands: readonly Command[]): (string | undefined)[] =>
  commands.flatMap((command) => {
    if (command.kind !== "tree.insert") {
      return [];
    }
    return [stringField(command.node.value, "type")];
  });

describe("applyDocumentEditsToTree", () => {
  const liveTree = () =>
    encode([{ type: "root", name: "Paywall", children: [{ type: "screen", name: "Main" }] }]);

  test("insert emits a tree.insert carrying the pre-minted target id (id survives reconcile)", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    const edits: DocumentEdit[] = [
      { op: "insert", parentId: screenId, node: { type: "view", name: "Card" } },
    ];
    const { result, mintedIds } = applyDocumentEditsToTree({ tree, edits });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;

    const minted = mintedIds["0"]!;
    expect(minted).toHaveLength(1);
    const newId = minted[0]!;

    // The reconcile emitted a tree.insert whose node.id IS the minted id — proving
    // the pre-minted id survives encode + reconcile and is addressable next.
    const insert = result.commands.find((command) => command.kind === "tree.insert");
    expect(insert).toBeDefined();
    expect(insert!.node.id).toBe(newId);
  });

  test("update touches only the edited node (no-op elsewhere → minimal commands)", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    const edits: DocumentEdit[] = [{ op: "update", nodeId: screenId, set: { name: "Renamed" } }];
    const { result } = applyDocumentEditsToTree({ tree, edits });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // Exactly the name field changed → a single object.set, no inserts/moves/deletes.
    expect(result.commands.every((command) => command.kind === "object.set")).toBe(true);
  });

  test("a no-op edit batch (empty target diff) reconciles to zero commands", () => {
    const tree = liveTree();
    const screenId = screenIdOf(tree);
    // Setting the name to its current value is a no-op.
    const edits: DocumentEdit[] = [{ op: "update", nodeId: screenId, set: { name: "Main" } }];
    const { result } = applyDocumentEditsToTree({ tree, edits });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    expect(result.commands).toEqual([]);
  });

  test("a malformed tree is rejected on the typed channel", () => {
    const edits: DocumentEdit[] = [{ op: "update", nodeId: "x", set: {} }];
    const { result } = applyDocumentEditsToTree({ tree: { not: "a tree" }, edits });
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
    const viewId = nodeIdOfType(tree, "view");

    const edits: DocumentEdit[] = [{ op: "update", nodeId: screenId, set: { name: "Renamed" } }];
    const { result } = applyDocumentEditsToTree({ tree, edits });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // Only the screen's name changed — no command touches the array-bearing view.
    const touchesView = result.commands.some((command) => commandMentions(command, viewId));
    expect(touchesView).toBe(false);
    // And every emitted command is the single name set on the screen.
    expect(result.commands.every((command) => command.kind === "object.set")).toBe(true);
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
    const types = insertedNodeTypes(result.commands);
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
    const ccId = nodeIdOfType(tree, "codeComponent");

    const result = writeComponentSourceToTree({
      tree,
      path: "components/hero.tsx",
      source: "new source",
    });
    expect(result.kind).toBe("commands");
    if (result.kind !== "commands") return;
    // No inserts (the node already exists) — only a field update on the same id.
    expect(result.commands.some((command) => command.kind === "tree.insert")).toBe(false);
    const update = result.commands.find(
      (command) => command.kind === "object.set" && command.key === "source",
    );
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
