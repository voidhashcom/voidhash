// Runs every integration-capable suite against the local Node test fixture.
//
//   node scripts/run-local-integration.mjs [suite ...]
//
// Reads `.env` at the repo root (falling back to `.env.example` defaults),
// derives host-side connection settings from the stack's values (container
// hostnames become 127.0.0.1 plus the published port), and runs the suites
// sequentially. Sequential matters because the suites share one PostgreSQL
// database and parallel runs would race on schema setup.
//
// Suites read and write the deployment's application tables, but the clusters
// they build get an isolated database of their own — see `resetPlatformDatabase`
// below.
//
// The fixture is the only prerequisite, and the runner starts it if it is down.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect, Exit, FileSystem, Path, Runtime, Stdio, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { Client } from "pg";

import { integrationSuites } from "./integration-suites.mjs";

/**
 * Parses a dotenv-style file into a plain record. A missing file yields no
 * values, exactly like the previous `existsSync` guard.
 *
 * @param {string} filePath
 */
const parseEnvFile = (filePath) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const values = {};
    if (!(yield* fileSystem.exists(filePath))) return values;
    for (const line of (yield* fileSystem.readFileString(filePath)).split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
    }
    return values;
  }).pipe(Effect.orDie);

/**
 * Resolves a setting from the process environment, then the parsed `.env`, then
 * the supplied fallback.
 *
 * @param {Record<string, string>} stackEnv
 * @param {string} key
 * @param {string | undefined} fallback
 */
const settingFrom = (stackEnv, key, fallback) =>
  Config.string(key).pipe(Config.withDefault(stackEnv[key] ?? fallback), Effect.orDie);

/**
 * Chrome ships at a known location on macOS; elsewhere the path has to be
 * configured explicitly.
 */
const defaultChromiumPath = () => {
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return undefined;
};

/**
 * The chromium override is only exported when a path is known, so an unset value
 * never shadows a suite's own default.
 *
 * @param {string | undefined} executablePath
 */
const chromiumOverride = (executablePath) => {
  if (!executablePath) return {};
  return { PLATFORM_NODE_CHROMIUM_EXECUTABLE_PATH: executablePath };
};

/**
 * `--env-file` is only passed when `.env` exists: Compose errors out on a
 * missing env file rather than ignoring it.
 *
 * @param {boolean} envFileExists
 */
const envFileArgs = (envFileExists) => {
  if (envFileExists) return ["--env-file", ".env"];
  return [];
};

/**
 * No suite names on the command line means "run them all".
 *
 * @param {ReadonlyArray<{ name: string; directory: string }>} suites
 * @param {ReadonlyArray<string>} requested
 */
const selectSuites = (suites, requested) => {
  if (requested.length === 0) return suites;
  return suites.filter((suite) => requested.includes(suite.name));
};

/**
 * Runs a command with the parent's stdio attached and returns its exit code,
 * reporting a spawn failure as a non-zero code like `spawnSync().error` did.
 *
 * @param {ChildProcess.Command} command
 */
const runInherit = (command) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return Number(yield* spawner.exitCode(command));
  }).pipe(Effect.orElseSucceed(() => 1));

/**
 * Runs a command with its output captured, returning the exit code alongside
 * both streams.
 *
 * @param {ChildProcess.Command} command
 */
const runCaptured = (command) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(command);
    // Both streams are drained concurrently with the exit-code wait: consuming
    // one to completion first can deadlock a child that fills the other pipe.
    const [stdout, stderr, code] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    return { code: Number(code), stdout, stderr };
  }).pipe(
    Effect.scoped,
    Effect.orElseSucceed(() => ({ code: 1, stdout: "", stderr: "" })),
  );

/**
 * Opens a Postgres connection, hands it to `use`, and always closes it — the
 * Effect equivalent of the `try { … } finally { await client.end() }` bracket.
 */
const withClient = (options, use) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const client = new Client(options);
      yield* Effect.tryPromise({ try: () => client.connect(), catch: (cause) => cause });
      return client;
    }),
    use,
    (client) => Effect.promise(() => client.end()),
  );

/**
 * Recreated rather than merely created: the isolated database holds nothing but
 * derived cluster state, and a run that crashed mid-suite can leave messages
 * addressed to entities nobody registers any more. Those are never discarded —
 * the storage read loop retries them forever and starves the runner — so every
 * run starts from an empty one. The tables are recreated by the layers that own
 * them on first build.
 *
 * @param {{ host: string; port: number; user: string; password: string }} connection
 * @param {string} platformDatabaseName
 */
const resetPlatformDatabase = (connection, platformDatabaseName) =>
  withClient({ ...connection, database: "postgres" }, (client) => {
    const query = (sql, values) =>
      Effect.tryPromise({ try: () => client.query(sql, values), catch: (cause) => cause });
    return Effect.gen(function* () {
      yield* query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [
        platformDatabaseName,
      ]);
      yield* query(`DROP DATABASE IF EXISTS "${platformDatabaseName}"`);
      yield* query(`CREATE DATABASE "${platformDatabaseName}"`);
    });
  });

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;
  const stdio = yield* Stdio.Stdio;

  const scriptDirectory = path.dirname(yield* path.fromFileUrl(new URL(import.meta.url)));
  const repoRoot = path.resolve(scriptDirectory, "..");

  const envFile = path.join(repoRoot, ".env");
  const envExample = path.join(repoRoot, ".env.example");

  // A first checkout has no `.env`, which is a setup step to forget rather than a
  // decision to make: the example holds the same defaults the suites assume.
  if (!(yield* fileSystem.exists(envFile)) && (yield* fileSystem.exists(envExample))) {
    yield* fileSystem.copyFile(envExample, envFile);
    yield* Console.log("Created .env from .env.example.");
  }

  const stackEnv = yield* parseEnvFile(envFile);
  const value = (key, fallback) => settingFrom(stackEnv, key, fallback);

  const databasePort = yield* value("DATABASE_HOST_PORT", "5432");
  const databaseUsername = yield* value("DATABASE_USERNAME", "voidhash");
  const databasePassword = yield* value("DATABASE_PASSWORD", "password");
  const databaseName = yield* value("DATABASE_NAME", "voidhash");
  const minioPort = yield* value("MINIO_API_PORT", "9000");
  const mailpitSmtpPort = yield* value("MAILPIT_SMTP_PORT", "1025");
  const mailpitUiPort = yield* value("MAILPIT_UI_PORT", "8025");
  const compilerPort = yield* value("COMPILER_HOST_PORT", "5002");
  const chromiumExecutablePath = yield* value(
    "PLATFORM_NODE_CHROMIUM_EXECUTABLE_PATH",
    defaultChromiumPath(),
  );

  // Several suites build their own single-node cluster, and a single-node cluster
  // claims *every* shard in the database it is built over. Sharing the running
  // deployment's database would make the two runners steal each other's messages,
  // which surfaces as `Could not find entity manager for address, retrying` in the
  // app log and as timeouts in the suite. Platform state therefore gets a database
  // of its own; application tables stay where the deployment keeps them.
  const platformDatabaseName = `${databaseName}_platform_test`;

  // Only the overrides are listed; `extendEnv` supplies the rest of the parent
  // environment, matching the original `{ ...process.env, … }` spread.
  const testEnv = {
    SELFHOST_MODE: "local-evaluation",
    DATABASE_HOST: "127.0.0.1",
    DATABASE_PORT: databasePort,
    DATABASE_USERNAME: databaseUsername,
    DATABASE_PASSWORD: databasePassword,
    DATABASE_NAME: databaseName,
    DATABASE_SSL: "false",

    // Only the name differs; host, port, and credentials fall back to DATABASE_*.
    DATABASE_PLATFORM_NAME: platformDatabaseName,

    ROOT_USERNAME: yield* value("MIMIC_ROOT_USERNAME", "root"),
    ROOT_PASSWORD: yield* value("MIMIC_ROOT_PASSWORD", "password"),

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
    PLATFORM_NODE_PG_HOST: "127.0.0.1",
    PLATFORM_NODE_PG_PORT: databasePort,
    PLATFORM_NODE_PG_DATABASE: platformDatabaseName,
    PLATFORM_NODE_PG_USERNAME: databaseUsername,
    PLATFORM_NODE_PG_PASSWORD: databasePassword,

    PLATFORM_NODE_S3_ENDPOINT: `http://127.0.0.1:${minioPort}`,
    PLATFORM_NODE_S3_BUCKET: yield* value("S3_PUBLIC_BUCKET", "voidhash-public"),
    PLATFORM_NODE_S3_REGION: yield* value("S3_REGION", "us-east-1"),
    PLATFORM_NODE_S3_ACCESS_KEY_ID: yield* value("S3_ACCESS_KEY_ID", "voidhash"),
    PLATFORM_NODE_S3_SECRET_ACCESS_KEY: yield* value("S3_SECRET_ACCESS_KEY", "password"),

    PLATFORM_NODE_SMTP_HOST: "127.0.0.1",
    PLATFORM_NODE_SMTP_PORT: mailpitSmtpPort,
    PLATFORM_NODE_MAILPIT_API: `http://127.0.0.1:${mailpitUiPort}`,

    ...chromiumOverride(chromiumExecutablePath),
  };

  const suites = integrationSuites;

  const requested = yield* stdio.args;
  const selected = selectSuites(suites, requested);
  if (requested.length && selected.length !== requested.length) {
    const known = new Set(suites.map((suite) => suite.name));
    const unknown = requested.filter((name) => !known.has(name));
    yield* Console.error(`Unknown suite(s): ${unknown.join(", ")}`);
    yield* Console.error(`Known suites: ${suites.map((suite) => suite.name).join(", ")}`);
    return 1;
  }

  const composeArgs = [
    "compose",
    "-f",
    "test/integration/docker-compose.yml",
    "-f",
    "test/integration/docker-compose.dev.yml",
    // The explicit project directory keeps image build contexts and Compose's
    // implicit env-file lookup stable.
    ...envFileArgs(yield* fileSystem.exists(envFile)),
    "--project-directory",
    "test/integration",
  ];

  // `.env` is the deployment template, so it selects production mode. The stack
  // this runner manages is a loopback dev stack: force evaluation mode so a fresh
  // checkout does not boot containers that refuse to start on example secrets.
  const compose = (args, options) =>
    ChildProcess.make("docker", [...composeArgs, ...args], {
      cwd: repoRoot,
      env: { SELFHOST_MODE: "local-evaluation" },
      extendEnv: true,
      ...options,
    });

  const prerequisiteBuild = yield* runInherit(
    ChildProcess.make("pnpm", ["--filter", "@voidhash/paywalls", "build"], {
      cwd: repoRoot,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  if (prerequisiteBuild !== 0) {
    yield* Console.error("Failed to build integration test prerequisites.");
    return 1;
  }

  // The suites need the stack, so the runner provisions it rather than failing on
  // a forgotten `pnpm test:infra:up`. `compose up` is idempotent: already-healthy
  // services are left alone. A missing prerequisite must never look like a pass,
  // so anything unrecoverable here exits non-zero with the command to run.
  const probe = yield* runCaptured(
    compose(["ps", "--format", "{{.Service}} {{.State}}"], { stdout: "pipe", stderr: "pipe" }),
  );
  if (probe.code !== 0) {
    yield* Console.error("Cannot reach Docker. Start Docker Desktop, then re-run.");
    if (probe.stderr) yield* Console.error(probe.stderr.trim());
    return 1;
  }

  const running = probe.stdout.split("\n").filter((line) => line.trim().endsWith("running")).length;
  if (running === 0) {
    yield* Console.log(
      "Integration fixture is not running — starting it (first run builds images)…",
    );
    const up = yield* runInherit(
      compose(["up", "-d", "--build", "--wait"], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }),
    );
    if (up !== 0) {
      yield* Console.error(
        "\nFailed to start the integration fixture. Run `pnpm test:infra:up` to debug.",
      );
      return 1;
    }
  }

  const connection = {
    host: "127.0.0.1",
    password: databasePassword,
    port: Number(databasePort),
    user: databaseUsername,
  };
  const resetCode = yield* resetPlatformDatabase(connection, platformDatabaseName).pipe(
    Effect.as(0),
    Effect.catch((cause) =>
      Effect.gen(function* () {
        yield* Console.error(
          `Cannot provision the isolated platform database "${platformDatabaseName}" on ` +
            `127.0.0.1:${databasePort}.`,
        );
        yield* Console.error(String(cause));
        return 1;
      }),
    ),
  );
  if (resetCode !== 0) return 1;

  const vp = path.join(repoRoot, "node_modules", ".bin", "vp");
  const failures = [];
  for (const suite of selected) {
    yield* Console.log(`\n━━━ ${suite.name} (${suite.directory}) ━━━`);
    const code = yield* runInherit(
      ChildProcess.make(vp, ["test", "run", "-c", "vitest.integration.mts"], {
        cwd: path.join(repoRoot, suite.directory),
        env: testEnv,
        extendEnv: true,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }),
    );
    if (code !== 0) failures.push(suite.name);
  }

  if (failures.length > 0) {
    yield* Console.error(`\nFailed suites: ${failures.join(", ")}`);
    return 1;
  }
  yield* Console.log("\nAll integration suites passed.");
  return 0;
});

/**
 * Propagates the resolved exit code verbatim instead of collapsing it to `0`/`1`.
 *
 * @type {Runtime.Teardown}
 */
const teardown = (exit, onExit) => {
  if (Exit.isSuccess(exit)) {
    onExit(Number(exit.value));
    return;
  }
  Runtime.defaultTeardown(exit, onExit);
};

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain({ teardown }));
