import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  numberValue,
  objectValue,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";
import { expectSchemaErrorCode } from "./helpers.js";

describe("schema union model", () => {
  it("parses and serializes union variants", () => {
    const schema = parseSchema({
      kind: "union",
      required: true,
      discriminator: "type",
      variants: {
        text: {
          kind: "object",
          fields: {
            type: { kind: "literal", value: "text" },
            value: { kind: "string" },
          },
        },
      },
      default: {
        kind: "object",
        fields: {
          type: { kind: "string", value: "text" },
          value: { kind: "string", value: "hello" },
        },
      },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "union",
      required: true,
      discriminator: "type",
      variants: {
        text: {
          kind: "object",
          fields: {
            type: { kind: "literal", value: "text" },
            value: { kind: "string" },
          },
        },
      },
      default: {
        kind: "object",
        fields: {
          type: { kind: "string", value: "text" },
          value: { kind: "string", value: "hello" },
        },
      },
    });
  });

  it("selects the matching variant and sanitizes it", () => {
    const schema = parseSchema({
      kind: "union",
      discriminator: "type",
      variants: {
        text: {
          kind: "object",
          fields: {
            type: { kind: "literal", value: "text" },
            value: { kind: "string" },
            count: { kind: "number", default: { kind: "number", value: 0 } },
          },
        },
      },
    });

    expect(
      validate(
        schema,
        objectValue({
          type: stringValue("text"),
          value: stringValue("hello"),
          extra: stringValue("remove"),
        }),
      ),
    ).toEqual(
      objectValue({
        type: stringValue("text"),
        value: stringValue("hello"),
        count: numberValue(0),
      }),
    );
  });

  it("rejects missing or unknown discriminators", () => {
    const schema = parseSchema({
      kind: "union",
      discriminator: "type",
      variants: {
        text: {
          kind: "object",
          fields: {
            type: { kind: "literal", value: "text" },
          },
        },
      },
    });

    expectSchemaErrorCode(() => validate(schema, objectValue({})), SchemaErrorCodes.UnionNoMatch);
    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          objectValue({
            type: stringValue("unknown"),
          }),
        ),
      SchemaErrorCodes.UnionNoMatch,
    );
  });

  it("rejects invalid discriminator field declarations during parse", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "union",
          discriminator: "type",
          variants: {
            text: {
              kind: "object",
              fields: {
                type: { kind: "string" },
              },
            },
          },
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
