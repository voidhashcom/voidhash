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

import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "drizzle-kit", "generate", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
