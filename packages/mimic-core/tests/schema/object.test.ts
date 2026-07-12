import { describe, expect, it } from "vitest";
import {
  SchemaErrorCodes,
  booleanValue,
  materializeDefault,
  numberValue,
  objectValue,
  parseSchema,
  serializeSchema,
  stringValue,
  validate,
} from "../../src/index.js";
import { expectSchemaErrorCode } from "./helpers.js";

describe("schema object model", () => {
  it("parses and serializes nested object fields", () => {
    const schema = parseSchema({
      kind: "object",
      required: true,
      fields: {
        title: { kind: "string" },
        meta: {
          kind: "object",
          fields: {
            active: { kind: "boolean", default: { kind: "boolean", value: true } },
          },
        },
      },
    });

    expect(serializeSchema(schema)).toEqual({
      kind: "object",
      required: true,
      fields: {
        title: { kind: "string" },
        meta: {
          kind: "object",
          fields: {
            active: { kind: "boolean", default: { kind: "boolean", value: true } },
          },
        },
      },
    });
  });

  it("prunes unknown fields recursively and inserts nested defaults", () => {
    const schema = parseSchema({
      kind: "object",
      fields: {
        title: { kind: "string" },
        meta: {
          kind: "object",
          fields: {
            active: { kind: "boolean", default: { kind: "boolean", value: true } },
          },
        },
      },
    });

    expect(
      validate(
        schema,
        objectValue({
          title: stringValue("Doc"),
          extra: stringValue("remove"),
          meta: objectValue({
            trash: stringValue("remove"),
          }),
        }),
      ),
    ).toEqual(
      objectValue({
        title: stringValue("Doc"),
        meta: objectValue({
          active: booleanValue(true),
        }),
      }),
    );
  });

  it("materializes an absent object from child defaults", () => {
    const schema = parseSchema({
      kind: "object",
      fields: {
        title: { kind: "string", default: { kind: "string", value: "hello" } },
        count: { kind: "number", default: { kind: "number", value: 0 } },
      },
    });

    expect(materializeDefault(schema)).toEqual(
      objectValue({
        title: stringValue("hello"),
        count: numberValue(0),
      }),
    );
  });

  it("throws for missing required fields", () => {
    const schema = parseSchema({
      kind: "object",
      fields: {
        title: { kind: "string", required: true },
      },
    });

    expectSchemaErrorCode(
      () => validate(schema, objectValue({})),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("materializes an absent optional object with required-only fields as absent", () => {
    const schema = parseSchema({
      kind: "object",
      fields: {
        x: { kind: "number", required: true },
        y: { kind: "number", required: true },
      },
    });

    expect(materializeDefault(schema)).toBeUndefined();
  });

  it("omits an absent optional object field whose children are required", () => {
    const schema = parseSchema({
      kind: "object",
      required: true,
      fields: {
        cursor: {
          kind: "object",
          fields: {
            x: { kind: "number", required: true },
            y: { kind: "number", required: true },
          },
        },
        name: { kind: "string", default: { kind: "string", value: "anon" } },
      },
    });

    expect(validate(schema, objectValue({}))).toEqual(objectValue({ name: stringValue("anon") }));
  });

  it("propagates required-field failures when the object itself is required", () => {
    expectSchemaErrorCode(
      () =>
        materializeDefault(
          parseSchema({
            kind: "object",
            required: true,
            fields: {
              x: { kind: "number", required: true },
            },
          }),
        ),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("throws for required objects with no defaultable fields", () => {
    expectSchemaErrorCode(
      () =>
        materializeDefault(
          parseSchema({
            kind: "object",
            required: true,
            fields: {
              title: { kind: "string" },
            },
          }),
        ),
      SchemaErrorCodes.MissingRequired,
    );
  });

  it("rejects invalid object field declarations during parse", () => {
    expectSchemaErrorCode(
      () => parseSchema({ kind: "object", fields: [] }),
      SchemaErrorCodes.InvalidSchema,
    );
  });
});
