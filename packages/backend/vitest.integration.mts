import { defineConfig } from "vite-plus";

// Backend RPC + webhook smoke against a provisioned environment. Locally the
// Node test fixture supplies it via the shared core globalSetup; downstream
// compositions substitute their own globalSetup providing the same
// `coreStackOutput` contract.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["./**/*.integration.test.ts"],
    exclude: ["./node_modules/**", "./dist/**"],
    globalSetup: ["../../packages/core/test/_testing/globalSetup.ts"],
    passWithNoTests: true,
    reporters: ["verbose"],
    pool: "threads",
    isolate: false,
    fileParallelism: false,
    hookTimeout: 300_000,
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
