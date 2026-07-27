import { describe, expect, it } from "vitest";
import { Primitive, applyBatch, parseSchema, serializeSchema, validate } from "../../src/index.js";

describe("primitives schema interop", () => {
  it("roundtrips primitive schemas and validates command results", () => {
    const primitive = Primitive.Struct({
      title: Primitive.String().required(),
      done: Primitive.Boolean().default(false),
    });
    const snapshot = primitive.encode({ title: "A" });

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.done.set(true);
    });

    const next = applyBatch(snapshot, commands);
    expect(serializeSchema(parseSchema(serializeSchema(primitive.schema)))).toEqual(
      serializeSchema(primitive.schema),
    );
    expect(validate(primitive.schema, next)).toEqual(next);
    expect(primitive.decode(next)).toEqual({ title: "A", done: true });
  });
});
