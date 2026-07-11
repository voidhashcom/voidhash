import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import * as tsup from "tsup";
import pkg from "./package.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const workspaceSourcePlugin: esbuild.Plugin = {
  name: "workspace-source",
  setup(build) {
    const workspacePackages: Record<string, string> = {
      "@voidhash/mimic-cli": "./src/index.ts",
      "@voidhash/mimic-core": "../../packages/mimic-core/src/index.ts",
      "@voidhash/mimic-server": "../../packages/mimic-server/src/index.ts",
      "@voidhash/mimic-server/effect":
        "../../packages/mimic-server/src/effect/index.ts",
      "@voidhash/mimic-server/migrate":
        "../../packages/mimic-server/src/migrate/index.ts",
    };

    const externals = new Set(build.initialOptions.external ?? []);

    build.onResolve({ filter: /^@voidhash\// }, (args) => {
      if (externals.has(args.path)) {
        return { path: args.path, external: true };
      }
      const mapped = workspacePackages[args.path];
      if (mapped) {
        return { path: path.resolve(__dirname, mapped) };
      }
      return undefined;
    });
  },
};

const main = async () => {
  await esbuild.build({
    banner: { js: "#!/usr/bin/env node" },
    bundle: true,
    define: {
      "import.meta.dirname": "__dirname",
      "process.env.MIMIC_CLI_VERSION": `"${pkg.version}"`,
    },
    entryPoints: ["./src/cli/index.ts"],
    external: [
      "esbuild",
      "effect",
      "effect/*",
      "@voidhash/mimic-core",
      "@voidhash/mimic-server",
      "@voidhash/mimic-server/*",
    ],
    format: "cjs",
    outfile: "dist/bin.cjs",
    platform: "node",
    plugins: [workspaceSourcePlugin],
    target: "node20",
  });

  await tsup.build({
    dts: true,
    entryPoints: ["./src/index.ts"],
    external: ["esbuild", "@voidhash/mimic-core", "@voidhash/mimic-server"],
    format: ["cjs", "esm"],
    outDir: "./dist",
    outExtension: (ctx) => {
      if (ctx.format === "cjs") return { dts: ".d.ts", js: ".js" };
      return { dts: ".d.mts", js: ".mjs" };
    },
    splitting: false,
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
