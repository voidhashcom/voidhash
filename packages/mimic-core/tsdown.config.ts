import { defineConfig } from "tsdown";

export default defineConfig({
  target: ["es2022"],
  entry: ["./src/index.ts"],
  dts: {
    sourcemap: true,
    tsconfig: "./tsconfig.build.json",
  },
  unbundle: true,
  format: ["cjs", "esm"],
  outExtensions: (ctx) => ({
    dts: ctx.format === "cjs" ? ".d.cts" : ".d.mts",
    js: ctx.format === "cjs" ? ".cjs" : ".mjs",
  }),
});
