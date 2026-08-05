// Enforces the repository's test-tier layout.
//
//   *.integration.test.ts  needs the self-host stack; runs under `pnpm test:integration`
//   *.test.ts              needs nothing; runs under `pnpm test`
//
// The rule this exists to protect: a test's tier follows from its filename, and
// nothing else. Environment-flag gating (`FLAG === "1" ? describe : describe.skip`)
// used to decide it instead, so a forgotten flag made a suite report success
// without running — indistinguishable from a real pass. A test must either run
// or fail loudly because its prerequisites are missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skipDirectories = new Set(["node_modules", "dist", ".git", ".turbo", "build", ".next"]);

const walk = (directory, found = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) continue;
      walk(path.join(directory, entry.name), found);
    } else if (entry.name.endsWith(".test.ts")) {
      found.push(path.join(directory, entry.name));
    }
  }
  return found;
};

const failures = [];
const testFiles = walk(repoRoot);

// A `describe.skip` bound to an environment variable is the gating pattern.
// A literal `describe.skip("…")` on a specific case is an ordinary skipped
// test and stays allowed.
const gatingPattern = /process\.env\.[A-Z0-9_]+[^\n]*\?[^\n]*describe[^\n]*:\s*describe\.skip/;

for (const file of testFiles) {
  const relative = path.relative(repoRoot, file);
  const source = fs.readFileSync(file, "utf8");

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
    /process\.env\.(DATABASE_|CLICKHOUSE_|PLATFORM_|SELFHOST_|S3_|MIMIC_)[A-Z0-9_]*\s*(\?\?|\|\|)/.test(
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
const integrationDirectories = new Set(
  testFiles
    .filter((file) => file.endsWith(".integration.test.ts"))
    .map((file) => {
      let directory = path.dirname(file);
      while (directory !== repoRoot && !fs.existsSync(path.join(directory, "package.json"))) {
        directory = path.dirname(directory);
      }
      return directory;
    }),
);

for (const directory of integrationDirectories) {
  if (!fs.existsSync(path.join(directory, "vitest.integration.mts"))) {
    failures.push(
      `${path.relative(repoRoot, directory)}: has *.integration.test.ts files but no ` +
        `vitest.integration.mts, so \`pnpm test:integration\` cannot run them.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Test-tier violations:\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Test tiers OK (${testFiles.length} test files).`);
