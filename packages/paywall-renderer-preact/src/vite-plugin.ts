/**
 * Vite plugin that compiles the paywall hydration runtime at build time.
 *
 * Replaces the `src/templates/runtime-bundle.ts` placeholder module with an
 * esbuild-bundled IIFE of `src/runtime/hydrate.tsx`, so the runtime embedded
 * in paywall HTML is always built from current source — including the style
 * builders in `@voidhash/paywall-renderer-web-core`. Every source file
 * that feeds the bundle is registered as a watch file, so edits invalidate
 * the module in dev/watch mode.
 *
 * Every pipeline that evaluates `renderPaywallToHtml` with hydration (app
 * builds, dev servers, vitest) must register this plugin; without it the
 * placeholder throws instead of hydrating with a stale runtime.
 */

import * as esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Plugin } from "vite";

const packageRootUrl = new URL("..", import.meta.url);
const packageRoot = fileURLToPath(packageRootUrl);
const entryPoint = fileURLToPath(new URL("src/runtime/hydrate.tsx", packageRootUrl));
const placeholderModule = fileURLToPath(new URL("src/templates/runtime-bundle.ts", packageRootUrl));

interface RuntimeBundle {
  code: string;
  watchFiles: readonly string[];
}

async function buildRuntimeBundle(): Promise<RuntimeBundle> {
  const result = await esbuild.build({
    absWorkingDir: packageRoot,
    entryPoints: [entryPoint],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    write: false,
    metafile: true,
    jsx: "automatic",
    jsxImportSource: "preact",
    sourcemap: false,
    treeShaking: true,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  const bundle = result.outputFiles[0].text;
  const watchFiles = Object.keys(result.metafile.inputs)
    .filter((input) => !input.includes("node_modules"))
    .map((input) => fileURLToPath(new URL(input, packageRootUrl)));

  return {
    code: `export function getRuntimeBundle() {\n  return ${JSON.stringify(bundle)};\n}\n`,
    watchFiles,
  };
}

/**
 * Creates the plugin instance. Register it in the Vite config of every
 * pipeline that consumes `@voidhash/paywall-renderer-preact`.
 */
export function paywallRuntimeBundlePlugin(): Plugin {
  return {
    name: "paywall-runtime-bundle",
    enforce: "pre",
    async transform(_code, id) {
      const [file] = id.split("?");
      if (fileURLToPath(pathToFileURL(file)) !== placeholderModule) {
        return null;
      }
      const { code, watchFiles } = await buildRuntimeBundle();
      for (const watchFile of watchFiles) {
        this.addWatchFile(watchFile);
      }
      return { code, map: null };
    },
  };
}
