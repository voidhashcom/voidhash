import { describe, expect, test } from "vite-plus/test";

import { excludeNestedNodes } from "./tree";

interface Node {
  readonly id: string;
  readonly children?: readonly Node[];
}

/**
 * root
 * ├─ a
 * │  └─ a1
 * │     └─ a1a
 * └─ b
 *    └─ b1
 */
const tree: Node = {
  id: "root",
  children: [
    { id: "a", children: [{ id: "a1", children: [{ id: "a1a" }] }] },
    { id: "b", children: [{ id: "b1" }] },
  ],
};

describe("excludeNestedNodes", () => {
  test("drops a selected node whose selected ancestor is also present", () => {
    // `a` and its descendant `a1` are both selected → keep only `a`.
    expect(excludeNestedNodes(tree, ["a", "a1"])).toEqual(["a"]);
  });

  test("keeps siblings and unrelated branches", () => {
    // `a` and `b` are unrelated; neither is an ancestor of the other.
    expect(excludeNestedNodes(tree, ["a", "b"])).toEqual(["a", "b"]);
  });

  test("drops a deep descendant when any ancestor in the set is selected", () => {
    // `a` (selected) is an ancestor of the deep `a1a` → `a1a` is dropped.
    expect(excludeNestedNodes(tree, ["a", "a1a"])).toEqual(["a"]);
  });

  test("keeps a descendant when its ancestor is NOT selected", () => {
    // `a1a` selected without `a`/`a1` → nothing removes it.
    expect(excludeNestedNodes(tree, ["a1a", "b1"])).toEqual(["a1a", "b1"]);
  });

  test("preserves input order", () => {
    expect(excludeNestedNodes(tree, ["b", "a"])).toEqual(["b", "a"]);
  });

  test("keeps ids not found in the tree", () => {
    expect(excludeNestedNodes(tree, ["ghost", "a"])).toEqual(["ghost", "a"]);
  });
});
