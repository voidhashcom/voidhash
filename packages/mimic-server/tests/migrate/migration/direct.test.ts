import { Primitive } from "@voidhash/mimic-core";
import { describe, expect, it } from "vitest";

import {
  defineMigration,
  defineMigrationRegistry,
  runDirectMigration,
} from "../../../src/migrate/index.ts";

const Original = Primitive.Struct({
  title: Primitive.String().required(),
});

const WithSlug = Primitive.Struct({
  title: Primitive.String().required(),
  slug: Primitive.String().required(),
});

const WithSlugAndCount = Primitive.Struct({
  title: Primitive.String().required(),
  slug: Primitive.String().required(),
  count: Primitive.Number().required(),
});

const addSlug = defineMigration({
  version: 1,
  name: "add-slug",
  from: Original,
  to: WithSlug,
  migrate: ({ oldRoot, root }) => {
    const title = oldRoot.title.get();
    root.update({ title, slug: title.toLowerCase().replaceAll(" ", "-") });
  },
});

const addCount = defineMigration({
  version: 2,
  name: "add-count",
  from: WithSlug,
  to: WithSlugAndCount,
  migrate: ({ oldRoot, root }) =>
    root.update({
      title: oldRoot.title.get(),
      slug: oldRoot.slug.get(),
      count: 1,
    }),
});

describe("direct migrations", () => {
  it("runs a typed migration without mutating the input", () => {
    const input = Original.encode({ title: "Write Tests" });
    const output = runDirectMigration(addSlug, input);

    expect(WithSlug.decode(output)).toEqual({ title: "Write Tests", slug: "write-tests" });
    expect(Original.decode(input)).toEqual({ title: "Write Tests" });
  });

  it("rejects writes through oldRoot", () => {
    const invalid = defineMigration({
      version: 1,
      name: "invalid",
      from: Original,
      to: Original,
      migrate: ({ oldRoot }) => oldRoot.update({ title: "changed" }),
    });

    expect(() => runDirectMigration(invalid, Original.encode({ title: "Original" }))).toThrow(
      "oldRoot is read-only",
    );
  });

  it("runs an ordered multi-step registry", () => {
    const registry = defineMigrationRegistry([
      {
        database: "example",
        collection: "documents",
        baseline: Original,
        migrations: [addSlug, addCount],
      },
    ]);

    const value = registry.collections[0]!.migrations.reduce(
      (current, migration) => runDirectMigration(migration, current),
      Original.encode({ title: "Hello" }),
    );

    expect(WithSlugAndCount.decode(value)).toEqual({
      title: "Hello",
      slug: "hello",
      count: 1,
    });
  });

  it("rejects a result that does not satisfy the target primitive", () => {
    const invalid = defineMigration({
      version: 1,
      name: "missing-required-field",
      from: Original,
      to: WithSlug,
    });

    expect(() => runDirectMigration(invalid, Original.encode({ title: "Hello" }))).toThrow();
  });

  it("validates contiguous versions and adjacent schemas", () => {
    expect(() =>
      defineMigrationRegistry([
        {
          database: "example",
          collection: "documents",
          baseline: Original,
          migrations: [{ ...addSlug, version: 2 }],
        },
      ]),
    ).toThrow("Expected migration version 1");

    expect(() =>
      defineMigrationRegistry([
        {
          database: "example",
          collection: "documents",
          baseline: WithSlug,
          migrations: [addSlug],
        },
      ]),
    ).toThrow("does not start from the previous schema");

    expect(() =>
      defineMigrationRegistry([
        {
          database: "example",
          collection: "documents",
          baseline: Original,
          migrations: [],
        },
        {
          database: "example",
          collection: "documents",
          baseline: Original,
          migrations: [],
        },
      ]),
    ).toThrow("Duplicate migration collection");
  });
});
