import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "../../src/index.js";

describe("primitives tree", () => {
  const FileNode = Primitive.TreeNode("file", {
    data: Primitive.Struct({
      name: Primitive.String().required(),
    }),
    children: [],
  });

  const FolderNode = Primitive.TreeNode("folder", {
    data: Primitive.Struct({
      name: Primitive.String().required(),
    }),
    children: [Primitive.TreeNodeSelf, FileNode],
  });

  it("builds tree schemas from node graphs", () => {
    const primitive = Primitive.Tree({ root: FolderNode });
    expect(primitive.schema.kind).toBe("tree");
    expect(primitive.schema.variants.folder.children).toEqual(["folder", "file"]);
  });

  it("supports staged inserts and nested data updates", () => {
    const primitive = Primitive.Tree({ root: FolderNode });
    const snapshot = primitive.encode([
      {
        type: "folder",
        name: "root",
        children: [],
      },
    ]);

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      const folder = root.children.first();
      folder?.data.name.set("workspace");
      const inserted = folder?.children.insertLast({
        type: "file",
        name: "notes.md",
      });
      inserted?.data.name.set("notes-1.md");
    });

    const decoded = primitive.decode(applyBatch(snapshot, commands));
    expect(decoded?.[0]?.data.name).toBe("workspace");
    expect(decoded?.[0]?.children[0]?.data.name).toBe("notes-1.md");
  });
});
