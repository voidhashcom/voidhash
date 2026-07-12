#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const trackedSet = new Set(tracked);
const failures = [];

const requiredFiles = [
  "CONTRIBUTING.md",
  "CONTRIBUTOR_LICENSE_AGREEMENT.md",
  "LICENSE.md",
  "LICENSES/AGPL-3.0-only.txt",
  "LICENSES/MIT.txt",
  "SECURITY.md",
  "scripts/check-publication-boundary.mjs",
];
for (const path of requiredFiles) {
  if (!tracked.includes(path)) {
    failures.push(`required publication file is missing: ${path}`);
  }
}

const privateRoots = [
  "ee/",
  "internal/",
  "stacks/",
  "apps/overwatch/",
  "apps/overwatch-backend/",
  "packages/alchemy-vitest/",
  "packages/testing/",
];
for (const path of tracked) {
  if (privateRoots.some((prefix) => path.startsWith(prefix))) {
    failures.push(`private-only path is tracked in the OSS repository: ${path}`);
  }
  if (
    path.split("/").some((part) => part.startsWith(".env")) &&
    !path.endsWith(".env.example")
  ) {
    failures.push(`non-example environment file is tracked: ${path}`);
  }
}

const privateSpecifiers = ["@voidhash-mono", "@voidhash-internal"];
const sourceLike = /\.(?:[cm]?[jt]sx?|json|ya?ml)$/;
for (const path of tracked.filter(
  (path) => sourceLike.test(path) && path !== "scripts/check-publication-boundary.mjs",
)) {
  const source = readFileSync(join(repoRoot, path), "utf8");
  for (const specifier of privateSpecifiers) {
    if (source.includes(specifier)) {
      failures.push(`private package scope ${specifier} appears in ${path}`);
    }
  }
}

const forbiddenAdminPaths = [
  "packages/core/src/services/admin/",
  "packages/rpc/src/groups/admin/",
  "apps/backend/src/rpc/groups/admin/",
];
for (const path of tracked) {
  if (forbiddenAdminPaths.some((prefix) => path.startsWith(prefix))) {
    failures.push(`private operations-plane code appears in Community: ${path}`);
  }
}

const findPackageLicense = (packagePath) => {
  let current = resolve(repoRoot, dirname(packagePath));
  while (current !== repoRoot) {
    for (const name of ["LICENSE", "LICENSE.md"]) {
      const candidate = join(current, name);
      if (existsSync(candidate) && trackedSet.has(relative(repoRoot, candidate))) {
        return candidate;
      }
    }
    current = dirname(current);
  }
  return;
};

for (const packagePath of tracked.filter(
  (path) => path === "package.json" || path.endsWith("/package.json"),
)) {
  const manifest = JSON.parse(readFileSync(join(repoRoot, packagePath), "utf8"));
  if (packagePath === "package.json") {
    if (manifest.license !== "SEE LICENSE IN LICENSE.md") {
      failures.push("root package.json must point to LICENSE.md");
    }
    continue;
  }

  if (!manifest.name) {
    failures.push(`${packagePath} has no package name`);
  }
  if (privateSpecifiers.some((scope) => manifest.name?.startsWith(`${scope}/`))) {
    failures.push(`${packagePath} uses a private package scope: ${manifest.name}`);
  }
  if (!new Set(["MIT", "AGPL-3.0-only"]).has(manifest.license)) {
    failures.push(`${packagePath} has an invalid or missing license: ${manifest.license}`);
    continue;
  }

  const licensePath = findPackageLicense(packagePath);
  if (!licensePath) {
    failures.push(`${packagePath} has no package or package-zone license file`);
    continue;
  }
  const license = readFileSync(licensePath, "utf8");
  if (manifest.license === "MIT" && !license.includes("MIT License")) {
    failures.push(`${packagePath} does not resolve to the MIT license text`);
  }
  if (
    manifest.license === "AGPL-3.0-only" &&
    !license.includes("GNU AFFERO GENERAL PUBLIC LICENSE")
  ) {
    failures.push(`${packagePath} does not resolve to the AGPL-3.0 license text`);
  }
}

if (failures.length > 0) {
  process.stderr.write("Publication boundary check failed:\n\n");
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Publication boundary OK — ${tracked.length} tracked files and ${
    tracked.filter((path) => path === "package.json" || path.endsWith("/package.json"))
      .length - 1
  } workspace packages checked.\n`,
);
