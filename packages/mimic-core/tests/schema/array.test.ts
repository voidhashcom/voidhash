import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  arrayValue,
  booleanValue,
  materializeDefault,
  objectValue,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";
import { expectSchemaErrorCode } from "./helpers.js";

describe("schema array model", () => {
  it("parses and serializes arrays", () => {
    const schema = parseSchema({
      kind: "array",
      required: true,
      element: { kind: "string" },
      validators: [{ kind: "minLength", value: 1 }],
      default: {
        kind: "array",
        items: [{ id: "a", pos: "a0", value: { kind: "string", value: "x" } }],
      },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "array",
      required: true,
      element: { kind: "string" },
      validators: [{ kind: "minLength", value: 1 }],
      default: {
        kind: "array",
        items: [{ id: "a", pos: "a0", value: { kind: "string", value: "x" } }],
      },
    });
  });

  it("sanitizes items recursively while preserving ids and positions", () => {
    const schema = parseSchema({
      kind: "array",
      element: {
        kind: "object",
        fields: {
          title: { kind: "string" },
          done: { kind: "boolean", default: { kind: "boolean", value: false } },
        },
      },
    });

    expect(
      validate(
        schema,
        arrayValue([
          {
            id: "i1",
            pos: "a0",
            value: objectValue({
              title: stringValue("A"),
              extra: stringValue("remove"),
            }),
          },
        ]),
      ),
    ).toEqual(
      arrayValue([
        {
          id: "i1",
          pos: "a0",
          value: objectValue({
            title: stringValue("A"),
            done: booleanValue(false),
          }),
        },
      ]),
    );
  });

  it.each([
    [{ kind: "minLength", value: 2 }, 1],
    [{ kind: "maxLength", value: 0 }, 1],
  ] as const)("enforces array validator %o", (validator, count) => {
    const schema = parseSchema({
      kind: "array",
      element: { kind: "string" },
      validators: [validator],
    });

    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          arrayValue(
            Array.from({ length: count }, (_, index) => ({
              id: `i${index}`,
              pos: `a${index}`,
              value: stringValue(`v${index}`),
            })),
          ),
        ),
      SchemaErrorCodes.ValidatorFailed,
    );
  });

  it("materializes explicit defaults", () => {
    const schema = parseSchema({
      kind: "array",
      element: { kind: "string" },
      default: {
        kind: "array",
        items: [{ id: "i1", pos: "a0", value: { kind: "string", value: "hello" } }],
      },
    });

    expect(materializeDefault(schema)).toEqual(
      arrayValue([{ id: "i1", pos: "a0", value: stringValue("hello") }]),
    );
  });

  it("throws missing_required for required arrays without defaults", () => {
    expectSchemaErrorCode(
      () =>
        validate(
          parseSchema({
            kind: "array",
            required: true,
            element: { kind: "string" },
          }),
        ),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("rejects invalid array validators during parse", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "array",
          element: { kind: "string" },
          validators: [{ kind: "maxLength", value: "x" }],
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
