// The integration-capable suites, in the order `run-integration.mjs` executes
// them. `check-test-tiers.mjs` imports this list too, so a package that gains
// `*.integration.test.ts` files without being registered here fails
// `verify:quick` instead of silently never running — the config-presence check
// alone cannot see this file's coverage.
//
// Every suite runs `vitest.integration.mts`, which selects
// `*.integration.test.ts` and nothing else. Unit files stay with `pnpm test`;
// no suite appears in both.
//
// All three need nothing but a migrated PostgreSQL database, which is why the
// runner can serve them from PGlite instead of a container.
export const integrationSuites = [
  { name: "core", directory: "packages/core" },
  { name: "backend-rpc", directory: "packages/backend" },
  { name: "db", directory: "packages/db" },
];
