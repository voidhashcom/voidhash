import * as esbuild from "esbuild";

esbuild.buildSync({
  banner: {
    js: "#!/usr/bin/env -S node --loader ./dist/loader.mjs --no-warnings",
  },
  bundle: true,
  entryPoints: ["./src/cli/index.ts"],
  external: [
    "esbuild",
    "@voidhash/studio",
    "@voidhash/paywalls",
    "vite",
    "typescript",
  ],
  format: "cjs",
  outfile: "dist/index.cjs",
  platform: "node",
  target: "node16",
});
