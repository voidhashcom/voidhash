// Runs every integration-capable suite against the local self-host stack.
//
//   node scripts/run-local-integration.mjs [suite ...]
//
// Reads `.env` at the repo root (falling back to `.env.example` defaults),
// derives host-side connection settings from the stack's values (container
// hostnames become 127.0.0.1 plus the published port), and runs the suites
// sequentially. Sequential matters: the suites share one Postgres and one
// ClickHouse, and parallel runs would race on schema setup.
//
// Suites read and write the deployment's application tables, but the clusters
// they build get an isolated database of their own — see `resetPlatformDatabase`
// below.
//
// The stack is the only prerequisite, and the runner starts it if it is down.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const parseEnvFile = (filePath) => {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return values;
};

const envFile = path.join(repoRoot, ".env");
const envExample = path.join(repoRoot, ".env.example");

// A first checkout has no `.env`, which is a setup step to forget rather than a
// decision to make: the example holds the same defaults the suites assume.
if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log("Created .env from .env.example.");
}

const stackEnv = parseEnvFile(envFile);
const value = (key, fallback) => process.env[key] ?? stackEnv[key] ?? fallback;

const databasePort = value("DATABASE_HOST_PORT", "5432");
const databaseUsername = value("DATABASE_USERNAME", "voidhash");
const databasePassword = value("DATABASE_PASSWORD", "password");
const databaseName = value("DATABASE_NAME", "voidhash");
const clickhousePort = value("CLICKHOUSE_HTTP_PORT", "8123");
const minioPort = value("MINIO_API_PORT", "9000");
const mailpitSmtpPort = value("MAILPIT_SMTP_PORT", "1025");
const mailpitUiPort = value("MAILPIT_UI_PORT", "8025");
const compilerPort = value("COMPILER_HOST_PORT", "5002");

// Several suites build their own single-node cluster, and a single-node cluster
// claims *every* shard in the database it is built over. Sharing the running
// deployment's database would make the two runners steal each other's messages,
// which surfaces as `Could not find entity manager for address, retrying` in the
// app log and as timeouts in the suite. Platform state therefore gets a database
// of its own; application tables stay where the deployment keeps them.
const platformDatabaseName = `${databaseName}_platform_test`;

const testEnv = {
  ...process.env,

  SELFHOST_MODE: "local-evaluation",
  DATABASE_HOST: "127.0.0.1",
  DATABASE_PORT: databasePort,
  DATABASE_USERNAME: databaseUsername,
  DATABASE_PASSWORD: databasePassword,
  DATABASE_NAME: databaseName,
  DATABASE_SSL: "false",

  // Only the name differs; host, port, and credentials fall back to DATABASE_*.
  DATABASE_PLATFORM_NAME: platformDatabaseName,

  // The stack's CLICKHOUSE_URL names the compose-internal hostname; tests run
  // on the host and reach the published port instead.
  CLICKHOUSE_URL: `http://127.0.0.1:${clickhousePort}`,
  CLICKHOUSE_DATABASE: value("CLICKHOUSE_DATABASE", "voidhash"),
  CLICKHOUSE_ADMIN_USERNAME: value("CLICKHOUSE_ADMIN_USERNAME", "voidhash_admin"),
  CLICKHOUSE_ADMIN_PASSWORD: value("CLICKHOUSE_ADMIN_PASSWORD", "password"),
  CLICKHOUSE_USERNAME: value("CLICKHOUSE_USERNAME", "voidhash_app"),
  CLICKHOUSE_PASSWORD: value("CLICKHOUSE_PASSWORD", "password"),
  CLICKHOUSE_RO_USERNAME: value("CLICKHOUSE_RO_USERNAME", "voidhash_ro"),
  CLICKHOUSE_RO_PASSWORD: value("CLICKHOUSE_RO_PASSWORD", "password"),
  CLICKHOUSE_ANALYTICS_QUERY_USERNAME: value("CLICKHOUSE_ANALYTICS_QUERY_USERNAME", "voidhash_query"),
  CLICKHOUSE_ANALYTICS_QUERY_PASSWORD: value("CLICKHOUSE_ANALYTICS_QUERY_PASSWORD", "password"),

  ROOT_USERNAME: value("MIMIC_ROOT_USERNAME", "root"),
  ROOT_PASSWORD: value("MIMIC_ROOT_PASSWORD", "password"),

  SELFHOST_COMPILER_URL: `http://127.0.0.1:${compilerPort}`,

  // The backend app suite's mimic tests dial Postgres under their own
  // prefix, so they need the published port too.
  SELFHOST_PG_HOST: "127.0.0.1",
  SELFHOST_PG_PORT: databasePort,
  SELFHOST_PG_DATABASE: databaseName,
  SELFHOST_PG_USERNAME: databaseUsername,
  SELFHOST_PG_PASSWORD: databasePassword,

  // The platform adapter suites and the cluster entity hosts the backend and
  // agent suites build all run over this connection, which is the isolated
  // platform database rather than the deployment's.
  PLATFORM_SELFHOST_PG_HOST: "127.0.0.1",
  PLATFORM_SELFHOST_PG_PORT: databasePort,
  PLATFORM_SELFHOST_PG_DATABASE: platformDatabaseName,
  PLATFORM_SELFHOST_PG_USERNAME: databaseUsername,
  PLATFORM_SELFHOST_PG_PASSWORD: databasePassword,

  PLATFORM_SELFHOST_S3_ENDPOINT: `http://127.0.0.1:${minioPort}`,
  PLATFORM_SELFHOST_S3_BUCKET: value("S3_PUBLIC_BUCKET", "voidhash-public"),
  PLATFORM_SELFHOST_S3_REGION: value("S3_REGION", "us-east-1"),
  PLATFORM_SELFHOST_S3_ACCESS_KEY_ID: value("S3_ACCESS_KEY_ID", "voidhash"),
  PLATFORM_SELFHOST_S3_SECRET_ACCESS_KEY: value("S3_SECRET_ACCESS_KEY", "password"),

  PLATFORM_SELFHOST_SMTP_HOST: "127.0.0.1",
  PLATFORM_SELFHOST_SMTP_PORT: mailpitSmtpPort,
  PLATFORM_SELFHOST_MAILPIT_API: `http://127.0.0.1:${mailpitUiPort}`,

  PLATFORM_SELFHOST_CHROMIUM_EXECUTABLE_PATH: value(
    "PLATFORM_SELFHOST_CHROMIUM_EXECUTABLE_PATH",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ),

};

// Every suite runs `vitest.integration.mts`, which selects `*.integration.test.ts`
// and nothing else. Unit files stay with `pnpm test`; no suite appears in both.
const suites = [
  { name: "platform", directory: "selfhost/platform" },
  { name: "backend", directory: "apps/backend" },
  { name: "core", directory: "packages/core" },
  { name: "backend-smoke", directory: "packages/backend" },
  { name: "agent", directory: "packages/agent" },
  { name: "db", directory: "packages/db" },
];

const requested = process.argv.slice(2);
const selected = requested.length
  ? suites.filter((suite) => requested.includes(suite.name))
  : suites;
if (requested.length && selected.length !== requested.length) {
  const known = new Set(suites.map((suite) => suite.name));
  const unknown = requested.filter((name) => !known.has(name));
  console.error(`Unknown suite(s): ${unknown.join(", ")}`);
  console.error(`Known suites: ${suites.map((suite) => suite.name).join(", ")}`);
  process.exit(1);
}

const composeArgs = [
  "compose",
  "-f",
  "selfhost/docker-compose.yml",
  "-f",
  "selfhost/docker-compose.dev.yml",
  // `--project-directory selfhost` keeps the image build context correct, which
  // also moves Compose's implicit env-file lookup away from the repo root.
  ...(fs.existsSync(envFile) ? ["--env-file", ".env"] : []),
  "--profile",
  "analytics",
  "--project-directory",
  "selfhost",
];

// `.env` is the deployment template, so it selects production mode. The stack
// this runner manages is a loopback dev stack: force evaluation mode so a fresh
// checkout does not boot containers that refuse to start on example secrets.
const composeEnv = { ...process.env, SELFHOST_MODE: "local-evaluation" };

const compose = (args, options = {}) =>
  spawnSync("docker", [...composeArgs, ...args], {
    cwd: repoRoot,
    ...options,
    env: { ...composeEnv, ...(options.env ?? {}) },
  });

// The suites need the stack, so the runner provisions it rather than failing on
// a forgotten `pnpm stack:up`. `compose up` is idempotent: already-healthy
// services are left alone. A missing prerequisite must never look like a pass,
// so anything unrecoverable here exits non-zero with the command to run.
const ensureStackRunning = () => {
  const probe = compose(["ps", "--format", "{{.Service}} {{.State}}"], {
    encoding: "utf8",
  });
  if (probe.error || probe.status !== 0) {
    console.error("Cannot reach Docker. Start Docker Desktop, then re-run.");
    if (probe.stderr) console.error(String(probe.stderr).trim());
    process.exit(1);
  }

  const running = String(probe.stdout)
    .split("\n")
    .filter((line) => line.trim().endsWith("running")).length;
  if (running > 0) return;

  console.log("Self-host stack is not running — starting it (first run builds images)…");
  const up = compose(["up", "-d", "--build", "--wait"], { stdio: "inherit" });
  if (up.status !== 0) {
    console.error("\nFailed to start the self-host stack. Run `pnpm stack:up` to debug.");
    process.exit(1);
  }
};

ensureStackRunning();

// Recreated rather than merely created: the isolated database holds nothing but
// derived cluster state, and a run that crashed mid-suite can leave messages
// addressed to entities nobody registers any more. Those are never discarded —
// the storage read loop retries them forever and starves the runner — so every
// run starts from an empty one. The tables are recreated by the layers that own
// them on first build.
const resetPlatformDatabase = async () => {
  // `pg` is resolved from the package that declares it, because the repo root
  // does not depend on it directly.
  const require = createRequire(path.join(repoRoot, "packages/db/package.json"));
  const { Client } = require("pg");
  const client = new Client({
    database: "postgres",
    host: "127.0.0.1",
    password: databasePassword,
    port: Number(databasePort),
    user: databaseUsername,
  });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [platformDatabaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${platformDatabaseName}"`);
    await client.query(`CREATE DATABASE "${platformDatabaseName}"`);
  } finally {
    await client.end();
  }
};

try {
  await resetPlatformDatabase();
} catch (error) {
  console.error(
    `Cannot provision the isolated platform database "${platformDatabaseName}" on ` +
      `127.0.0.1:${databasePort}.`,
  );
  console.error(String(error));
  process.exit(1);
}

const vp = path.join(repoRoot, "node_modules", ".bin", "vp");
const failures = [];
for (const suite of selected) {
  console.log(`\n━━━ ${suite.name} (${suite.directory}) ━━━`);
  const result = spawnSync(vp, ["test", "run", "-c", "vitest.integration.mts"], {
    cwd: path.join(repoRoot, suite.directory),
    env: testEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) failures.push(suite.name);
}

if (failures.length > 0) {
  console.error(`\nFailed suites: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll integration suites passed.");
