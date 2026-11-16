import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as P from "effect/Predicate";
import * as tsup from "tsup";

import { version } from "./package.json";

const describeCause = (cause: unknown) => {
  if (P.isError(cause)) {
    return cause.stack ?? cause.message;
  }

  return String(cause);
};

const sharedOptions = {
  dts: true,
  entryPoints: {
    index: "./src/index.ts",
    react: "./src/react/index.ts",
  },
  external: ["react"],
  // `@voidhash/generated-clients` is never published, so its runtime code is
  // bundled in. `effect` and `react` stay external peer dependencies.
  noExternal: ["@voidhash/generated-clients"],
  outDir: "./dist",
  sourcemap: true,
  target: "es2022",
} satisfies tsup.Options;

/**
 * The ES module build splits the client into a chunk both entry points share,
 * so an app that uses the React bindings loads the client once, and keeps the
 * React entry's `"use client"` directive in its directive prologue. There is
 * no CommonJS build: `effect` is published as ES modules only.
 *
 * The script-tag build is one file for pages without a bundler. It carries
 * `effect`, which such a page cannot install, and exposes the SDK as the
 * `Voidhash` global.
 */
const build = Effect.tryPromise({
  try: async () => {
    await tsup.build({
      ...sharedOptions,
      clean: true,
      format: ["esm"],
      outExtension: () => ({ dts: ".d.ts", js: ".mjs" }),
      splitting: true,
    });
    await tsup.build({
      // Names the build, so a page loading `latest` can tell which version it got.
      banner: { js: `/*! @voidhash/web ${version} | MIT */` },
      entry: { voidhash: "./src/global.ts" },
      format: ["iife"],
      globalName: "Voidhash",
      minify: true,
      noExternal: ["effect", "@voidhash/generated-clients"],
      outDir: "./dist",
      outExtension: () => ({ js: ".global.js" }),
      platform: "browser",
      sourcemap: true,
      // The map names files and lines without embedding them; with `effect`
      // inside, the sources would make it 3 MB of the installed package.
      esbuildOptions: (options) => {
        options.sourcesContent = false;
      },
      target: "es2022",
    });
  },
  catch: describeCause,
});

// Build script should print the failure and exit non-zero.
const runtime = ManagedRuntime.make(Layer.empty);
void runtime.runPromise(
  Effect.matchEffect(build, {
    onFailure: (message) =>
      Effect.logError(`Build failed: ${message}`).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          }),
        ),
      ),
    onSuccess: () => Effect.void,
  }),
);
