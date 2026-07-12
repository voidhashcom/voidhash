import { afterEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ConfigLoader } from "../src/services/ConfigLoader.js";

const originalCwd = process.cwd();
const cliIndexPath = path.resolve(import.meta.dirname, "../src/index.ts");

const withTempCwd = async (fn: (cwd: string) => Promise<void>) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mimic-cli-config-"));
  process.chdir(cwd);
  try {
    await fn(cwd);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
};

afterEach(() => {
  process.chdir(originalCwd);
});

describe("ConfigLoader", () => {
  it("loads .env before evaluating mimic.config.ts", async () => {
    await withTempCwd(async (cwd) => {
      fs.writeFileSync(
        path.join(cwd, ".env"),
        "MIMIC_URL=http://localhost:3000\nMIMIC_USERNAME=root\nMIMIC_PASSWORD=secret\n",
      );
      fs.writeFileSync(
        path.join(cwd, "mimic.config.ts"),
        `import { defineConfig, env } from ${JSON.stringify(cliIndexPath)};

export default defineConfig({
  url: env.MIMIC_URL,
  username: env.MIMIC_USERNAME,
  password: env.MIMIC_PASSWORD,
  database: "todos",
});
`,
      );

      const config = await Effect.runPromise(
        Effect.gen(function* () {
          const loader = yield* ConfigLoader;
          return yield* loader.load();
        }).pipe(Effect.provide(ConfigLoader.Default)),
      );

      expect(config).toEqual({
        url: "http://localhost:3000",
        username: "root",
        password: "secret",
        database: "todos",
      });
    });
  });
});
