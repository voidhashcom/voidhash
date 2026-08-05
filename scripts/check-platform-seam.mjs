#!/usr/bin/env node
// Enforces the platform seam.
//
// Service packages under `packages/**` are portable: they depend on the
// provider-neutral contracts in `@voidhash/platform` and never on a concrete
// adapter. `@voidhash/platform-selfhost` is one such adapter, so importing it
// from a package would pin portable code to the Node/PostgreSQL deployment and
// break the Cloud composition that binds different implementations.
//
// Compositions choose adapters, so `apps/**` and `selfhost/**` may import it
// freely. Tests are also allowed to bind a concrete adapter — that is how a
// port is exercised against something real — but only as a devDependency, so
// the adapter never reaches a package's runtime dependency graph.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adapter = "@voidhash/platform-selfhost";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter((path) => path.length > 0 && existsSync(join(repoRoot, path)));

const failures = [];
const sourceLike = /\.[cm]?[jt]sx?$/;
const isTestFile = (path) =>
  path.split("/").includes("tests") ||
  /\.test\.[cm]?[jt]sx?$/.test(path) ||
  /(^|\/)vitest\./.test(path);
const importsAdapter = new RegExp(`["']${adapter}(?:/[^"']*)?["']`);

for (const path of tracked.filter(
  (path) =>
    path.startsWith("packages/") &&
    sourceLike.test(path) &&
    !isTestFile(path) &&
    !path.includes("/node_modules/"),
)) {
  if (importsAdapter.test(readFileSync(join(repoRoot, path), "utf8"))) {
    failures.push(`${path} imports ${adapter}; depend on @voidhash/platform instead`);
  }
}

for (const path of tracked.filter(
  (path) => path.startsWith("packages/") && path.endsWith("/package.json"),
)) {
  const manifest = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  if (manifest.dependencies?.[adapter]) {
    failures.push(
      `${path} lists ${adapter} as a runtime dependency; tests may use it as a devDependency`,
    );
  }
}

if (failures.length > 0) {
  process.stderr.write("Platform seam check failed:\n\n");
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Platform seam OK — no package outside apps/ and selfhost/ binds ${adapter}.\n`,
);
