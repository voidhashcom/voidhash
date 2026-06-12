/**
 * The deploy typecheck gate: before anything is bundled, the discovered
 * `.voidhash` sources are typechecked with the TypeScript compiler API using
 * the project's own `tsconfig.json`, and the build fails listing diagnostics.
 */
import { dirname, join } from "node:path";

import { Data, Effect } from "effect";
import ts from "typescript";

export class PaywallTypecheckError extends Data.TaggedError(
  "PaywallTypecheckError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Asset extensions the build's esbuild loaders accept in paywall/component
 * sources. The typecheck gate injects matching ambient module declarations so
 * `import hero from "./hero.png"` typechecks, and the bundler emits/inlines
 * the file.
 */
export const PAYWALL_ASSET_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ttf",
  "otf",
  "woff",
  "woff2",
] as const;

/** Ambient `declare module "*.png" { … }` block per supported asset extension. */
const ASSET_MODULE_DECLARATIONS = PAYWALL_ASSET_EXTENSIONS.map(
  (ext) =>
    `declare module "*.${ext}" {\n  const url: string;\n  export default url;\n}\n`,
).join("\n");

/**
 * Virtual file name (resolved under the project root) for the injected asset
 * declarations. Never written to disk — served from memory by the gate's
 * compiler host.
 */
const ASSET_DECLARATIONS_FILE_NAME = "__voidhash-asset-modules__.d.ts";

/** Options used when the project has no `tsconfig.json` to inherit from. */
const FALLBACK_OPTIONS: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  target: ts.ScriptTarget.ES2022,
};

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

const loadCompilerOptions = (
  projectRoot: string,
): { options: ts.CompilerOptions; configPath: string | undefined } => {
  const configPath = ts.findConfigFile(
    projectRoot,
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (!configPath) {
    return { configPath: undefined, options: { ...FALLBACK_OPTIONS } };
  }

  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(ts.formatDiagnostics([read.error], formatHost));
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    dirname(configPath),
    undefined,
    configPath,
  );
  // "no inputs were found" (18003) is irrelevant — we supply our own roots.
  const configErrors = parsed.errors.filter((e) => e.code !== 18_003);
  if (configErrors.length > 0) {
    throw new Error(ts.formatDiagnostics(configErrors, formatHost));
  }
  return { configPath, options: parsed.options };
};

/**
 * Wraps a compiler host so the in-memory asset declaration file exists at
 * `assetDeclPath` without ever touching disk.
 */
const withAssetDeclarations = (
  host: ts.CompilerHost,
  assetDeclPath: string,
): ts.CompilerHost => {
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  return {
    ...host,
    fileExists: (fileName) =>
      fileName === assetDeclPath || fileExists(fileName),
    getSourceFile: (fileName, languageVersionOrOptions, ...rest) =>
      fileName === assetDeclPath
        ? ts.createSourceFile(
            fileName,
            ASSET_MODULE_DECLARATIONS,
            languageVersionOrOptions,
            true,
          )
        : getSourceFile(fileName, languageVersionOrOptions, ...rest),
    readFile: (fileName) =>
      fileName === assetDeclPath ? ASSET_MODULE_DECLARATIONS : readFile(fileName),
  };
};

/**
 * Typechecks the given `.voidhash` source files with the project's
 * `tsconfig.json` (falling back to strict react-jsx defaults when the project
 * has none). An in-memory ambient declaration file covering the
 * esbuild-supported asset extensions ({@link PAYWALL_ASSET_EXTENSIONS}) is
 * injected so asset imports typecheck as string default exports. Fails with a
 * {@link PaywallTypecheckError} listing every error-severity diagnostic.
 */
export const typecheckPaywallSources = (options: {
  readonly projectRoot: string;
  readonly files: ReadonlyArray<string>;
}): Effect.Effect<void, PaywallTypecheckError> =>
  Effect.try({
    try: () => {
      const { options: compilerOptions } = loadCompilerOptions(
        options.projectRoot,
      );

      const finalOptions: ts.CompilerOptions = {
        ...compilerOptions,
        // The gate only checks — never emit, and never stumble over
        // third-party declaration files.
        incremental: false,
        jsx: compilerOptions.jsx ?? ts.JsxEmit.ReactJSX,
        noEmit: true,
        skipLibCheck: true,
      };

      const assetDeclPath = join(
        options.projectRoot,
        ASSET_DECLARATIONS_FILE_NAME,
      );
      const program = ts.createProgram({
        host: withAssetDeclarations(
          ts.createCompilerHost(finalOptions),
          assetDeclPath,
        ),
        options: finalOptions,
        rootNames: [...options.files, assetDeclPath],
      });

      const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error);

      if (diagnostics.length > 0) {
        throw new Error(
          `TypeScript found ${diagnostics.length} error(s) in .voidhash sources:\n\n` +
            ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
        );
      }
    },
    catch: (cause) =>
      new PaywallTypecheckError({
        cause,
        message:
          cause instanceof Error
            ? cause.message
            : "Failed to typecheck .voidhash sources.",
      }),
  });
