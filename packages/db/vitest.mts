import { defineConfig } from "vite-plus";

// Unit tier: the package's only suite is its migration integration test, so
// this tier is intentionally empty rather than absent — `turbo test` stays
// uniform across packages.
export default defineConfig({
  test: {
    environment: "node",
    include: ["./**/*.test.ts"],
    exclude: ["./**/*.integration.test.ts", "./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
    passWithNoTests: true,
  },
});
