import viteReact from "@vitejs/plugin-react";
import { paywallRuntimeBundlePlugin } from "@voidhash/paywall-renderer-preact/vite-plugin";
import mdx from "fumadocs-mdx/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

import * as sourceConfig from "./src/features/docs/source.config.ts";

const source = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  plugins: [
    ...mdx(sourceConfig, {
      configPath: "src/features/docs/source.config.ts",
    }),
    paywallRuntimeBundlePlugin(),
    viteReact(),
  ],
  resolve: {
    alias: [
      {
        find: /^virtual:voidhash-web\/auth-browser$/,
        replacement: fileURLToPath(
          new URL("./src/composition/community/auth-browser.ts", import.meta.url),
        ),
      },
      {
        find: /^virtual:voidhash-web\/auth-server$/,
        replacement: fileURLToPath(
          new URL("./src/composition/community/auth-server.ts", import.meta.url),
        ),
      },
      {
        find: /^virtual:voidhash-web\/edition$/,
        replacement: fileURLToPath(
          new URL("./src/composition/community/edition.ts", import.meta.url),
        ),
      },
      {
        find: /^virtual:voidhash-web\/globals\.css(?=\?|$)/,
        replacement: fileURLToPath(new URL("./src/styles/globals.css", import.meta.url)),
      },
      {
        find: /^@generated\/browser$/,
        replacement: fileURLToPath(new URL("../../apps/www/.source/browser.ts", import.meta.url)),
      },
      {
        find: /^@generated\/server$/,
        replacement: fileURLToPath(new URL("../../apps/www/.source/server.ts", import.meta.url)),
      },
      { find: "@", replacement: source },
    ],
    dedupe: ["@tanstack/react-query", "@tanstack/react-router", "react", "react-dom"],
  },
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // The designer suites mount heavy jsdom component trees in parallel workers;
    // the 5s default trips on machine load rather than on real hangs.
    testTimeout: 20_000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/features/studio/paywalls/designer/canvas/helpers/selectable.test.tsx",
    ],
  },
});
