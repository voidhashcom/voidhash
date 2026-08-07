import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  materializeDefault,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";
import { constant, expectSchemaErrorCode } from "./helpers.js";

describe("schema string model", () => {
  it("parses and serializes validators and defaults", () => {
    const schema = parseSchema({
      kind: "string",
      required: true,
      default: { kind: "string", value: "hello" },
      validators: [
        { kind: "minLength", value: 1 },
        { kind: "maxLength", value: 10 },
        { kind: "length", value: 5 },
        { kind: "regex", pattern: "^hello$" },
      ],
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "string",
      required: true,
      default: { kind: "string", value: "hello" },
      validators: [
        { kind: "minLength", value: 1 },
        { kind: "maxLength", value: 10 },
        { kind: "length", value: 5 },
        { kind: "regex", pattern: "^hello$" },
      ],
    });
  });

  it.each(constant([
    [{ kind: "minLength", value: 3 }, stringValue("ab"), "validator_failed"],
    [{ kind: "maxLength", value: 2 }, stringValue("abc"), "validator_failed"],
    [{ kind: "length", value: 2 }, stringValue("abc"), "validator_failed"],
    [{ kind: "regex", pattern: "^a+$" }, stringValue("bbb"), "validator_failed"],
    [{ kind: "email" }, stringValue("not-an-email"), "validator_failed"],
    [{ kind: "url" }, stringValue("notaurl"), "validator_failed"],
  ]))("rejects invalid string value for validator %o", (validator, value, code) => {
    const schema = parseSchema({
      kind: "string",
      validators: [validator],
    });

    expectSchemaErrorCode(() => validate(schema, value), code);
  });

  it("accepts valid email and url values", () => {
    expect(
      validate(
        parseSchema({ kind: "string", validators: [{ kind: "email" }] }),
        stringValue("a@b.com"),
      ),
    ).toEqual(stringValue("a@b.com"));

    expect(
      validate(
        parseSchema({ kind: "string", validators: [{ kind: "url" }] }),
        stringValue("https://voidha.sh"),
      ),
    ).toEqual(stringValue("https://voidha.sh"));
  });

  it("materializes explicit defaults and clones the result", () => {
    const schema = parseSchema({
      kind: "string",
      default: { kind: "string", value: "hello" },
    });

    const result = materializeDefault(schema);

    expect(result).toEqual(stringValue("hello"));
    expect(result).not.toBe(schema.default);
  });

  it("returns undefined for optional strings without defaults", () => {
    expect(validate(parseSchema({ kind: "string" }))).toBeUndefined();
  });

  it("throws missing_required for required strings without defaults", () => {
    expectSchemaErrorCode(
      () => validate(parseSchema({ kind: "string", required: true })),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("rejects invalid validator payloads during parse", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "string",
          validators: [{ kind: "minLength", value: "x" }],
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
