import { afterEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { HostServiceTag } from "../src/app/hostService.js";
import { LocalHostServiceDefault } from "../src/core/local-host-service.js";
import { MigrationBundler } from "../../mimic-cli/src/services/MigrationBundler.js";
import { MigrationLoader } from "../../mimic-cli/src/services/MigrationLoader.js";

const originalCwd = process.cwd();
const cliIndexPath = path.resolve(
  import.meta.dirname,
  "../../mimic-cli/src/index.ts",
);

afterEach(() => {
  process.chdir(originalCwd);
});

describe("mimic-cli integration with mimic-db", () => {
  it("compiles execute migrations that mimic-db can apply atomically", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mimic-cli-integration-"));
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
        path.join(cwd, "migrations/00001_create.ts"),
        `import mimicConfig from "../mimic.config";
import { m } from ${JSON.stringify(cliIndexPath)};

const Todo = m.Struct({
  title: m.String().required(),
});

export default mimicConfig.defineMigrations((migration) => [
  migration.create({
    collection: "todos",
    schema: Todo,
  }),
]);
`,
      );
      fs.writeFileSync(
        path.join(cwd, "migrations/00002_add-slug.ts"),
        `import mimicConfig from "../mimic.config";
import { m } from ${JSON.stringify(cliIndexPath)};

const OldTodo = m.Struct({
  title: m.String().required(),
});

const Todo = m.Struct({
  title: m.String().required(),
  slug: m.String().required(),
});

export default mimicConfig.defineMigrations((migration) => [
  migration.update({
    collection: "todos",
    oldSchema: OldTodo,
    schema: Todo,
    execute: (ctx) => {
      const title = ctx.oldRoot.title.get();
      if (title) {
        ctx.root.update({
          title,
          slug: title.toLowerCase().replace(/\\s+/g, "-"),
        });
      }
    },
  }),
]);
`,
      );

      const program = Effect.gen(function* () {
        const loader = yield* MigrationLoader;
        const host = yield* HostServiceTag;
        const migrations = yield* loader.load();
        const database = yield* host.createDatabase("todos", "");

        yield* host.applyMigration(
          database.id,
          migrations[0]!.version,
          migrations[0]!.name,
          migrations[0]!.checksum,
          migrations[0]!.changes,
        );

        const collectionsAfterCreate = yield* host.listCollections(database.id);
        const collection = collectionsAfterCreate[0]!;
        const document = yield* host.createDocument(collection.id, "doc-1", {
          kind: "object",
          fields: {
            title: {
              kind: "string",
              value: "Write Tests",
            },
          },
        });

        yield* host.applyMigration(
          database.id,
          migrations[1]!.version,
          migrations[1]!.name,
          migrations[1]!.checksum,
          migrations[1]!.changes,
        );

        const collectionsAfterUpdate = yield* host.listCollections(database.id);
        expect(collectionsAfterUpdate[0]?.schemaVersion).toBe(2);

        const updated = yield* host.getDocument(collection.id, document.id);
        expect(updated.value).toEqual({
          kind: "object",
          fields: {
            title: {
              kind: "string",
              value: "Write Tests",
            },
            slug: {
              kind: "string",
              value: "write-tests",
            },
          },
        });

        const applied = yield* host.listMigrations(database.id);
        expect(applied.map((entry) => entry.version)).toEqual([1, 2]);
      }).pipe(
        Effect.provide(MigrationLoader.Default),
        Effect.provide(MigrationBundler.Default),
        Effect.provide(LocalHostServiceDefault),
      );

      await Effect.runPromise(program as any);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
