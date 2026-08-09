import { defineConfig } from "tsdown";

const outExtensionsFor = (format: string): { dts: string; js: string } => {
  if (format === "cjs") return { dts: ".d.cts", js: ".cjs" };
  return { dts: ".d.mts", js: ".mjs" };
};

export default defineConfig({
  target: ["es2022"],
  entry: ["./src/index.ts"],
  dts: {
    sourcemap: true,
    tsconfig: "./tsconfig.build.json",
  },
  unbundle: true,
  format: ["cjs", "esm"],
  outExtensions: (ctx) => outExtensionsFor(ctx.format),
});
