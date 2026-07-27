import { describe, expect, it } from "vitest";
import {
  Primitive,
  applyBatch,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";

describe("primitives string", () => {
  it("builds portable string schemas", () => {
    const primitive = Primitive.String().required().default("hello").min(2).max(10).regex(/^h/);

    expect(serializeSchema(parseSchema(serializeSchema(primitive.schema)))).toEqual(
      serializeSchema(primitive.schema),
    );
  });

  it("encodes, decodes, and emits scalar commands", () => {
    const primitive = Primitive.String().default("hello");
    const snapshot = primitive.encode("hello");

    expect(primitive.decode(snapshot)).toBe("hello");

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.set("world");
    });

    expect(commands).toEqual([{ kind: "value.set", path: [], value: stringValue("world") }]);
    expect(primitive.decode(applyBatch(snapshot, commands))).toBe("world");
    expect(validate(primitive.schema, applyBatch(snapshot, commands))).toEqual(
      stringValue("world"),
    );
  });
});
