import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as P from "effect/Predicate";
import * as tsup from "tsup";

const describeCause = (cause: unknown) => {
  if (P.isError(cause)) {
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
