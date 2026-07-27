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
  // These are resolved/launched at runtime (Studio's Vite app, the paywalls
  // runtime, Vite itself) — keep them out of the bundle.
  external: ["esbuild", "@voidhash/studio", "@voidhash/paywalls", "vite", "typescript"],
  format: "cjs",
  outfile: "dist/bin.cjs",
  platform: "node",
  target: "node16",
});

const main = async () => {
  await tsup.build({
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
  });
};

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: User facing console error.
  console.error(error);
  process.exit(1);
});
