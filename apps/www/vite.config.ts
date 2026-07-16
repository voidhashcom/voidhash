import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { paywallRuntimeBundlePlugin } from "@voidhash/paywall-renderer-preact/vite-plugin";
import mdx from "fumadocs-mdx/vite";
import { defineConfig, type PluginOption } from "vite";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as designSourceConfig from "./src/features/design/source.config.ts";
import * as docsSourceConfig from "./src/features/docs/source.config.ts";

const devPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
const devHost = process.env.HOST ?? true;
const appRootPath = fileURLToPath(new URL(".", import.meta.url));
const appSrcPath = fileURLToPath(new URL("./src", import.meta.url));
const workspacePath = fileURLToPath(new URL("../..", import.meta.url));
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

function scopedMdxPlugin(plugin: PluginOption, scopeFragment: string) {
  const vitePlugin = plugin as {
    transform?: (this: unknown, code: string, id: string) => unknown;
  };

  if (!vitePlugin.transform) {
    return plugin;
  }

  return {
    ...vitePlugin,
    async transform(this: unknown, code: string, id: string) {
      const [file] = id.split("?");
      if (!file.includes(scopeFragment)) {
        return null;
      }

      return vitePlugin.transform?.call(this, code, id);
    },
  };
}

export default defineConfig(() => ({
  root: appRootPath,
  build: {
    minify: "esbuild",
  },
  test: {
    setupFiles: ["./src/test-setup.ts"],
  },
  plugins: [
    scopedMdxPlugin(
      mdx(docsSourceConfig, {
        configPath: "src/features/docs/source.config.ts",
        generateIndexFile: {
          out: "docs.generated.ts",
        },
      }),
      "/src/features/docs/content/docs/",
    ),
    scopedMdxPlugin(
      mdx(designSourceConfig, {
        configPath: "src/features/design/source.config.ts",
        generateIndexFile: {
          out: "design.generated.ts",
        },
      }),
      "/src/features/design/content/docs/",
    ),
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
      "@generated/design": fileURLToPath(new URL("./design.generated.ts", import.meta.url)),
      "@generated/docs": fileURLToPath(new URL("./docs.generated.ts", import.meta.url)),
      tslib: tslibPath,
    },
    // TanStack's server-function compiler must transform WorkOS-owned createServerFn calls.
    noExternal: ["@workos/authkit-tanstack-react-start"],
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
