import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "../../src/index.js";

describe("primitives lazy", () => {
  it("delegates schema, encode, and command creation to the resolved primitive", () => {
    const primitive = Primitive.Lazy(() => Primitive.String().default("hello"));
    const snapshot = primitive.encode("hello");

    expect(primitive.schema).toEqual({
      kind: "string",
      default: { kind: "string", value: "hello" },
    });

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.set("world");
    });

    expect(primitive.decode(applyBatch(snapshot, commands))).toBe("world");
  });
});
