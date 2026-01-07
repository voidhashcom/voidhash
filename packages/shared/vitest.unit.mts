import path from "node:path";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const envDir = path.join(process.cwd(), "../../apps/api");

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: loadEnv("", envDir, ""),
    exclude: ["./**/*.integration.test.ts", "./node_modules/**"],
    include: ["./**/*.test.ts"],
    reporters: ["verbose"],
  },
});
