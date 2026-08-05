import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

// Unit tier: every `*.test.ts` except the stack-backed integration files.
// `scripts/check-test-tiers.mjs` enforces this split across the repository.
export default defineConfig({
  resolve: {
    alias: {
      "@voidhash/mimic-core": resolve(
        rootDir,
        "../../packages/mimic-core/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["./**/*.test.ts"],
    exclude: ["./**/*.integration.test.ts", "./node_modules/**", "./dist/**"],
    reporters: ["verbose"],
  },
});
