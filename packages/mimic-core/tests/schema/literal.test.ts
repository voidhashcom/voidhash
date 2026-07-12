import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  booleanValue,
  materializeDefault,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";
import { expectSchemaErrorCode } from "./helpers.js";

describe("schema literal model", () => {
  it("parses and serializes literal schemas", () => {
    const schema = parseSchema({
      kind: "literal",
      required: true,
      value: "board",
      default: { kind: "string", value: "board" },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "literal",
      required: true,
      value: "board",
      default: { kind: "string", value: "board" },
    });
  });

  it("validates matching literals", () => {
    expect(
      validate(parseSchema({ kind: "literal", value: "board" }), stringValue("board")),
    ).toEqual(stringValue("board"));
  });

  it("rejects mismatched literals", () => {
    expectSchemaErrorCode(
      () => validate(parseSchema({ kind: "literal", value: true }), booleanValue(false)),
      SchemaErrorCodes.LiteralMismatch,
    );
  });

  it("rejects invalid literal values during parse", () => {
    expectSchemaErrorCode(
      () => parseSchema({ kind: "literal", value: null }),
      SchemaErrorCodes.InvalidSchema,
    );
  });

  it("rejects default values that do not match the literal", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "literal",
          value: "board",
          default: { kind: "string", value: "card" },
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });

  it("materializes explicit defaults", () => {
    expect(
      materializeDefault(
        parseSchema({
          kind: "literal",
          value: "board",
          default: { kind: "string", value: "board" },
        }),
      ),
    ).toEqual(stringValue("board"));
  });
});
