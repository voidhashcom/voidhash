import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    exclude: ["./node_modules/**", "./dist/**"],
    include: ["./tests/**/*.test.ts", "./tests/**/*.test.tsx"],
    reporters: ["verbose"],
  },
});
