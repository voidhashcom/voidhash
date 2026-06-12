import * as tsup from "tsup";

const main = async () => {
  await tsup.build({
    dts: true,
    entryPoints: {
      dom: "./src/dom.tsx",
      index: "./src/index.ts",
      panel: "./src/panel.ts",
      tree: "./src/tree.ts",
    },
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      // Node-only dependency of the `tree` entry; never reaches the browser
      // entries because nothing outside `src/tree-renderer` imports it.
      "react-reconciler",
      "react-reconciler/constants",
    ],
    format: ["cjs", "esm"],
    outDir: "./dist",
    outExtension: (ctx) => {
      if (ctx.format === "cjs") {
        // `.cjs` because package.json declares `"type": "module"` — a plain
        // `.js` would be loaded as ESM by Node and break the require path.
        return { dts: ".d.ts", js: ".cjs" };
      }
      return { dts: ".d.mts", js: ".mjs" };
    },
    sourcemap: true,
    // Split shared code (runtime, primitives, contexts) into common chunks all
    // entries import. Without this, each entry would inline its own copy of
    // the runtime — yielding distinct React contexts, so e.g. a component
    // rendered by `@voidhash/paywalls/tree` could not resolve the tree host
    // installed through `RendererProvider`. Splitting guarantees a single
    // shared instance.
    splitting: true,
    target: "es2022",
    esbuildOptions: (options) => {
      options.jsx = "automatic";
    },
  });
};

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Build script should print the failure.
  console.error(error);
  process.exit(1);
});
