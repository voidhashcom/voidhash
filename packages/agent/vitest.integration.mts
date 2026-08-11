import { defineConfig } from "vite-plus";

// Integration tier: runs against the provisioned Node test fixture via
// `pnpm test:integration`. Timeouts are generous because these tests wait on
// real containers rather than fakes.
export default defineConfig({
  test: {
    environment: "node",
    include: ["./**/*.integration.test.ts"],
    exclude: ["./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
    hookTimeout: 300_000,
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
