import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { paywallRuntimeBundlePlugin } from "@voidhash/paywall-renderer-preact/vite-plugin";
import mdx from "fumadocs-mdx/vite";
import { createRequire } from "node:module";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- Vite configuration runs before an Effect runtime exists.
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defineConfig,
  type Alias,
  type PluginOption,
  type SSROptions,
  type UserConfig,
  type UserConfigExport,
} from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const webAppRoot = new URL("../../", import.meta.url);
const webAppSource = new URL("../", import.meta.url);
const communityPublic = new URL("../../public/", import.meta.url);
const rootRoute = new URL("../routes/__root.tsx", import.meta.url);

export interface VoidhashWebCompositionPaths {
  readonly authBrowser: URL;
  readonly authServer: URL;
  readonly edition: URL;
  readonly globals: URL;
}

export interface VoidhashWebConfigOptions {
  readonly appRoot: URL;
  readonly composition: VoidhashWebCompositionPaths;
  readonly extraAliases?: readonly Alias[];
  readonly extraPlugins?: readonly PluginOption[];
  readonly optimizeDepsExclude?: readonly string[];
  readonly publicDir?: URL;
  readonly routeDirectories: readonly URL[];
  readonly sourceConfig: Parameters<typeof mdx>[0];
  readonly sourceConfigPath?: string;
  readonly workspaceRoot: URL;
}

const toRoutePath = (workspaceRoot: string, url: URL): string =>
  relative(workspaceRoot, fileURLToPath(url)).replaceAll("\\", "/");

const corsMiddleware = (localDevOrigins: readonly string[]) => ({
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
});

const tanstackClientEntryMiddleware = () => ({
  name: "tanstack-client-entry-middleware",
  configureServer(server: {
    middlewares: {
      use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void;
    };
  }) {
    server.middlewares.use((req, _res, next) => {
      const request = req as { url?: string };
      if (request.url?.startsWith("/@id/virtual:tanstack-start-client-entry")) {
        request.url = request.url.replace("/@id/virtual:", "/@id/__x00__virtual:");
      }
      next();
    });
  },
});

/** Builds a Voidhash web entrypoint from shared OSS routes and edition-owned routes. */
export function defineVoidhashWebConfig(options: VoidhashWebConfigOptions): UserConfigExport {
  const appRoot = fileURLToPath(options.appRoot);
  const workspaceRoot = fileURLToPath(options.workspaceRoot);
  const webAppSourcePath = fileURLToPath(webAppSource);
  const devPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
  const devHost = process.env.HOST ?? "127.0.0.1";
  const localDevOrigins = [
    "https://voidhash.localhost",
    `http://localhost:${devPort}`,
    `https://localhost:${devPort}`,
    `http://127.0.0.1:${devPort}`,
    `https://127.0.0.1:${devPort}`,
  ];
  // oxlint-disable-next-line effect/noDynamicImports -- Vite needs resolved files, not imported module values.
  const require = createRequire(import.meta.url);
  const tslibPath = require.resolve("tslib/tslib.es6.mjs");
  const fontSourcePaths = ["@fontsource-variable/geist", "@fontsource-variable/geist-mono"].map(
    (packageName) => dirname(require.resolve(packageName)),
  );
  const aliases: Alias[] = [
    {
      find: /^virtual:voidhash-web\/auth-browser$/,
      replacement: fileURLToPath(options.composition.authBrowser),
    },
    {
      find: /^virtual:voidhash-web\/auth-server$/,
      replacement: fileURLToPath(options.composition.authServer),
    },
    {
      find: /^virtual:voidhash-web\/edition$/,
      replacement: fileURLToPath(options.composition.edition),
    },
    {
      find: /^virtual:voidhash-web\/globals\.css(?=\?|$)/,
      replacement: fileURLToPath(options.composition.globals),
    },
    {
      find: /^@generated\/browser$/,
      replacement: fileURLToPath(new URL("./.source/browser.ts", options.appRoot)),
    },
    {
      find: /^@generated\/server$/,
      replacement: fileURLToPath(new URL("./.source/server.ts", options.appRoot)),
    },
    ...(options.extraAliases ?? []),
    { find: "@", replacement: webAppSourcePath },
    { find: "tslib", replacement: tslibPath },
  ];
  const routesDirectory =
    relative(fileURLToPath(new URL("./src/", options.appRoot)), workspaceRoot) || ".";
  const ssr: SSROptions | undefined =
    process.env.VOIDHASH_SELFHOST_BUNDLE === "true" ? { noExternal: true } : undefined;

  return defineConfig(
    () =>
      ({
        root: appRoot,
        build: {
          minify: "esbuild",
        },
        publicDir: fileURLToPath(options.publicDir ?? communityPublic),
        optimizeDeps: {
          exclude: [...(options.optimizeDepsExclude ?? [])],
        },
        plugins: [
          tsconfigPaths(),
          ...mdx(options.sourceConfig, {
            configPath: options.sourceConfigPath ?? "src/features/source.config.ts",
          }),
          tanstackClientEntryMiddleware(),
          corsMiddleware(localDevOrigins),
          paywallRuntimeBundlePlugin(),
          tailwindcss(),
          tanstackStart({
            srcDirectory: "src",
            server: {
              entry: "server.ts",
            },
            router: {
              routesDirectory,
              virtualRouteConfig: {
                type: "root",
                file: toRoutePath(workspaceRoot, rootRoute),
                children: options.routeDirectories.map((directory) => ({
                  type: "physical" as const,
                  directory: toRoutePath(workspaceRoot, directory),
                  pathPrefix: "",
                })),
              },
            },
            prerender: {
              enabled: false,
            },
          }),
          ...(options.extraPlugins ?? []),
          viteReact(),
        ],
        resolve: {
          alias: aliases,
          dedupe: ["@tanstack/react-query", "@tanstack/react-router", "react", "react-dom"],
        },
        server: {
          cors: {
            credentials: true,
            origin: true,
          },
          fs: {
            allow: [workspaceRoot, fileURLToPath(webAppRoot), ...fontSourcePaths],
          },
          host: devHost,
          port: devPort,
          strictPort: true,
        },
        ssr,
      }) satisfies UserConfig,
  );
}
