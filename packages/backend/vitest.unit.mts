import { defineConfig } from "vite-plus";

// Unit tier: every `*.test.ts` except the stack-backed integration files.
// `scripts/check-test-tiers.mjs` enforces this split across the repository.
export default defineConfig({
  test: {
    environment: "node",
    include: ["./**/*.test.ts"],
    exclude: ["./**/*.integration.test.ts", "./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
  },
});
