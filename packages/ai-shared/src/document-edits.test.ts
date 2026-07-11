import { ScreenNode, TextNode, ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vitest";

import { validateDocumentEdits, type EditableDocumentNode } from "./document-edits.ts";
import type { DocumentEdit } from "./surfaces.ts";

/**
 * Decode a node type's data with the given partial input via the live mimic
 * schema (defaults filled) — the same round-trip the vocabulary-contract test
 * uses, so fixtures match what the designer actually persists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeData(prim: any, input: unknown): Record<string, unknown> {
  return prim.data.decode(prim.data.encode(input)) as Record<string, unknown>;
}

/** A small realistic tree: root → screen → view → text. */
function makeTree(): EditableDocumentNode {
  return {
    id: "root1",
    type: "root",
    data: {},
    children: [
      {
        id: "screen1",
        type: "screen",
        data: decodeData(ScreenNode, {}),
        children: [
          {
            id: "view1",
            type: "view",
            data: decodeData(ViewNode, {}),
            children: [
              { id: "text1", type: "text", data: decodeData(TextNode, { text: "Hi" }), children: [] },
            ],
          },
        ],
      },
    ],
  };
}

describe("validateDocumentEdits — error quality", () => {
  test("unknown style field: did-you-mean + allowed list", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { backgroundEnable: true } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors[0]!;
    expect(err.code).toBe("unknownField");
    expect(err.message).toContain("backgroundEnable");
    // did-you-mean names the real field
    expect(err.message).toContain("did you mean `backgroundEnabled`?");
    // allowed list is derived from the schema (not hand-listed)
    expect(err.message).toContain("allowed:");
    expect(err.message).toContain("backgroundColor");
    expect(err.message).toContain("paddingTop");
  });

  test("bad enum value names the allowed values", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { justifyContent: "middle" } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors[0]!;
    expect(err.code).toBe("invalidValue");
    expect(err.message).toContain('"middle"');
    expect(err.message).toContain("Allowed values");
    expect(err.message).toContain('"flex-start"');
    expect(err.message).toContain('"space-between"');
  });

  test("wrong scalar family names the expected type", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { paddingTop: "big" } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors[0]!;
    expect(err.code).toBe("invalidValue");
    expect(err.message).toContain("Expected number");
    expect(err.message).toContain("style.paddingTop");
  });

  test("illegal child type names the allowed children", () => {
    // text nodes have no children
    const result = validateDocumentEdits(
      [{ op: "insert", parentId: "text1", node: { type: "view" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "illegalChild")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("text");
    expect(err.message).toContain("cannot contain children");
  });

  test("illegal child under a container names the allowed set", () => {
    const result = validateDocumentEdits(
      [{ op: "insert", parentId: "view1", node: { type: "screen" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "illegalChild")!;
    expect(err.message).toContain("`screen` cannot be a child of `view`");
    expect(err.message).toContain("Allowed children of `view`: [view, scrollView, text, shape, component]");
  });

  test("scrollView is an insertable node type (legal child of view)", () => {
    const result = validateDocumentEdits(
      [{ op: "insert", parentId: "view1", node: { type: "scrollView" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("unknown node id names the id", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "ghost", set: { name: "x" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("unknownNode");
    expect(result.errors[0]!.message).toContain("`ghost`");
  });

  test("move into own subtree is a cycle", () => {
    // screen1 contains view1 → moving screen1 under view1 is a cycle
    const result = validateDocumentEdits(
      [{ op: "move", nodeId: "screen1", parentId: "view1", index: 0 }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "moveCycle")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("cycle");
  });

  test("inserting root / library / codeComponent is rejected", () => {
    const result = validateDocumentEdits(
      [
        { op: "insert", parentId: "view1", node: { type: "root" } },
        { op: "insert", parentId: "view1", node: { type: "codeComponent" } },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const rootErr = result.errors.find((e) => e.code === "invalidNodeType" && e.message.includes("root"))!;
    const ccErr = result.errors.find((e) => e.code === "invalidNodeType" && e.message.includes("codeComponent"))!;
    expect(rootErr).toBeDefined();
    expect(ccErr.message).toContain("component tools");
  });

  test("collects ALL errors across a batch, not just the first", () => {
    const result = validateDocumentEdits(
      [
        { op: "update", nodeId: "view1", set: { style: { backgroundEnable: true } } }, // 0
        { op: "update", nodeId: "view1", set: { style: { justifyContent: "nope" } } }, // 1
        { op: "update", nodeId: "ghost", set: { name: "x" } }, // 2
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const indices = new Set(result.errors.map((e) => e.editIndex));
    expect(indices).toEqual(new Set([0, 1, 2]));
  });

  test("empty batch is rejected", () => {
    const result = validateDocumentEdits([], makeTree());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("emptyBatch");
  });
});

/** A tree that also carries a `library` + `codeComponent` under the root. */
function makeTreeWithLibrary(): EditableDocumentNode {
  const base = makeTree();
  return {
    ...base,
    children: [
      ...(base.children ?? []),
      {
        id: "lib1",
        type: "library",
        data: {},
        children: [{ id: "cc1", type: "codeComponent", data: { path: "components/x.tsx" }, children: [] }],
      },
    ],
  };
}

describe("validateDocumentEdits — protected targets", () => {
  test("remove/move of the document root is rejected", () => {
    const result = validateDocumentEdits(
      [
        { op: "remove", nodeId: "root1" },
        { op: "move", nodeId: "root1", parentId: "screen1", index: 0 },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const removeErr = result.errors.find((e) => e.editIndex === 0)!;
    const moveErr = result.errors.find((e) => e.editIndex === 1)!;
    expect(removeErr.code).toBe("protectedTarget");
    expect(removeErr.message).toContain("document root");
    expect(moveErr.code).toBe("protectedTarget");
  });

  test("remove of a library / codeComponent routes to the component tools", () => {
    const result = validateDocumentEdits(
      [
        { op: "remove", nodeId: "cc1" },
        { op: "remove", nodeId: "lib1" },
      ] as DocumentEdit[],
      makeTreeWithLibrary(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const ccErr = result.errors.find((e) => e.nodeId === "cc1")!;
    expect(ccErr.code).toBe("protectedTarget");
    expect(ccErr.message).toContain("delete_component");
    expect(ccErr.message).toContain("placeholder");
    const libErr = result.errors.find((e) => e.nodeId === "lib1")!;
    expect(libErr.code).toBe("protectedTarget");
  });

  test("replaceChildren of a codeComponent is rejected (target type gated)", () => {
    const result = validateDocumentEdits(
      [{ op: "replaceChildren", nodeId: "cc1", children: [] }] as DocumentEdit[],
      makeTreeWithLibrary(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("protectedTarget");
  });
});

describe("validateDocumentEdits — overlapping edits", () => {
  test("two edits on the SAME node id are rejected", () => {
    const result = validateDocumentEdits(
      [
        { op: "update", nodeId: "view1", set: { name: "X" } },
        { op: "remove", nodeId: "view1" },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "overlappingEdits")!;
    expect(err).toBeDefined();
    expect(err.nodeId).toBe("view1");
    expect(err.message).toContain("merge");
  });

  test("an edit inside a subtree another edit removes is rejected", () => {
    // text1 is inside view1 → [remove view1, update text1] overlaps (text1 ⊂ view1).
    const result = validateDocumentEdits(
      [
        { op: "remove", nodeId: "view1" },
        { op: "update", nodeId: "text1", set: { text: "Y" } },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "overlappingEdits")!;
    expect(err).toBeDefined();
    expect(err.nodeId).toBe("text1");
    expect(err.message).toContain("removes");
  });

  test("nested removes (B inside A) are rejected", () => {
    // remove screen1 (which contains view1) + remove view1 → view1 ⊂ screen1.
    const result = validateDocumentEdits(
      [
        { op: "remove", nodeId: "screen1" },
        { op: "remove", nodeId: "view1" },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "overlappingEdits" && e.nodeId === "view1")!;
    expect(err).toBeDefined();
  });

  test("two updates on DIFFERENT nodes are legal", () => {
    const result = validateDocumentEdits(
      [
        { op: "update", nodeId: "view1", set: { name: "A" } },
        { op: "update", nodeId: "text1", set: { text: "B" } },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("removing A alone (its subtree comes along) is legal", () => {
    const result = validateDocumentEdits(
      [{ op: "remove", nodeId: "view1" }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateDocumentEdits — component identity", () => {
  test("an identity-less component insert is rejected", () => {
    const result = validateDocumentEdits(
      [{ op: "insert", parentId: "view1", node: { type: "component" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "missingComponentIdentity")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("componentSlug");
    expect(err.message).toContain("componentPath");
    expect(err.message).toContain('componentSource: "local"');
  });

  test("a local component with a path but componentSource !== local is rejected", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: { type: "component", componentPath: "components/x.tsx" },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "missingComponentIdentity")).toBe(true);
  });

  test("a catalog component (componentSlug) is accepted", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: { type: "component", componentSlug: "hero-banner" },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("a local component (componentPath + componentSource:local) is accepted", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: {
            type: "component",
            componentPath: "components/x.tsx",
            componentSource: "local",
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("a builtin component (componentSource:builtin + registered slug) is accepted", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: {
            type: "component",
            componentSource: "builtin",
            componentSlug: "sample-badge",
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("a builtin component with an unknown slug lists the valid builtins", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: {
            type: "component",
            componentSource: "builtin",
            componentSlug: "does-not-exist",
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "missingComponentIdentity")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("Unknown builtin");
    expect(err.message).toContain("does-not-exist");
    // The valid-slug list is derived from the registry, not hand-listed.
    expect(err.message).toContain("sample-badge");
  });

  test("a builtin component missing its slug is rejected", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: { type: "component", componentSource: "builtin" },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "missingComponentIdentity")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("componentSlug");
    expect(err.message).toContain("sample-badge");
  });

  test("a builtin carrying pinning/local fields (contradictory) is rejected", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "view1",
          node: {
            type: "component",
            componentSource: "builtin",
            componentSlug: "sample-badge",
            componentPath: "components/x.tsx",
            componentVersion: 3,
            contentHash: "abc",
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "missingComponentIdentity")!;
    expect(err).toBeDefined();
    expect(err.message).toContain("UNPINNED");
    expect(err.message).toContain("componentPath");
    expect(err.message).toContain("componentVersion");
    expect(err.message).toContain("contentHash");
  });
});

describe("validateDocumentEdits — accepts a realistic valid batch", () => {
  test("insert view with style, update text, move (non-overlapping)", () => {
    // Note: text1 is updated (edit 1) then moved (edit 2) — DIFFERENT ops on the
    // same node would overlap, so this batch updates text1 and moves the whole
    // `view1` (its container), which are disjoint targets.
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "screen1",
          node: {
            type: "view",
            name: "Card",
            style: { paddingTop: 16, justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 1)" },
            children: [{ type: "text", text: "Buy now", style: { fontSize: 20 } }],
          },
        },
        { op: "update", nodeId: "text1", set: { text: "Updated", style: { fontSize: 24 } } },
        { op: "move", nodeId: "view1", parentId: "screen1", index: 0 },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("replaceChildren with valid node inputs", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "replaceChildren",
          nodeId: "view1",
          children: [
            { type: "text", text: "A" },
            { type: "view", style: { gap: 8 } },
          ],
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
  });

  test("out-of-range index is clamped, not rejected", () => {
    const result = validateDocumentEdits(
      [{ op: "insert", parentId: "screen1", index: 999, node: { type: "view" } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inserted = result.edits[0]!;
    // screen1 has one child → clamp to 1 (append)
    expect(inserted.op === "insert" && inserted.index).toBe(1);
  });
});

/** The `style` object of a normalized edit's `set` (update) or `node` (insert). */
function styleOf(edit: DocumentEdit | undefined): Record<string, unknown> {
  if (edit?.op === "update") return (edit.set as { style?: Record<string, unknown> }).style ?? {};
  if (edit?.op === "insert") return (edit.node as { style?: Record<string, unknown> }).style ?? {};
  return {};
}

describe("validateDocumentEdits — derived *Enabled flags", () => {
  test("update setting backgroundColor on a view injects backgroundEnabled", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { backgroundColor: "rgba(1, 2, 3, 1)" } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(styleOf(result.edits[0]).backgroundEnabled).toBe(true);
    expect(styleOf(result.edits[0]).backgroundColor).toBe("rgba(1, 2, 3, 1)");
  });

  test("insert of a view with a nested text derives each node's own group", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "insert",
          parentId: "screen1",
          node: {
            type: "view",
            style: { backgroundColor: "rgba(1, 2, 3, 1)" },
            children: [{ type: "text", text: "Hi", style: { borderColor: "rgba(0, 0, 0, 1)" } }],
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inserted = result.edits[0];
    expect(inserted?.op === "insert").toBe(true);
    if (inserted?.op !== "insert") return;
    const parentStyle = (inserted.node as { style?: Record<string, unknown> }).style ?? {};
    expect(parentStyle.backgroundEnabled).toBe(true);
    // The text child gets its own group's flag (border), NOT the parent's.
    const child = (inserted.node.children ?? [])[0] as { style?: Record<string, unknown> };
    expect(child.style?.borderEnabled).toBe(true);
    expect(child.style?.backgroundEnabled).toBeUndefined();
  });

  test("an explicit backgroundEnabled: false is not overridden", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "update",
          nodeId: "view1",
          set: { style: { backgroundColor: "rgba(1, 2, 3, 1)", backgroundEnabled: false } },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(styleOf(result.edits[0]).backgroundEnabled).toBe(false);
  });

  test("a border RADIUS field alone does NOT inject borderEnabled", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { borderTopLeftRadius: 12 } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(styleOf(result.edits[0])).not.toHaveProperty("borderEnabled");
  });

  test("per-type: text border, path fill, path stroke, screen background", () => {
    const tree: EditableDocumentNode = {
      id: "root1",
      type: "root",
      data: {},
      children: [
        {
          id: "screen1",
          type: "screen",
          data: decodeData(ScreenNode, {}),
          children: [
            { id: "text1", type: "text", data: decodeData(TextNode, {}), children: [] },
            {
              id: "shape1",
              type: "shape",
              data: {},
              children: [{ id: "path1", type: "path", data: {}, children: [] }],
            },
          ],
        },
      ],
    };
    const result = validateDocumentEdits(
      [
        { op: "update", nodeId: "text1", set: { style: { borderColor: "rgba(0, 0, 0, 1)" } } },
        { op: "update", nodeId: "path1", set: { style: { fillColor: "rgba(1, 1, 1, 1)" } } },
        { op: "update", nodeId: "screen1", set: { style: { backgroundType: "gradient" } } },
      ] as DocumentEdit[],
      tree,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(styleOf(result.edits[0]).borderEnabled).toBe(true);
    expect(styleOf(result.edits[1]).fillEnabled).toBe(true);
    expect(styleOf(result.edits[2]).backgroundEnabled).toBe(true);

    // strokeWidth on a path → strokeEnabled (separate case for the stroke group).
    const stroke = validateDocumentEdits(
      [{ op: "update", nodeId: "path1", set: { style: { strokeWidth: 2 } } }] as DocumentEdit[],
      tree,
    );
    expect(stroke.ok).toBe(true);
    if (!stroke.ok) return;
    expect(styleOf(stroke.edits[0]).strokeEnabled).toBe(true);
  });

  test("an update with no group keys is untouched (no flag injected)", () => {
    const result = validateDocumentEdits(
      [{ op: "update", nodeId: "view1", set: { style: { paddingTop: 8 } } }] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(styleOf(result.edits[0])).toEqual({ paddingTop: 8 });
  });

  test("replaceChildren children get their group flags derived", () => {
    const result = validateDocumentEdits(
      [
        {
          op: "replaceChildren",
          nodeId: "view1",
          children: [{ type: "view", style: { backgroundColor: "rgba(1, 2, 3, 1)" } }],
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edit = result.edits[0];
    expect(edit?.op === "replaceChildren").toBe(true);
    if (edit?.op !== "replaceChildren") return;
    const child = edit.children[0] as { style?: Record<string, unknown> };
    expect(child.style?.backgroundEnabled).toBe(true);
  });

  test("re-validating a normalized batch is stable (idempotent)", () => {
    const first = validateDocumentEdits(
      [
        { op: "update", nodeId: "view1", set: { style: { backgroundColor: "rgba(1, 2, 3, 1)" } } },
        {
          op: "insert",
          parentId: "screen1",
          node: {
            type: "view",
            style: { borderColor: "rgba(0, 0, 0, 1)" },
            children: [{ type: "text", text: "Hi", style: { shadowColor: "rgba(0, 0, 0, 1)" } }],
          },
        },
      ] as DocumentEdit[],
      makeTree(),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDocumentEdits(first.edits as DocumentEdit[], makeTree());
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.edits).toEqual(first.edits);
  });
});
