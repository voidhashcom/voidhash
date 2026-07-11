import { build, type Plugin } from "esbuild";
import { Effect } from "effect";
import { createRequire } from "node:module";
import * as path from "node:path";
import { PACKAGE_ROOT } from "../package-root.js";

const PUBLIC_ROOT = path.resolve(PACKAGE_ROOT, "../..");

const workspaceSourcePlugin: Plugin = {
  name: "workspace-source",
  setup(buildContext) {
    const mappings: Record<string, string> = {
      "@voidhash/mimic-cli": path.resolve(PACKAGE_ROOT, "src/index.ts"),
      "@voidhash/mimic-core": path.resolve(
        PUBLIC_ROOT,
        "packages/mimic-core/src/index.ts",
      ),
    };

    buildContext.onResolve({ filter: /^@voidhash\// }, (args) => {
      const mapped = mappings[args.path];
      if (mapped) {
        return { path: mapped };
      }
      return undefined;
    });
  },
};

export class FailedToLoadConfigFileError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FailedToLoadConfigFileError";
  }
}

const evaluateBundledModule = (filePath: string, source: string): unknown => {
  const localRequire = createRequire(filePath);
  const module = { exports: {} as unknown };
  const evaluate = new Function("require", "module", "exports", source);
  evaluate(localRequire, module, module.exports);
  return (module.exports as { readonly default?: unknown }).default ?? module.exports;
};

export const loadConfigFile = (filePath: string) =>
  Effect.tryPromise({
    try: async () => {
      const result = await build({
        absWorkingDir: process.cwd(),
        bundle: true,
        entryPoints: [filePath],
        format: "cjs",
        platform: "node",
        target: "node20",
        write: false,
        plugins: [workspaceSourcePlugin],
      });

      const source = result.outputFiles[0]?.text;
      if (!source) {
        throw new Error(`No bundled output was produced for "${filePath}".`);
      }

      return evaluateBundledModule(filePath, source);
    },
    catch: (error) =>
      new FailedToLoadConfigFileError(`Failed to load config file: ${filePath}`, error),
  });
