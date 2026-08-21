import { Data, Effect } from "effect";
import * as tsup from "tsup";

class BuildFailedError extends Data.TaggedError("BuildFailedError")<{
  readonly cause: unknown;
}> {}

const main = Effect.tryPromise({
  try: () =>
    tsup.build({
      // `@voidhash/generated-clients` is private, so an
      // `import ... from "@voidhash/generated-clients"` left in the emitted
      // declarations would not resolve for consumers. tsup's `dts.resolve`
      // cannot inline it: the resolver it uses reads `types`/`main`, and that
      // package exposes its source only through an `exports` map. Mapping the
      // specifier to the source entry makes rollup-plugin-dts treat it as a
      // local module and inline the declarations instead.
      dts: {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@voidhash/generated-clients": ["../../packages/generated-clients/src/index.ts"],
          },
          // Widened from tsconfig's `.` so the inlined sources, which live
          // outside this package, stay inside the declaration program's root.
          rootDir: "../..",
        },
      },
      entryPoints: {
        index: "./src/index.ts",
        effect: "./src/effect.ts",
      },
      format: ["cjs", "esm"],
      // `@voidhash/generated-clients` is never published, so its runtime code is
      // bundled in. `effect` stays external — it is a real dependency.
      noExternal: ["@voidhash/generated-clients"],
      outDir: "./dist",
      // tsup v8 rewrites `node:crypto` to `crypto` by default, which lets a
      // bundler resolve the builtin to a same-named npm polyfill instead.
      removeNodeProtocol: false,
      // The package is `"type": "module"`, so the CJS build must use `.cjs` or
      // Node parses it as ESM and `require()` resolves to an empty namespace.
      outExtension: (ctx) => {
        if (ctx.format === "cjs") {
          return {
            dts: ".d.cts",
            js: ".cjs",
          };
        }

        return {
          dts: ".d.ts",
          js: ".mjs",
        };
      },
      sourcemap: true,
      splitting: false,
      target: "es2022",
    }),
  catch: (cause) => new BuildFailedError({ cause }),
}).pipe(
  // Build script should print the failure and exit non-zero.
  Effect.tapError((error) => Effect.logError(error.cause)),
  Effect.catchTag("BuildFailedError", () =>
    Effect.sync(() => {
      process.exitCode = 1;
    }),
  ),
);

void Effect.runPromise(main);
