import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["./**/*.test.ts"],
    exclude: ["./lib/api/v1/**/*.test.ts", "./node_modules/**"],
    reporters: ["verbose"],
    env: loadEnv("", process.cwd(), ""),
  },
});
