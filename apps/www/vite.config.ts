import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { paywallRuntimeBundlePlugin } from "@voidhash/paywall-renderer-preact/vite-plugin";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { createRequire } from "node:module";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- Vite config runs in Node at build time, outside any Effect runtime; Path would need a runtime that does not exist while the config module is evaluated.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as sourceConfig from "./src/features/source.config.ts";

const devPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
const devHost = process.env.HOST ?? true;
const appRootPath = fileURLToPath(new URL(".", import.meta.url));
const appSrcPath = fileURLToPath(new URL("./src", import.meta.url));
const workspacePath = fileURLToPath(new URL("../..", import.meta.url));
// oxlint-disable-next-line effect/noDynamicImports -- createRequire is the only way to resolve the on-disk location of tslib and the fontsource packages for Vite aliasing; a static import yields the module, not its path.
const require = createRequire(import.meta.url);
const tslibPath = require.resolve("tslib/tslib.es6.mjs");
const fontSourcePaths = ["@fontsource-variable/geist", "@fontsource-variable/geist-mono"].map(
  (packageName) => dirname(require.resolve(packageName)),
);
// The self-host image uses an isolated runtime tree, so its SSR output cannot
// rely on transitive packages being hoisted beside the application.
const bundleServerDependencies = process.env.VOIDHASH_SELFHOST_BUNDLE === "true";

const localDevOrigins = [
  `http://localhost:${devPort}`,
  `https://localhost:${devPort}`,
  `http://127.0.0.1:${devPort}`,
  `https://127.0.0.1:${devPort}`,
];

function corsMiddleware() {
  return {
    name: "cors-middleware",
    configureServer(server: {
      middlewares: {
        use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        const request = req as {
          headers: { origin?: string };
          method?: string;
        };
        const response = res as {
          end: () => void;
          setHeader: (name: string, value: string) => void;
          statusCode: number;
        };
        const origin = request.headers.origin;

        if (origin && localDevOrigins.includes(origin)) {
          response.setHeader("Access-Control-Allow-Origin", origin);
          response.setHeader("Access-Control-Allow-Credentials", "true");
          response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
          response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }
        }

        next();
      });
    },
  };
}

function tanstackClientEntryMiddleware() {
  return {
    name: "tanstack-client-entry-middleware",
    configureServer(server: {
      middlewares: {
        use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use((req, _res, next) => {
        const request = req as { url?: string };

        // The development HTML emits the raw virtual ID while Vite serves its canonical NUL form.
        if (request.url?.startsWith("/@id/virtual:tanstack-start-client-entry")) {
          request.url = request.url.replace("/@id/virtual:", "/@id/__x00__virtual:");
        }

        next();
      });
    },
  };
}

export default defineConfig(() => ({
  root: appRootPath,
  build: {
    minify: "esbuild",
  },
  // Run with `pnpm test:components` — deliberately NOT the `test` script, so
  // `turbo test` (and therefore CI `verify:quick`) skips this suite for now.
  // The hoisted install materializes MULTIPLE React instances (root 19.2.x
  // plus dozens of nested copies under @radix-ui packages and sonner; the root
  // `resolutions` react pin is not applied by pnpm's hoisted linker), and in a
  // pristine `pnpm install --frozen-lockfile` checkout the dual instances make
  // ~30 of these files fail — Radix components silently render nothing when
  // their React differs from react-dom's. Aligning the install on a single
  // React (overrides/catalog surgery, verified in a fresh clone) is the
  // prerequisite; once done, rename `test:components` to `test` so the suite
  // joins `turbo test` and CI. The two excluded files below crash on the dual
  // instance even in a warm working tree.
  test: {
    setupFiles: ["./src/test-setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/features/studio/paywalls/designer/canvas/helpers/selectable.test.tsx",
      "src/features/studio/paywalls/designer/panel-runtime/host-renderer.test.tsx",
    ],
  },
  plugins: [
    ...mdx(sourceConfig, {
      configPath: "src/features/source.config.ts",
    }),
    tanstackClientEntryMiddleware(),
    corsMiddleware(),
    paywallRuntimeBundlePlugin(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      server: {
        entry: "server.ts",
      },
      prerender: {
        enabled: false,
      },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      "@": appSrcPath,
      "@generated/browser": fileURLToPath(new URL("./.source/browser.ts", import.meta.url)),
      "@generated/server": fileURLToPath(new URL("./.source/server.ts", import.meta.url)),
      tslib: tslibPath,
    },
    // TanStack's server-function compiler must transform WorkOS-owned createServerFn calls.
    tsconfigPaths: true,
  },
  server: {
    cors: {
      credentials: true,
      origin: true,
    },
    fs: {
      allow: [workspacePath, ...fontSourcePaths],
    },
    host: devHost,
    port: devPort,
  },
  ssr: bundleServerDependencies ? { noExternal: true } : undefined,
}));
