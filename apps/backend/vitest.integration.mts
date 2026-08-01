import { defineConfig } from "vite-plus";

// Backend RPC + webhook smoke against a provisioned environment. Locally the
// self-host stack supplies it via the shared core globalSetup; downstream
// compositions substitute their own globalSetup providing the same
// `coreStackOutput` contract.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["./src/**/*.integration.test.ts"],
    exclude: ["./node_modules/**"],
    globalSetup: ["../../packages/core/test/_testing/globalSetup.ts"],
    passWithNoTests: true,
    pool: "threads",
    fileParallelism: false,
    hookTimeout: 300_000,
    reporters: ["verbose"],
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
