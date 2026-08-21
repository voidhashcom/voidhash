import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    exclude: ["./node_modules/**", "./dist/**"],
    include: ["./tests/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
