// Enforces the repository's test-tier layout.
//
//   *.integration.test.ts  needs the integration fixture; runs under `pnpm test:integration`
//   *.test.ts              needs nothing; runs under `pnpm test`
//
// The rule this exists to protect: a test's tier follows from its filename, and
// nothing else. Environment-flag gating (`FLAG === "1" ? describe : describe.skip`)
// used to decide it instead, so a forgotten flag made a suite report success
// without running — indistinguishable from a real pass. A test must either run
// or fail loudly because its prerequisites are missing.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Path } from "effect";

import { integrationSuites } from "./integration-suites.mjs";

const skipDirectories = new Set(["node_modules", "dist", ".git", ".turbo", "build", ".next"]);

// A `describe.skip` bound to an environment variable is the gating pattern.
// A literal `describe.skip("…")` on a specific case is an ordinary skipped
// test and stays allowed.
const gatingPattern = /process\.env\.[A-Z0-9_]+[^\n]*\?[^\n]*describe[^\n]*:\s*describe\.skip/;

/** Raised when any test file sits in the wrong tier; exits the script non-zero. */
class TestTierError extends Data.TaggedError("TestTierError") {}

const walk = (directory) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const found = [];

    for (const entry of yield* fileSystem.readDirectory(directory)) {
      if (skipDirectories.has(entry)) continue;

      const entryPath = path.join(directory, entry);
      // A dangling symlink cannot be stat'd. It holds no test files either way,
      // so it is treated as an ordinary (non-directory) entry.
      const isDirectory = yield* fileSystem.stat(entryPath).pipe(
        Effect.map((info) => info.type === "Directory"),
        Effect.orElseSucceed(() => false),
      );
      if (isDirectory) {
        found.push(...(yield* walk(entryPath)));
      } else if (entry.endsWith(".test.ts")) {
        found.push(entryPath);
      }
    }

    return found;
  });

// Resolves the package directory owning a test file: the nearest ancestor with
// a package.json, stopping at the repo root.
const packageDirectoryOf = (file, repoRoot) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    let directory = path.dirname(file);
    while (
      directory !== repoRoot &&
      !(yield* fileSystem.exists(path.join(directory, "package.json")))
    ) {
      directory = path.dirname(directory);
    }
    return directory;
  });

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const scriptPath = yield* path.fromFileUrl(new URL(import.meta.url));
  const repoRoot = path.resolve(path.dirname(scriptPath), "..");

  const failures = [];
  const testFiles = yield* walk(repoRoot);

  for (const file of testFiles) {
    const relative = path.relative(repoRoot, file);
    const source = yield* fileSystem.readFileString(file);

    if (gatingPattern.test(source)) {
      failures.push(
        `${relative}: gates a suite on an environment variable. Name the file ` +
          `*.integration.test.ts and let the integration tier provide its stack.`,
      );
    }

    // Reading a connection setting *as a value* (`process.env.X ?? "…"`) means the
    // file talks to the stack. Assigning or deleting one is how config-parsing
    // unit tests set up their fixtures, and stays in the unit tier.
    const isIntegration = file.endsWith(".integration.test.ts");
    const usesStack =
      /process\.env\.(DATABASE_|PLATFORM_|SELFHOST_|S3_|MIMIC_)[A-Z0-9_]*\s*(\?\?|\|\|)/.test(
        source,
      );
    if (!isIntegration && usesStack) {
      failures.push(
        `${relative}: reads stack connection settings but is not named ` +
          `*.integration.test.ts, so it runs in the unit tier without a stack.`,
      );
    }
  }

  // Every package holding integration tests needs the config the runner invokes.
  const integrationDirectories = new Set();
  for (const file of testFiles) {
    if (!file.endsWith(".integration.test.ts")) continue;
    integrationDirectories.add(yield* packageDirectoryOf(file, repoRoot));
  }

  // …and needs to be registered with the runner: a package with a valid config
  // that is missing from the suite list would pass every check here and still
  // never run.
  const registeredDirectories = new Set(
    integrationSuites.map((suite) => path.resolve(repoRoot, suite.directory)),
  );

  for (const directory of integrationDirectories) {
    if (!(yield* fileSystem.exists(path.join(directory, "vitest.integration.mts")))) {
      failures.push(
        `${path.relative(repoRoot, directory)}: has *.integration.test.ts files but no ` +
          `vitest.integration.mts, so \`pnpm test:integration\` cannot run them.`,
      );
    }
    if (!registeredDirectories.has(directory)) {
      failures.push(
        `${path.relative(repoRoot, directory)}: has *.integration.test.ts files but is not ` +
          `registered in scripts/integration-suites.mjs, so \`pnpm test:integration\` never runs it.`,
      );
    }
  }

  if (failures.length > 0) {
    const report = failures.map((failure) => `  - ${failure}`).join("\n");
    yield* Console.error(`Test-tier violations:\n\n${report}`);
    return yield* new TestTierError();
  }

  yield* Console.log(`Test tiers OK (${testFiles.length} test files).`);
});

// Error reporting stays off so a failed check prints only the violation list above,
// and `runMain` still exits non-zero on the tagged failure.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)), {
  disableErrorReporting: true,
});
