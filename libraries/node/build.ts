import { Data, Effect } from "effect";
import * as tsup from "tsup";

class BuildFailedError extends Data.TaggedError("BuildFailedError")<{
  readonly cause: unknown;
}> {}

const main = Effect.tryPromise({
  try: () =>
    tsup.build({
      dts: true,
      entryPoints: {
        index: "./src/index.ts",
        effect: "./src/effect.ts",
      },
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
