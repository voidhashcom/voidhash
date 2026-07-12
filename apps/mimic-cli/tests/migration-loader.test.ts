import { afterEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { MigrationBundler } from "../src/services/MigrationBundler.js";
import { MigrationLoader } from "../src/services/MigrationLoader.js";

const originalCwd = process.cwd();
const cliIndexPath = path.resolve(import.meta.dirname, "../src/index.ts");

afterEach(() => {
  process.chdir(originalCwd);
});

describe("MigrationLoader", () => {
  it("serializes primitive schemas and bundles execute migrations", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mimic-cli-loader-"));
    process.chdir(cwd);

    try {
      fs.writeFileSync(
        path.join(cwd, "mimic.config.ts"),
        `import { defineConfig } from ${JSON.stringify(cliIndexPath)};

export default defineConfig({
  url: "http://localhost:3000",
  username: "root",
  password: "secret",
  database: "todos",
});
`,
      );
      fs.mkdirSync(path.join(cwd, "migrations"), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, "migrations/00001_todos.ts"),
        `import mimicConfig from "../mimic.config";
import { m } from ${JSON.stringify(cliIndexPath)};

const OldTodo = m.Struct({
  title: m.String().required(),
});

const NewTodo = m.Struct({
  title: m.String().required(),
  slug: m.String().required(),
});

export default mimicConfig.defineMigrations((migration) => [
  migration.create({
    collection: "todos",
    schema: OldTodo,
  }),
  migration.update({
    collection: "todos",
    oldSchema: OldTodo,
    schema: NewTodo,
    execute: (ctx) => {
      const title = ctx.oldRoot.title.get();
      if (title) {
        ctx.root.slug.set(title.toLowerCase());
      }
    },
  }),
]);
`,
      );

      const migrations = await Effect.runPromise(
        Effect.gen(function* () {
          const loader = yield* MigrationLoader;
          return yield* loader.load();
        }).pipe(Effect.provide(MigrationLoader.Default), Effect.provide(MigrationBundler.Default)),
      );

      expect(migrations).toHaveLength(1);
      expect(migrations[0]?.changes).toHaveLength(2);
      const updateChange = migrations[0]?.changes[1];
      expect(migrations[0]?.changes[0]).toEqual({
        type: "create",
        collection: "todos",
        schema: {
          kind: "object",
          fields: {
            title: {
              kind: "string",
              required: true,
            },
          },
        },
      });
      expect(updateChange).toMatchObject({
        type: "update",
        collection: "todos",
        oldSchema: {
          kind: "object",
          fields: {
            title: {
              kind: "string",
              required: true,
            },
          },
        },
        schema: {
          kind: "object",
          fields: {
            title: {
              kind: "string",
              required: true,
            },
            slug: {
              kind: "string",
              required: true,
            },
          },
        },
      });
      expect(updateChange?.type).toBe("update");
      if (updateChange?.type === "update") {
        expect(typeof updateChange.dataMigrationSource).toBe("string");
        expect(updateChange.dataMigrationSource).toContain("__MIMIC_RUN_MIGRATION__");
      }
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
