import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["./**/*.test.ts"],
    exclude: ["./**/*.integration.test.ts", "./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
    passWithNoTests: true,
  },
});
