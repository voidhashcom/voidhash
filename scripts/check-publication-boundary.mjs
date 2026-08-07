#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { fileURLToPath } from "node:url";

class PublicationBoundaryError extends Data.TaggedError("PublicationBoundaryError") {}

const PackageManifest = Schema.Struct({
  name: Schema.optional(Schema.String),
  license: Schema.optional(Schema.String),
});

const decodePackageManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(PackageManifest));

const requiredFiles = [
  "CONTRIBUTING.md",
  "CONTRIBUTOR_LICENSE_AGREEMENT.md",
  "LICENSE.md",
  "LICENSES/AGPL-3.0-only.txt",
  "LICENSES/MIT.txt",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/licensing-and-self-hosting-faq.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/pull_request_template.md",
  "scripts/check-publication-boundary.mjs",
];

const privateRoots = [
  "ee/",
  "internal/",
  "stacks/",
  "apps/overwatch/",
  "apps/overwatch-backend/",
  "packages/alchemy-vitest/",
  "packages/testing/",
];

const privateSpecifiers = ["@voidhash-mono", "@voidhash-internal"];
const sourceLike = /\.(?:[cm]?[jt]sx?|json|ya?ml)$/;

const forbiddenAdminPaths = [
  "packages/core/src/services/admin/",
  "packages/rpc/src/groups/admin/",
  "packages/backend/src/rpc/groups/admin/",
];

const isPackageManifest = (path) => path === "package.json" || path.endsWith("/package.json");

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const repoRoot = paths.resolve(paths.dirname(fileURLToPath(import.meta.url)), "..");
  const listed = yield* spawner.string(
    ChildProcess.make("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: repoRoot,
    }),
  );

  const tracked = [];
  for (const path of listed.split("\0")) {
    if (path.length === 0) continue;
    if (yield* fs.exists(paths.join(repoRoot, path))) {
      tracked.push(path);
    }
  }
  const trackedSet = new Set(tracked);
  const failures = [];

  for (const path of requiredFiles) {
    if (!tracked.includes(path)) {
      failures.push(`required publication file is missing: ${path}`);
    }
  }

  for (const path of tracked) {
    if (privateRoots.some((prefix) => path.startsWith(prefix))) {
      failures.push(`private-only path is tracked in the OSS repository: ${path}`);
    }
    if (path.split("/").some((part) => part.startsWith(".env")) && !path.endsWith(".env.example")) {
      failures.push(`non-example environment file is tracked: ${path}`);
    }
  }

  for (const path of tracked.filter(
    (path) => sourceLike.test(path) && path !== "scripts/check-publication-boundary.mjs",
  )) {
    const source = yield* fs.readFileString(paths.join(repoRoot, path));
    for (const specifier of privateSpecifiers) {
      if (source.includes(specifier)) {
        failures.push(`private package scope ${specifier} appears in ${path}`);
      }
    }
  }

  for (const path of tracked) {
    if (forbiddenAdminPaths.some((prefix) => path.startsWith(prefix))) {
      failures.push(`private operations-plane code appears in Community: ${path}`);
    }
  }

  const findPackageLicense = (packagePath) =>
    Effect.gen(function* () {
      let current = paths.resolve(repoRoot, paths.dirname(packagePath));
      while (current !== repoRoot) {
        for (const name of ["LICENSE", "LICENSE.md"]) {
          const candidate = paths.join(current, name);
          const exists = yield* fs.exists(candidate);
          if (exists && trackedSet.has(paths.relative(repoRoot, candidate))) {
            return candidate;
          }
        }
        current = paths.dirname(current);
      }
      return undefined;
    });

  for (const packagePath of tracked.filter(isPackageManifest)) {
    const manifest = yield* decodePackageManifest(
      yield* fs.readFileString(paths.join(repoRoot, packagePath)),
    );
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

    const licensePath = yield* findPackageLicense(packagePath);
    if (!licensePath) {
      failures.push(`${packagePath} has no package or package-zone license file`);
      continue;
    }
    const license = yield* fs.readFileString(licensePath);
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
    yield* Console.error("Publication boundary check failed:\n");
    for (const failure of failures) {
      yield* Console.error(`- ${failure}`);
    }
    return yield* new PublicationBoundaryError({
      message: `publication boundary check found ${failures.length} problems`,
    });
  }

  yield* Console.log(
    `Publication boundary OK — ${tracked.length} tracked files and ${
      tracked.filter(isPackageManifest).length - 1
    } workspace packages checked.`,
  );
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
