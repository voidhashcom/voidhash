import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["./**/*.test.ts"],
    exclude: ["./node_modules/**"],
    reporters: ["verbose"],
  },
});
