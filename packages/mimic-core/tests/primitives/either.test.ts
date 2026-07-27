import { describe, expect, it } from "vitest";
import { Primitive, applyBatch, numberValue } from "../../src/index.js";

describe("primitives either", () => {
  it("builds portable either schemas", () => {
    const primitive = Primitive.Either(Primitive.String(), Primitive.Number());
    expect(primitive.schema).toEqual({
      kind: "either",
      variants: [{ kind: "string" }, { kind: "number" }],
    });
  });

  it("encodes matching variants and emits value replacement commands", () => {
    const primitive = Primitive.Either(Primitive.String(), Primitive.Number());
    const snapshot = primitive.encode("hello");
    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.set(1);
    });

    expect(primitive.decode(applyBatch(snapshot, commands))).toBe(1);
    expect(commands).toEqual([{ kind: "value.set", path: [], value: numberValue(1) }]);
  });
});
