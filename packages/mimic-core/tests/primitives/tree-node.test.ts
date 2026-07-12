import { describe, expect, it } from "vitest";
import { Primitive } from "../../src/index.js";

describe("primitives tree node", () => {
  it("resolves TreeNodeSelf in children", () => {
    const Folder = Primitive.TreeNode("folder", {
      data: Primitive.Struct({
        name: Primitive.String().required(),
      }),
      children: [Primitive.TreeNodeSelf],
    });

    expect(Folder.children).toHaveLength(1);
    expect(Folder.children[0]).toBe(Folder);
    expect(Folder.isChildAllowed("folder")).toBe(true);
  });
});
