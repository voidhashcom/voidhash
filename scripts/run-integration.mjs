// Runs every integration-capable suite against a migrated PostgreSQL database.
//
//   node scripts/run-integration.mjs [suite ...]
//
// The suites need nothing but a database. A server that is already listening is
// always reused; otherwise the `standalone_postgres` container is started.
//
// `VOIDHASH_TEST_PGLITE=1` serves PGlite instead, which needs no container — but
// it is not a drop-in for a test run. PGlite multiplexes every pooled connection
// onto one backend, so a statement error can roll back work another connection
// already committed. Two `core` suites fail that way, and more would be silently
// wrong rather than red. Use it for a fast local loop, not to gate a change.
//
// Suites run sequentially because they share one database and would otherwise
// race on schema setup and fixture rows.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem, Path, Stdio } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createRequire } from "node:module";
import { createConnection } from "node:net";

import { integrationSuites } from "./integration-suites.mjs";

const PGLITE_DATA_DIR = ".pglite/integration";

const envOr = (name, fallback) =>
  Config.string(name).pipe(Config.withDefault(fallback), Effect.orDie);

const nonEmpty = (value, fallback) => {
  const trimmed = value.trim();
  if (trimmed.length > 0) return trimmed;
  return fallback;
};

const readConnection = Effect.gen(function* () {
  const host = nonEmpty(yield* envOr("DATABASE_HOST", "127.0.0.1"), "127.0.0.1");
  const port = yield* Config.port("DATABASE_PORT").pipe(Config.withDefault(5432), Effect.orDie);
  const name = nonEmpty(yield* envOr("DATABASE_NAME", "voidhash"), "voidhash");
  const username = nonEmpty(yield* envOr("DATABASE_USERNAME", "voidhash"), "voidhash");
  const password = yield* envOr("DATABASE_PASSWORD", "password");
  const pgliteRaw = yield* envOr("VOIDHASH_TEST_PGLITE", "");
  const pglite = pgliteRaw === "1" || pgliteRaw.toLowerCase() === "true";
  return { host, port, name, username, password, pglite };
});

/** Resolves to whether something is already accepting TCP connections on the port. */
const isListening = (connection) =>
  Effect.callback((resume) => {
    const socket = createConnection({ host: connection.host, port: connection.port });
    const settle = (listening) => {
      socket.destroy();
      resume(Effect.succeed(listening));
    };
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
    return Effect.sync(() => socket.destroy());
  });

/** Polls until the fixture accepts connections, so migrations never race the server's startup. */
const waitForDatabase = (connection) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (yield* isListening(connection)) return true;
      yield* Effect.sleep("500 millis");
    }
    return false;
  });

const inherit = { stdin: "inherit", stdout: "inherit", stderr: "inherit" };

/** Runs a command to completion and returns its exit code. */
const exitCode = (command) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return yield* spawner.exitCode(command);
  });

const selectSuites = (requested) => {
  if (requested.length === 0) return integrationSuites;
  return integrationSuites.filter((suite) => requested.includes(suite.name));
};

const exitWith = (code) => {
  if (code === 0) return Effect.void;
  return Effect.fail(code);
};

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stdio = yield* Stdio.Stdio;
  const scriptPath = yield* path.fromFileUrl(new URL(import.meta.url));
  const repoRoot = path.join(path.dirname(scriptPath), "..");
  const connection = yield* readConnection;

  // The package exports only its entry point, so derive the sibling CLI path
  // after resolving whichever workspace install owns the package.
  const pgliteEntry = createRequire(import.meta.url).resolve("@electric-sql/pglite-socket");
  const pgliteServer = path.join(path.dirname(pgliteEntry), "scripts", "server.js");
  const databaseEnv = {
    DATABASE_HOST: connection.host,
    DATABASE_PORT: String(connection.port),
    DATABASE_NAME: connection.name,
    DATABASE_USERNAME: connection.username,
    DATABASE_PASSWORD: connection.password,
    DATABASE_SSL: "false",
  };

  const requested = (yield* stdio.args).filter((argument) => !argument.startsWith("-"));
  const unknown = requested.filter(
    (name) => !integrationSuites.some((suite) => suite.name === name),
  );
  if (unknown.length > 0) {
    yield* Console.error(
      `run-integration: unknown suite(s): ${unknown.join(", ")}. ` +
        `Known: ${integrationSuites.map((suite) => suite.name).join(", ")}`,
    );
    return 1;
  }
  const selected = selectSuites(requested);

  // A server that is already up is always reused, so a developer running
  // A development PGlite resource or Docker keeps its data across runs.
  if (yield* isListening(connection)) {
    yield* Console.log(
      `run-integration: reusing the server on ${connection.host}:${connection.port}`,
    );
  } else if (connection.pglite) {
    yield* Console.log(`run-integration: starting PGlite on ${connection.port}`);
    // PGlite creates only the leaf directory, so the parent has to exist first.
    yield* fileSystem.makeDirectory(PGLITE_DATA_DIR, { recursive: true });
    // `--max-connections` must stay well above one: PGlite refuses the second
    // connection on the default of 1, which the suites' pools hit immediately.
    yield* Effect.forkScoped(
      exitCode(
        ChildProcess.make(
          "node",
          [
            pgliteServer,
            `--db=${PGLITE_DATA_DIR}`,
            `--port=${connection.port}`,
            "--max-connections=100",
          ],
          { cwd: repoRoot, stdin: "ignore", stdout: "ignore", stderr: "inherit" },
        ),
      ),
    );
    if (!(yield* waitForDatabase(connection))) {
      yield* Console.error(
        `run-integration: PGlite did not accept connections on ${connection.port} within 30s`,
      );
      return 1;
    }
  } else {
    yield* Console.log("run-integration: starting standalone_postgres");
    const composeCode = yield* exitCode(
      ChildProcess.make("docker", ["compose", "up", "-d", "--wait", "standalone_postgres"], {
        cwd: repoRoot,
        ...inherit,
      }),
    );
    if (composeCode !== 0 || !(yield* waitForDatabase(connection))) {
      yield* Console.error(
        `run-integration: no PostgreSQL server on ${connection.host}:${connection.port}. ` +
          "Start one with `docker compose up -d standalone_postgres`, or set " +
          "VOIDHASH_TEST_PGLITE=1 to serve PGlite instead.",
      );
      return 1;
    }
  }

  const migrateCode = yield* exitCode(
    ChildProcess.make("node", [path.join(repoRoot, "scripts", "db-migrate-local.mjs")], {
      cwd: repoRoot,
      env: databaseEnv,
      extendEnv: true,
      ...inherit,
    }),
  );
  if (migrateCode !== 0) {
    yield* Console.error("run-integration: migrations failed");
    return 1;
  }

  const vp = path.join(repoRoot, "node_modules", ".bin", "vp");
  const failures = [];
  for (const suite of selected) {
    yield* Console.log(`\n━━━ ${suite.name} (${suite.directory}) ━━━`);
    const code = yield* exitCode(
      ChildProcess.make(vp, ["test", "run", "-c", "vitest.integration.mts"], {
        cwd: path.join(repoRoot, suite.directory),
        env: databaseEnv,
        extendEnv: true,
        ...inherit,
      }),
    );
    if (code !== 0) failures.push(suite.name);
  }

  if (failures.length > 0) {
    yield* Console.error(`\nrun-integration: failed suites: ${failures.join(", ")}`);
    return 1;
  }
  yield* Console.log(`\nrun-integration: ${selected.length} suite(s) passed`);
  return 0;
});

NodeRuntime.runMain(
  Effect.scoped(program).pipe(Effect.flatMap(exitWith), Effect.provide(NodeServices.layer)),
  { disableErrorReporting: true },
);
