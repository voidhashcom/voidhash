import { Effect } from "effect";
import * as tsup from "tsup";

const describeCause = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.stack ?? cause.message;
  }

  return String(cause);
};

const build = Effect.tryPromise({
  try: () =>
    tsup.build({
      dts: true,
      entryPoints: {
        index: "./src/index.ts",
        react: "./src/react/index.ts",
      },
      external: ["react"],
      format: ["cjs", "esm"],
      outDir: "./dist",
      outExtension: (ctx) => {
        if (ctx.format === "cjs") {
          return {
            dts: ".d.ts",
            js: ".js",
          };
        }

        return {
          dts: ".d.mts",
          js: ".mjs",
        };
      },
      sourcemap: true,
      splitting: false,
      target: "es2022",
    }),
  catch: describeCause,
});

// Build script should print the failure and exit non-zero.
void Effect.runPromise(
  build.pipe(
    Effect.tapError((message) => Effect.logError(`Build failed: ${message}`)),
    Effect.catch(() =>
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  ),
);
