import { describe, expect, it } from "vitest";
import {
  ErrorCodes,
  HiddenTreeRootId,
  SchemaErrorCodes,
  booleanValue,
  objectValue,
  parseSchema,
  serializeSchema,
  stringValue,
  treeValue,
  validate,
} from "../../src/index.js";
import { expectCoreErrorCode, expectSchemaErrorCode } from "./helpers.js";

describe("schema tree model", () => {
  const createSchema = () =>
    parseSchema({
      kind: "tree",
      discriminator: "type",
      roots: ["board"],
      variants: {
        board: {
          schema: {
            kind: "object",
            fields: {
              type: { kind: "literal", value: "board" },
              name: { kind: "string" },
            },
          },
          children: ["card"],
        },
        card: {
          schema: {
            kind: "object",
            fields: {
              type: { kind: "literal", value: "card" },
              title: { kind: "string" },
              done: { kind: "boolean", default: { kind: "boolean", value: false } },
            },
          },
          children: [],
        },
      },
    });

  it("parses and serializes tree schemas", () => {
    expect(serializeSchema(createSchema())).toEqual({
      kind: "tree",
      discriminator: "type",
      roots: ["board"],
      variants: {
        board: {
          schema: {
            kind: "object",
            fields: {
              type: { kind: "literal", value: "board" },
              name: { kind: "string" },
            },
          },
          children: ["card"],
        },
        card: {
          schema: {
            kind: "object",
            fields: {
              type: { kind: "literal", value: "card" },
              title: { kind: "string" },
              done: { kind: "boolean", default: { kind: "boolean", value: false } },
            },
          },
          children: [],
        },
      },
    });
  });

  it("sanitizes tree node values and enforces parent-child typing", () => {
    expect(
      validate(
        createSchema(),
        treeValue([
          {
            id: "n1",
            parent: HiddenTreeRootId,
            pos: "a0",
            value: objectValue({
              type: stringValue("board"),
              name: stringValue("Board"),
            }),
          },
          {
            id: "n2",
            parent: "n1",
            pos: "a0",
            value: objectValue({
              type: stringValue("card"),
              title: stringValue("Card"),
              extra: stringValue("remove"),
            }),
          },
        ]),
      ),
    ).toEqual(
      treeValue([
        {
          id: "n1",
          parent: HiddenTreeRootId,
          pos: "a0",
          value: objectValue({
            type: stringValue("board"),
            name: stringValue("Board"),
          }),
        },
        {
          id: "n2",
          parent: "n1",
          pos: "a0",
          value: objectValue({
            type: stringValue("card"),
            title: stringValue("Card"),
            done: booleanValue(false),
          }),
        },
      ]),
    );
  });

  it("rejects missing or unknown node variants", () => {
    const schema = createSchema();

    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          treeValue([
            {
              id: "n1",
              parent: HiddenTreeRootId,
              pos: "a0",
              value: objectValue({}),
            },
          ]),
        ),
      SchemaErrorCodes.TreeUnknownVariant,
    );

    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          treeValue([
            {
              id: "n1",
              parent: HiddenTreeRootId,
              pos: "a0",
              value: objectValue({
                type: stringValue("unknown"),
              }),
            },
          ]),
        ),
      SchemaErrorCodes.TreeUnknownVariant,
    );
  });

  it("rejects invalid root and child types", () => {
    const schema = createSchema();

    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          treeValue([
            {
              id: "n1",
              parent: HiddenTreeRootId,
              pos: "a0",
              value: objectValue({
                type: stringValue("card"),
                title: stringValue("Card"),
              }),
            },
          ]),
        ),
      SchemaErrorCodes.TreeInvalidRootType,
    );

    expectSchemaErrorCode(
      () =>
        validate(
          schema,
          treeValue([
            {
              id: "n1",
              parent: HiddenTreeRootId,
              pos: "a0",
              value: objectValue({
                type: stringValue("board"),
                name: stringValue("Board"),
              }),
            },
            {
              id: "n2",
              parent: "n1",
              pos: "a0",
              value: objectValue({
                type: stringValue("board"),
                name: stringValue("Nested board"),
              }),
            },
          ]),
        ),
      SchemaErrorCodes.TreeInvalidChildType,
    );
  });

  it("rejects invalid tree variant declarations during parse", () => {
    expectSchemaErrorCode(
      () =>
        parseSchema({
          kind: "tree",
          discriminator: "type",
          roots: ["board"],
          variants: {
            board: {
              schema: {
                kind: "object",
                fields: {
                  type: { kind: "string" },
                },
              },
              children: [],
            },
          },
        }),
      SchemaErrorCodes.InvalidSchema,
    );
  });

  it("still surfaces core structural tree errors before schema validation", () => {
    expectCoreErrorCode(
      () =>
        validate(createSchema(), {
          kind: "tree",
          nodes: [
            {
              id: "n1",
              parent: "missing",
              pos: "a0",
              value: objectValue({
                type: stringValue("board"),
                name: stringValue("Board"),
              }),
            },
          ],
        }),
      ErrorCodes.InvalidTreeParent,
    );
  });
});
