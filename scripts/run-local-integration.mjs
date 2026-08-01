// Runs every integration-capable suite against the local self-host stack.
//
//   node scripts/run-local-integration.mjs [suite ...]
//
// Reads `selfhost/.env` (falling back to `selfhost/.env.example` defaults),
// derives host-side connection settings from the stack's values (container
// hostnames become 127.0.0.1 plus the published port), enables every suite's
// opt-in flag, and runs the suites sequentially. Sequential matters: the
// suites share one Postgres and one ClickHouse, and parallel runs would race
// on schema setup.
//
// Prerequisite:
//   docker compose -f selfhost/docker-compose.yml -f selfhost/docker-compose.dev.yml \
//     --profile analytics up -d --build
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

const stackEnv = parseEnvFile(path.join(repoRoot, "selfhost", ".env"));
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

const testEnv = {
  ...process.env,

  SELFHOST_MODE: "local-evaluation",
  DATABASE_HOST: "127.0.0.1",
  DATABASE_PORT: databasePort,
  DATABASE_USERNAME: databaseUsername,
  DATABASE_PASSWORD: databasePassword,
  DATABASE_NAME: databaseName,
  DATABASE_SSL: "false",

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

  PLATFORM_NODE_PG_HOST: "127.0.0.1",
  PLATFORM_NODE_PG_PORT: databasePort,
  PLATFORM_NODE_PG_DATABASE: databaseName,
  PLATFORM_NODE_PG_USERNAME: databaseUsername,
  PLATFORM_NODE_PG_PASSWORD: databasePassword,
  PLATFORM_CLUSTER_PG_HOST: "127.0.0.1",
  PLATFORM_CLUSTER_PG_PORT: databasePort,
  PLATFORM_CLUSTER_PG_DATABASE: databaseName,
  PLATFORM_CLUSTER_PG_USERNAME: databaseUsername,
  PLATFORM_CLUSTER_PG_PASSWORD: databasePassword,

  PLATFORM_NODE_S3_ENDPOINT: `http://127.0.0.1:${minioPort}`,
  PLATFORM_NODE_S3_BUCKET: value("S3_PUBLIC_BUCKET", "voidhash-public"),
  PLATFORM_NODE_S3_REGION: value("S3_REGION", "us-east-1"),
  PLATFORM_NODE_S3_ACCESS_KEY_ID: value("S3_ACCESS_KEY_ID", "voidhash"),
  PLATFORM_NODE_S3_SECRET_ACCESS_KEY: value("S3_SECRET_ACCESS_KEY", "password"),

  PLATFORM_NODE_SMTP_HOST: "127.0.0.1",
  PLATFORM_NODE_SMTP_PORT: mailpitSmtpPort,
  PLATFORM_NODE_MAILPIT_API: `http://127.0.0.1:${mailpitUiPort}`,

  PLATFORM_NODE_CHROMIUM_EXECUTABLE_PATH: value(
    "PLATFORM_NODE_CHROMIUM_EXECUTABLE_PATH",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ),

  SELFHOST_PG_TEST: "1",
  SELFHOST_CLICKHOUSE_TEST: "1",
  PLATFORM_NODE_PG_TEST: "1",
  PLATFORM_NODE_S3_TEST: "1",
  PLATFORM_NODE_SMTP_TEST: "1",
  PLATFORM_NODE_CHROMIUM_TEST: "1",
  PLATFORM_CLUSTER_PG_TEST: "1",
  DB_MIGRATIONS_TEST: "1",
};

const suites = [
  { name: "platform-node", directory: "selfhost/platform-node" },
  { name: "platform-cluster", directory: "selfhost/platform-cluster" },
  { name: "selfhost-entry", directory: "selfhost/entry" },
  { name: "core", directory: "packages/core", config: "vitest.integration.mts" },
  { name: "backend-smoke", directory: "apps/backend", config: "vitest.integration.mts" },
  { name: "agent", directory: "packages/agent" },
  { name: "db", directory: "packages/db" },
  { name: "mimic-db", directory: "apps/mimic-db" },
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

const vp = path.join(repoRoot, "node_modules", ".bin", "vp");
const failures = [];
for (const suite of selected) {
  console.log(`\n━━━ ${suite.name} (${suite.directory}) ━━━`);
  const result = spawnSync(vp, ["test", "run", "-c", suite.config ?? "vitest.mts"], {
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
