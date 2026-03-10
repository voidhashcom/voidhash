import * as tsup from "tsup";

const main = async () => {
  await tsup.build({
    dts: true,
    entryPoints: {
      index: "./src/index.ts",
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
  });
};

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Build script should print the failure.
  console.error(error);
  process.exit(1);
});
