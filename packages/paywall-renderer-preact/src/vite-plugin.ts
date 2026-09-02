import * as R from "effect/Record";
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
import type { Plugin } from "vite";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const packageRootUrl = new URL("..", import.meta.url);
const packageRoot = decodeURIComponent(packageRootUrl.pathname);
const entryPoint = decodeURIComponent(new URL("src/runtime/hydrate.tsx", packageRootUrl).pathname);
const placeholderModule = decodeURIComponent(
  new URL("src/templates/runtime-bundle.ts", packageRootUrl).pathname,
);

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
  const watchFiles = R.keys(result.metafile.inputs)
    .filter((input) => !input.includes("node_modules"))
    .map((input) => decodeURIComponent(new URL(input, packageRootUrl).pathname));

  return {
    code: `export function getRuntimeBundle() {\n  return ${effectEncodeJson(bundle)};\n}\n`,
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
      if (file !== placeholderModule) {
        return null;
      }
      const { code, watchFiles } = await buildRuntimeBundle();
      watchFiles.forEach((watchFile) => this.addWatchFile(watchFile));
      return { code, map: null };
    },
  };
}
