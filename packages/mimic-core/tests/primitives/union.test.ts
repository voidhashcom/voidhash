import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "../../src/index.js";

describe("primitives union", () => {
  const Text = Primitive.Struct({
    value: Primitive.String().required(),
  });

  const Image = Primitive.Struct({
    url: Primitive.String().required(),
  });

  it("injects discriminator schema fields", () => {
    const primitive = Primitive.Union({ text: Text, image: Image });
    expect(primitive.schema).toEqual({
      kind: "union",
      discriminator: "type",
      variants: {
        text: {
          kind: "object",
          fields: {
            value: { kind: "string", required: true },
            type: { kind: "literal", value: "text" },
          },
        },
        image: {
          kind: "object",
          fields: {
            url: { kind: "string", required: true },
            type: { kind: "literal", value: "image" },
          },
        },
      },
    });
  });

  it("supports active variant proxies", () => {
    const primitive = Primitive.Union({ text: Text, image: Image });
    const snapshot = primitive.encode({ type: "text", value: "hello" });

    const commands = Primitive.commands(primitive, snapshot, (root) => {
      root.as("text").value.set("world");
    });

    expect(primitive.decode(applyBatch(snapshot, commands))).toEqual({
      type: "text",
      value: "world",
    });
  });
});
