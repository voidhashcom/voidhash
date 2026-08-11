import { defineConfig } from "vite-plus";

// Integration tier: runs against the provisioned self-host stack via
// `pnpm test:integration`. Timeouts are generous because these tests wait on
// real containers rather than fakes.
//
// Files run one at a time: the cluster conformance file claims every shard in
// its database, so a file running beside it would take its messages.
export default defineConfig({
  test: {
    environment: "node",
    include: ["./**/*.integration.test.ts"],
    exclude: ["./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
    fileParallelism: false,
    hookTimeout: 300_000,
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
