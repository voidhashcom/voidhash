import { describe, expect, it } from "vitest";

import { Primitive } from "@voidhash/mimic-core";

import { analyzeMigration } from "../../../src/migrate/index.js";

describe("migration analyze", () => {
  it("allows adding a required field when the new schema provides a default", () => {
    const oldSchema = Primitive.Struct({
      title: Primitive.String().required(),
    }).schema;
    const newSchema = Primitive.Struct({
      title: Primitive.String().required(),
      done: Primitive.Boolean().required().default(false),
    }).schema;

    expect(analyzeMigration({ oldSchema, newSchema })).toEqual([]);
  });

  it("rejects adding a required field without a default", () => {
    const oldSchema = Primitive.Struct({
      title: Primitive.String().required(),
    }).schema;
    const newSchema = Primitive.Struct({
      title: Primitive.String().required(),
      slug: Primitive.String().required(),
    }).schema;

    expect(analyzeMigration({ oldSchema, newSchema })).toEqual([
      {
        code: "required-field-without-default",
        path: "root.slug",
        message: 'Field "slug" is required in the new schema but has no default',
      },
    ]);
  });

  it("flags incompatible literal discriminator changes", () => {
    const oldSchema = Primitive.Struct({
      type: Primitive.Literal("todo").required(),
      title: Primitive.String().required(),
    }).schema;
    const newSchema = Primitive.Struct({
      type: Primitive.Literal("card").required(),
      title: Primitive.String().required(),
    }).schema;

    expect(analyzeMigration({ oldSchema, newSchema })).toEqual([
      {
        code: "incompatible-type",
        path: "root.type",
        message: 'Literal changed from "todo" to "card"',
      },
    ]);
  });
});
