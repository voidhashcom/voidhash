/**
 * Switches Community packages between a sibling Orbian workspace for local
 * development and immutable pr-package artifacts for standalone distribution.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceFile = path.join(repositoryRoot, "pnpm-workspace.yaml");
const lockFile = path.join(repositoryRoot, "pnpm-lock.yaml");
const packageOrigin = (process.env.ORBIAN_PACKAGE_ORIGIN ?? "https://pkg.voidha.sh").replace(
  /\/$/,
  "",
);
const packageProjects = new Map([
  ["@orbian/core", "orbian-core"],
  ["@orbian/sdk", "orbian-sdk"],
]);
const workspacePackages = [
  "../orbian/packages/core",
  "../orbian/packages/sdk",
];

const mode = process.argv[2];
if (mode !== "workspace" && !/^[0-9a-f]{40}$/.test(mode ?? "")) {
  console.error("Usage: pnpm orbian:source <workspace|full-commit-sha>");
  process.exit(1);
}

const packageFiles = [path.join(repositoryRoot, "package.json")];
for (const group of ["apps", "packages", "libraries", "examples", "selfhost"]) {
  const groupDirectory = path.join(repositoryRoot, group);
  for (const entry of fs.readdirSync(groupDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageFile = path.join(groupDirectory, entry.name, "package.json");
    if (fs.existsSync(packageFile)) packageFiles.push(packageFile);
  }
}

const packageUrl = (project) => `${packageOrigin}/${project}/${mode}`;

if (mode !== "workspace") {
  for (const project of packageProjects.values()) {
    const response = await fetch(packageUrl(project));
    if (!response.ok) {
      throw new Error(`Orbian package ${project}@${mode} is unavailable: ${response.status}`);
    }
    await response.body?.cancel();
  }
} else {
  for (const workspacePackage of workspacePackages) {
    if (!fs.existsSync(path.resolve(repositoryRoot, workspacePackage, "package.json"))) {
      throw new Error(`Orbian workspace package is unavailable: ${workspacePackage}`);
    }
  }
}

const mutableFiles = [...packageFiles, workspaceFile, lockFile];
const originals = new Map(
  mutableFiles.filter(fs.existsSync).map((file) => [file, fs.readFileSync(file, "utf8")]),
);

try {
  for (const packageFile of packageFiles) {
    const raw = fs.readFileSync(packageFile, "utf8");
    const manifest = JSON.parse(raw);
    let changed = false;
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const [packageName, project] of packageProjects) {
        if (!(packageName in (manifest[field] ?? {}))) continue;
        manifest[field][packageName] = mode === "workspace" ? "workspace:*" : packageUrl(project);
        changed = true;
      }
    }
    if (changed) {
      const indent = raw.match(/\n([ \t]+)"/)?.[1] ?? "  ";
      fs.writeFileSync(packageFile, `${JSON.stringify(manifest, null, indent)}\n`);
    }
  }

  const workspaceLines = fs
    .readFileSync(workspaceFile, "utf8")
    .split("\n")
    .filter((line) => !workspacePackages.includes(line.trim().replace(/^- /, "")));
  if (mode === "workspace") {
    const packagesIndex = workspaceLines.findIndex((line) => line.trim() === "packages:");
    workspaceLines.splice(
      packagesIndex + 1,
      0,
      ...workspacePackages.map((workspacePackage) => `  - ${workspacePackage}`),
    );
  }
  fs.writeFileSync(workspaceFile, workspaceLines.join("\n"));

  execFileSync(
    "corepack",
    [
      "pnpm@11.1.3",
      "install",
      "--lockfile-only",
      "--ignore-scripts",
      "--config.block-exotic-subdeps=false",
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );

  const remainingWorkspaceReferences = packageFiles.flatMap((packageFile) => {
    const manifest = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    return [
      ...Object.entries(manifest.dependencies ?? {}),
      ...Object.entries(manifest.devDependencies ?? {}),
      ...Object.entries(manifest.optionalDependencies ?? {}),
      ...Object.entries(manifest.peerDependencies ?? {}),
    ].filter(
      ([packageName, source]) =>
        packageProjects.has(packageName) &&
        (mode === "workspace" ? source !== "workspace:*" : source === "workspace:*"),
    );
  });
  if (remainingWorkspaceReferences.length > 0) {
    throw new Error("Orbian dependency source verification failed");
  }
  const updatedWorkspace = fs.readFileSync(workspaceFile, "utf8");
  const updatedLock = fs.readFileSync(lockFile, "utf8");
  if (
    mode === "workspace"
      ? workspacePackages.some((workspacePackage) => !updatedWorkspace.includes(workspacePackage))
      : workspacePackages.some(
          (workspacePackage) =>
            updatedWorkspace.includes(workspacePackage) || updatedLock.includes(workspacePackage),
        )
  ) {
    throw new Error("Orbian workspace boundary verification failed");
  }

  console.log(
    mode === "workspace"
      ? "Community packages now use the sibling Orbian workspace."
      : `Community packages now use immutable Orbian artifacts from ${mode}.`,
  );
} catch (cause) {
  for (const [file, contents] of originals) fs.writeFileSync(file, contents);
  throw cause;
}
