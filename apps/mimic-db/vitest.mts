import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const mimicCoreEntry = fileURLToPath(
  new URL("../../packages/mimic-core/src/index.ts", import.meta.url),
);

// Unit tier: every `*.test.ts` except the stack-backed integration files.
// `scripts/check-test-tiers.mjs` enforces this split across the repository.
export default defineConfig({
  resolve: {
    alias: {
      "@voidhash/mimic-core": mimicCoreEntry,
    },
  },
  test: {
    environment: "node",
    include: ["./**/*.test.ts"],
    exclude: ["./**/*.integration.test.ts", "./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
  },
});
