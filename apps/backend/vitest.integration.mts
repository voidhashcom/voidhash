import { defineConfig } from "vite-plus";

// Integration tier: runs against the provisioned Node test fixture via
// `pnpm test:integration`. Timeouts are generous because these tests wait on
// real containers rather than fakes.
//
// Files run one at a time. Most of them build a single-node cluster, and a
// single-node cluster claims every shard in its database: two files running at
// once would take each other's messages exactly the way a test process and a
// running deployment do.
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
