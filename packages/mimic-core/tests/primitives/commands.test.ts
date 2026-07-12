import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "../../src/index.js";

describe("primitives command sessions", () => {
  it("returns ordered command batches and exposes staged reads", () => {
    const Document = Primitive.Struct({
      items: Primitive.Array(
        Primitive.Struct({
          name: Primitive.String().required(),
        }),
      ),
    });

    const snapshot = Document.encode({
      items: [],
    });

    const commands = Primitive.commands(Document, snapshot, (root) => {
      const inserted = root.items.push({ name: "Draft" });
      inserted.value.name.set("Final");
      root.items.first()?.value.name.set("Published");
    });

    expect(commands).toHaveLength(3);
    expect(Document.decode(applyBatch(snapshot, commands))).toEqual({
      items: [
        expect.objectContaining({
          value: { name: "Published" },
        }),
      ],
    });
  });
});
