import path from "node:path";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const envDir = path.join(process.cwd(), "../../apps/api");

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "./src/services/**/*.integration.test.ts",
      "./src/payment-providers/**/*.integration.test.ts",
    ],
    reporters: ["verbose"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    env: loadEnv("", envDir, ""),
    testTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
