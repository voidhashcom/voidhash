#!/usr/bin/env node
// Enforces the platform seam.
//
// Service packages under `packages/**` and `vendored/mimic/packages/**` are portable:
// they depend on the provider-neutral contracts in `@voidhash/platform` and never on a
// concrete adapter. Importing either concrete adapter from a package would pin portable
// code to a deployment and break the other composition.
//
// Compositions choose adapters, so `apps/**` may import them
// freely. Tests are also allowed to bind a concrete adapter — that is how a
// port is exercised against something real — but only as a devDependency, so
// the adapter never reaches a package's runtime dependency graph.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Console, Data, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { fileURLToPath } from "node:url";

const adapters = ["@voidhash/platform-cloudflare"];

const sourceLike = /\.[cm]?[jt]sx?$/;
const isTestFile = (path) =>
  path.split("/").includes("tests") ||
  /\.test\.[cm]?[jt]sx?$/.test(path) ||
  /(^|\/)vitest\./.test(path);
const adapterImports = adapters.map((adapter) => ({
  adapter,
  pattern: new RegExp(`["']${adapter}(?:/[^"']*)?["']`),
}));

const isPortablePackage = (path) =>
  path.startsWith("packages/") || path.startsWith("vendored/mimic/packages/");

// Only the runtime dependency map matters here; every other manifest field is
// irrelevant to the seam and is discarded by the decoder.
const Manifest = Schema.fromJsonString(
  Schema.Struct({
    dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
);
const decodeManifest = Schema.decodeEffect(Manifest);

class PlatformSeamViolation extends Data.TaggedError("PlatformSeamViolation") {}

/** Paths git knows about (tracked or untracked-but-not-ignored) that still exist on disk. */
const listRepositoryFiles = (repoRoot) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const listed = yield* Effect.scoped(
      Effect.gen(function* () {
        const git = yield* ChildProcess.make(
          "git",
          ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
          { cwd: repoRoot },
        );
        const stdout = yield* git.stdout.pipe(Stream.decodeText(), Stream.mkString);
        const exitCode = yield* git.exitCode;
        if (exitCode !== 0) {
          return yield* Effect.die(new Error(`git ls-files exited with ${exitCode}`));
        }
        return stdout;
      }),
    );

    const files = [];
    for (const candidate of listed.split("\0")) {
      if (candidate.length === 0) continue;
      if (yield* fs.exists(path.join(repoRoot, candidate))) files.push(candidate);
    }
    return files;
  });

const collectFailures = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tracked = yield* listRepositoryFiles(repoRoot);
  const failures = [];

  for (const candidate of tracked.filter(
    (entry) =>
      isPortablePackage(entry) &&
      sourceLike.test(entry) &&
      !isTestFile(entry) &&
      !entry.includes("/node_modules/"),
  )) {
    const source = yield* fs.readFileString(path.join(repoRoot, candidate), "utf8");
    for (const { adapter, pattern } of adapterImports) {
      if (pattern.test(source)) {
        failures.push(`${candidate} imports ${adapter}; depend on @voidhash/platform instead`);
      }
    }
  }

  for (const candidate of tracked.filter(
    (entry) => isPortablePackage(entry) && entry.endsWith("/package.json"),
  )) {
    const manifest = yield* decodeManifest(
      yield* fs.readFileString(path.join(repoRoot, candidate), "utf8"),
    );
    for (const adapter of adapters) {
      if (manifest.dependencies?.[adapter]) {
        failures.push(
          `${candidate} lists ${adapter} as a runtime dependency; tests may use it as a devDependency`,
        );
      }
    }
  }

  return failures;
});

const main = Effect.gen(function* () {
  const failures = yield* Effect.tapCause(collectFailures, (cause) =>
    Console.error(Cause.pretty(cause)),
  );

  if (failures.length === 0) {
    return yield* Console.log(
      "Platform seam OK — portable packages do not bind a concrete platform adapter.",
    );
  }

  yield* Console.error(
    ["Platform seam check failed:", "", ...failures.map((failure) => `- ${failure}`)].join("\n"),
  );
  // The report above is the whole diagnostic; the error only carries the
  // non-zero exit code, so `runMain` is asked not to print it again.
  return yield* new PlatformSeamViolation();
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main, { disableErrorReporting: true });
