import { describe, expect, it } from "vitest";
import { Primitive, booleanValue } from "../../src/index.js";

describe("primitives boolean", () => {
  it("builds boolean schemas and defaults", () => {
    const primitive = Primitive.Boolean().required().default(true);
    expect(primitive.schema).toEqual({
      kind: "boolean",
      required: true,
      default: booleanValue(true),
    });
  });

  it("encodes and decodes booleans", () => {
    const primitive = Primitive.Boolean();
    expect(primitive.encode(true)).toEqual(booleanValue(true));
    expect(primitive.decode(booleanValue(false))).toBe(false);
  });
});
