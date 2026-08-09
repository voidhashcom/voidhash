import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  materializeDefault,
  numberValue,
  parseSchema,
  serializeSchema,
  validate,
} from "../../src/index.js";
import { constant, expectSchemaErrorCode } from "./helpers.js";

describe("schema number model", () => {
  it("parses and serializes validators and defaults", () => {
    const schema = parseSchema({
      kind: "number",
      required: true,
      default: { kind: "number", value: 10 },
      validators: [{ kind: "min", value: 0 }, { kind: "max", value: 100 }, { kind: "int" }],
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "number",
      required: true,
      default: { kind: "number", value: 10 },
      validators: [{ kind: "min", value: 0 }, { kind: "max", value: 100 }, { kind: "int" }],
    });
  });

  it.each(constant([
    [{ kind: "min", value: 2 }, numberValue(1)],
    [{ kind: "max", value: 2 }, numberValue(3)],
    [{ kind: "positive" }, numberValue(0)],
    [{ kind: "negative" }, numberValue(0)],
    [{ kind: "int" }, numberValue(1.5)],
  ]))("rejects invalid number for validator %o", (validator, value) => {
    const schema = parseSchema({
      kind: "number",
      validators: [validator],
    });

    expectSchemaErrorCode(() => validate(schema, value), SchemaErrorCodes.ValidatorFailed);
  });

  it("materializes explicit defaults", () => {
    const schema = parseSchema({
      kind: "number",
      default: { kind: "number", value: 7 },
    });

    expect(materializeDefault(schema)).toEqual(numberValue(7));
  });

  it("returns undefined for optional numbers without defaults", () => {
    expect(validate(parseSchema({ kind: "number" }))).toBeUndefined();
  });

  it("throws missing_required for required numbers without defaults", () => {
    expectSchemaErrorCode(
      () => validate(parseSchema({ kind: "number", required: true })),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("rejects invalid validator payloads during parse", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "number",
          validators: [{ kind: "min", value: "x" }],
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
