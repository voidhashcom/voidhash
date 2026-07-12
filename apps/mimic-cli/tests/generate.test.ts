import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const cliEntry = path.join(appRoot, "src/cli/index.ts");
// Under `nodeLinker: hoisted` the tsx bin lives at the workspace root rather than the
// package-local node_modules; probe both, then fall back to PATH resolution.
const tsxBin =
  [
    path.join(appRoot, "node_modules/.bin/tsx"),
    path.join(appRoot, "../../node_modules/.bin/tsx"),
  ].find((candidate) => fs.existsSync(candidate)) ?? "tsx";
const originalCwd = process.cwd();

const runGenerate = (cwd: string, name: string): void => {
  execFileSync(tsxBin, [cliEntry, "generate", name], {
    cwd,
    stdio: "pipe",
  });
};

afterEach(() => {
  process.chdir(originalCwd);
});

describe("mimic generate", () => {
  it(
    "creates the next zero-padded migration file",
    () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mimic-cli-generate-"));
      try {
        fs.mkdirSync(path.join(cwd, "migrations"), { recursive: true });
        fs.writeFileSync(path.join(cwd, "migrations/00001_initial.ts"), "");

        runGenerate(cwd, "Add slug");

        const created = path.join(cwd, "migrations/00002_add-slug.ts");
        expect(fs.existsSync(created)).toBe(true);
        expect(fs.readFileSync(created, "utf8")).toContain(
          "export default mimicConfig.defineMigrations((migration) => [",
        );
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
