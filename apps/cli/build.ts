import { NodeRuntime } from "@effect/platform-node";
import { causeMessage } from "@voidhash/lib/lang";
import { Data, Effect } from "effect";
import * as esbuild from "esbuild";
import * as tsup from "tsup";

import pkg from "./package.json" with { type: "json" };

esbuild.buildSync({
  banner: {
    js: "#!/usr/bin/env node",
  },
  bundle: true,
  define: {
    "process.env.VOIDHASH_CLI_VERSION": `"${pkg.version}"`,
  },
  entryPoints: ["./src/cli/index.ts"],
  // Loaded at runtime when the CLI reads a TypeScript config file.
  external: ["esbuild"],
  format: "cjs",
  outfile: "dist/bin.cjs",
  platform: "node",
  target: "node16",
});

class BuildFailedError extends Data.TaggedError("BuildFailedError")<{
  readonly message: string;
}> {}

const main = Effect.tryPromise({
  catch: (cause) => new BuildFailedError({ message: causeMessage(cause) }),
  try: () =>
    tsup.build({
      dts: true,
      entryPoints: ["./src/index.ts"],
      external: ["esbuild"],
      format: ["cjs", "esm"],
      outDir: "./dist",
      outExtension: (ctx) => {
        if (ctx.format === "cjs") {
          return {
            dts: ".d.ts",
            js: ".cjs",
          };
        }
        return {
          dts: ".d.mts",
          js: ".mjs",
        };
      },
      splitting: false,
    }),
});

// runMain reports the failure and exits with a non-zero code.
NodeRuntime.runMain(main);
