// Thin wrapper around `drizzle-kit generate`.
//
// The drizzle config (`drizzle.config.ts`) emits Postgres migrations into the
// non-standard dir-per-migration layout under
// `packages/db/src/alchemy-migrations`. The alchemy-effect PlanetScale Postgres
// migration runner applies each `migration.sql` as a single query, and
// drizzle's `--> statement-breakpoint` separators are inert `--` line comments
// to Postgres — so, unlike the old MySQL/Vitess path, no post-processing of the
// generated SQL is needed. This stays a wrapper only to keep the `db:generate`
// script interface stable and forward args verbatim (e.g. `--name init`).

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Exit, Runtime, Stdio } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const program = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  return yield* spawner.exitCode(
    ChildProcess.make("pnpm", ["exec", "drizzle-kit", "generate", ...args], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
}).pipe(Effect.provide(NodeServices.layer));

// The child's exit status is this script's exit status, so a successful run of
// the wrapper still has to surface a non-zero `drizzle-kit` code — hence the
// custom teardown instead of the default success-means-0 mapping.
NodeRuntime.runMain(program, {
  teardown: (exit, onExit) => {
    if (Exit.isSuccess(exit)) return onExit(exit.value);
    return Runtime.defaultTeardown(exit, onExit);
  },
});
