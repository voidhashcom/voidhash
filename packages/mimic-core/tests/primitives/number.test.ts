import { describe, expect, it } from "vitest";
import { Primitive, numberValue } from "../../src/index.js";

describe("primitives number", () => {
  it("builds number schemas with validators", () => {
    const primitive = Primitive.Number().required().min(0).max(10).int();
    expect(primitive.schema).toEqual({
      kind: "number",
      required: true,
      validators: [{ kind: "min", value: 0 }, { kind: "max", value: 10 }, { kind: "int" }],
    });
  });

  it("encodes and decodes numbers", () => {
    const primitive = Primitive.Number().default(1);
    expect(primitive.encode(2)).toEqual(numberValue(2));
    expect(primitive.decode(numberValue(2))).toBe(2);
  });
});
