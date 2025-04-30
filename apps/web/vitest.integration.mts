import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // @ts-expect-error - TODO: Fix
  plugins: [tsconfigPaths()],
  test: {
    include: ["./lib/api/v1/**/*.test.ts"],
    reporters: ["verbose"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
