import { describe, expect, it } from "vitest";
import { Primitive, applyBatch, stringValue } from "../../src/index.js";

describe("primitives literal", () => {
  it("builds literal schemas", () => {
    const primitive = Primitive.Literal("text").required().default("text");
    expect(primitive.schema).toEqual({
      kind: "literal",
      required: true,
      value: "text",
      default: stringValue("text"),
    });
  });

  it("emits literal replacement commands", () => {
    const primitive = Primitive.Literal("text");
    const snapshot = primitive.encode("text");
    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.set("text");
    });

    expect(commands).toEqual([{ kind: "value.set", path: [], value: stringValue("text") }]);
    expect(primitive.decode(applyBatch(snapshot, commands))).toBe("text");
  });
});
