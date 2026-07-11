import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  booleanValue,
  materializeDefault,
  numberValue,
  parseSchema,
  serializeSchema,
  validate,
} from "../../src/index.js";
import { expectSchemaErrorCode } from "./helpers.js";

describe("schema boolean model", () => {
  it("parses and serializes defaults", () => {
    const schema = parseSchema({
      kind: "boolean",
      required: true,
      default: { kind: "boolean", value: true },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "boolean",
      required: true,
      default: { kind: "boolean", value: true },
    });
  });

  it("validates boolean values", () => {
    expect(validate(parseSchema({ kind: "boolean" }), booleanValue(false))).toEqual(
      booleanValue(false),
    );
  });

  it("rejects non-boolean values", () => {
    expectSchemaErrorCode(
      () => validate(parseSchema({ kind: "boolean" }), numberValue(1)),
      SchemaErrorCodes.TypeMismatch,
    );
  });

  it("materializes explicit defaults", () => {
    expect(
      materializeDefault(
        parseSchema({
          kind: "boolean",
          default: { kind: "boolean", value: false },
        }),
      ),
    ).toEqual(booleanValue(false));
  });

  it("returns undefined for optional booleans without defaults", () => {
    expect(validate(parseSchema({ kind: "boolean" }))).toBeUndefined();
  });

  it("throws missing_required for required booleans without defaults", () => {
    expectSchemaErrorCode(
      () => validate(parseSchema({ kind: "boolean", required: true })),
      SchemaErrorCodes.MissingRequired,
    );
  });
});
