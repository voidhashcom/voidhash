// The integration-capable suites, in the order `run-local-integration.mjs`
// executes them. `check-test-tiers.mjs` imports this list too, so a package
// that gains `*.integration.test.ts` files without being registered here fails
// `verify:quick` instead of silently never running — the config-presence check
// alone cannot see this file's coverage.
//
// Every suite runs `vitest.integration.mts`, which selects
// `*.integration.test.ts` and nothing else. Unit files stay with `pnpm test`;
// no suite appears in both.
export const integrationSuites = [
  { name: "platform", directory: "packages/platform/node" },
  { name: "backend", directory: "apps/backend" },
  { name: "core", directory: "packages/core" },
  { name: "backend-smoke", directory: "packages/backend" },
  { name: "agent", directory: "packages/agent" },
  { name: "db", directory: "packages/db" },
];
