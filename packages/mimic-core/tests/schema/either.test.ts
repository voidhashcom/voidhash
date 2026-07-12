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

describe("schema either model", () => {
  it("parses and serializes variants", () => {
    const schema = parseSchema({
      kind: "either",
      required: true,
      variants: [{ kind: "string" }, { kind: "number" }],
      default: { kind: "string", value: "hello" },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "either",
      required: true,
      variants: [{ kind: "string" }, { kind: "number" }],
      default: { kind: "string", value: "hello" },
    });
  });

  it("tries variants in order and returns the first match", () => {
    const schema = parseSchema({
      kind: "either",
      variants: [
        { kind: "number", validators: [{ kind: "int" }] },
        { kind: "string", validators: [{ kind: "minLength", value: 1 }] },
      ],
    });

    expect(validate(schema, numberValue(1))).toEqual(numberValue(1));
    expect(validate(schema, stringValue("x"))).toEqual(stringValue("x"));
  });

  it("rejects values that match no variant", () => {
    expectSchemaErrorCode(
      () =>
        validate(
          parseSchema({
            kind: "either",
            variants: [{ kind: "number" }, { kind: "string" }],
          }),
          objectValue({}),
        ),
      SchemaErrorCodes.EitherNoMatch,
    );
  });

  it("rejects invalid variants declarations during parse", () => {
    expectSchemaErrorCode(
      () => parseSchema({ kind: "either", variants: {} }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
