import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Resolved through the WHATWG URL parser rather than `node:path`. `pathname` is
// percent-encoded, so it is decoded back into a real filesystem path — otherwise a
// checkout under a directory containing a space would resolve to a nonexistent dir
// and `loadEnv` would silently return nothing.
const envDir = decodeURIComponent(new URL("../../apps/api", `file://${process.cwd()}/`).pathname);

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: loadEnv("", envDir, ""),
    exclude: ["./**/*.integration.test.ts", "./node_modules/**"],
    include: ["./**/*.test.ts"],
    reporters: ["verbose"],
  },
});
