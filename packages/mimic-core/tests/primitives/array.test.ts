import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "../../src/index.js";

describe("primitives array", () => {
  it("builds array schemas and ordered snapshots", () => {
    const primitive = Primitive.Array(Primitive.String()).minLength(1);
    expect(primitive.schema).toEqual({
      kind: "array",
      element: { kind: "string" },
      validators: [{ kind: "minLength", value: 1 }],
    });
  });

  it("supports push, staged reads, and nested updates", () => {
    const primitive = Primitive.Array(
      Primitive.Struct({
        title: Primitive.String().required(),
      }),
    );
    const snapshot = primitive.encode([{ title: "A" }]);

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      const inserted = root.push({ title: "B" });
      inserted.value.title.set("B2");
      root.first()?.value.title.set("A1");
    });

    const decoded = primitive.decode(applyBatch(snapshot, commands));
    expect(decoded?.map((entry) => entry.value?.title)).toEqual(["A1", "B2"]);
  });

  it("supports moves based on staged ordering", () => {
    const primitive = Primitive.Array(Primitive.String());
    const snapshot = primitive.encode(["A", "B", "C"]);

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      const last = root.last();
      if (last) {
        root.move(last.id, 1);
      }
    });

    const decoded = primitive.decode(applyBatch(snapshot, commands));
    expect(decoded?.map((entry) => entry.value)).toEqual(["A", "C", "B"]);
  });
});
