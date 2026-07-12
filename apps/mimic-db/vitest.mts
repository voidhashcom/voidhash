import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

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
    include: ["./tests/**/*.test.ts"],
    exclude: ["./node_modules/**"],
    reporters: ["verbose"],
  },
});
